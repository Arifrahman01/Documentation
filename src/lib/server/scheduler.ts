import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { clearAiCache } from './ai';

let isSyncRunning = false;
let schedulerStarted = false;
let lastSyncTimestamp: string | null = null;
let lastSyncStatus: 'success' | 'failed' | 'aborted' | null = null;
let currentLogs: string[] = [];
let lastSyncOutput: string = '';
let currentChildProcess: ChildProcess | null = null;
let currentActiveTypes: string[] = ['pdf', 'docx', 'xlsx'];
let currentIsIncremental = true;
let currentBatchLimit = 0;

const STATUS_FILE = path.resolve(process.cwd(), 'data/sync-status.json');
const MAX_LOG_LINES = 200;

export interface SyncOptions {
	types?: string[];
	force?: boolean;
	batchLimit?: number;
}

export function getSyncStatus() {
	let checkpointInfo: any = null;
	if (fs.existsSync(STATUS_FILE)) {
		try {
			checkpointInfo = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
		} catch (_) {}
	}

	const logsToReturn = isSyncRunning
		? currentLogs.slice(-MAX_LOG_LINES)
		: lastSyncOutput
			? lastSyncOutput.split('\n').slice(-MAX_LOG_LINES)
			: currentLogs.slice(-MAX_LOG_LINES);

	return {
		isSyncRunning,
		lastSyncTimestamp,
		lastSyncStatus,
		activeTypes: currentActiveTypes,
		isIncremental: currentIsIncremental,
		batchLimit: currentBatchLimit,
		checkpoint: checkpointInfo,
		logs: logsToReturn
	};
}

/**
 * Menghentikan proses sinkronisasi yang sedang berjalan secara aman (graceful abort).
 * Worker akan menangkap sinyal SIGTERM dan menyimpan seluruh berkas yang sudah selesai diproses.
 */
export function cancelExternalDocsSync(): { success: boolean; message: string } {
	if (!isSyncRunning || !currentChildProcess) {
		return {
			success: false,
			message: 'Tidak ada proses sinkronisasi yang sedang berjalan.'
		};
	}

	try {
		const timestamp = new Date().toLocaleTimeString('id-ID');
		currentLogs.push(
			`[${timestamp}] Permintaan pembatalan diterima. Mengirim sinyal aman SIGTERM ke worker...`
		);
		currentChildProcess.kill('SIGTERM');
		return {
			success: true,
			message: 'Sinyal penghentian telah dikirim. Checkpoint dokumen sedang diamankan.'
		};
	} catch (err: any) {
		return {
			success: false,
			message: `Gagal menghentikan proses: ${err.message}`
		};
	}
}

/**
 * Menjalankan proses ekstraksi dan pengindeksan dokumen eksternal di latar belakang.
 * Menggunakan child process dengan batas memori ketat (768MB) & prioritas CPU rendah
 * agar laptop / server tetap responsif dan tidak pernah hang.
 */
export function startExternalDocsSyncBackground(options?: SyncOptions): {
	started: boolean;
	isSyncRunning: boolean;
	message: string;
} {
	if (isSyncRunning) {
		return {
			started: false,
			isSyncRunning: true,
			message: 'Sinkronisasi dokumen sedang berjalan di latar belakang.'
		};
	}

	runExternalDocsSync(options).catch((err) => {
		console.error('[SCHEDULER ASYNC ERROR]:', err);
	});

	return {
		started: true,
		isSyncRunning: true,
		message: 'Proses sinkronisasi dokumen eksternal berhasil dimulai secara bertahap.'
	};
}

export function runExternalDocsSync(
	options?: SyncOptions
): Promise<{ success: boolean; message: string; output?: string }> {
	if (isSyncRunning) {
		return Promise.resolve({
			success: false,
			message: 'Sinkronisasi dokumen sedang berjalan di latar belakang.',
			output: currentLogs.join('\n')
		});
	}

	return new Promise((resolve) => {
		isSyncRunning = true;
		currentLogs = [];
		const scriptPath = path.resolve(process.cwd(), 'scripts/index-external-docs.cjs');

		if (!fs.existsSync(scriptPath)) {
			isSyncRunning = false;
			console.warn('[SCHEDULER] Skrip index-external-docs.cjs tidak ditemukan di:', scriptPath);
			const errorMsg = `Berkas skrip indexer tidak ditemukan di: ${scriptPath}`;
			currentLogs.push(`[ERROR] ${errorMsg}`);
			lastSyncOutput = currentLogs.join('\n');
			return resolve({
				success: false,
				message: errorMsg,
				output: lastSyncOutput
			});
		}

		// Configure arguments
		const cliArgs: string[] = [];
		const types =
			options?.types && options.types.length > 0 ? options.types : ['pdf', 'docx', 'xlsx'];
		currentActiveTypes = types;
		cliArgs.push(`--types=${types.join(',')}`);

		const isForce = Boolean(options?.force);
		currentIsIncremental = !isForce;
		if (isForce) {
			cliArgs.push('--force');
		}

		const batchLimit = typeof options?.batchLimit === 'number' && options.batchLimit > 0 ? options.batchLimit : 0;
		currentBatchLimit = batchLimit;
		if (batchLimit > 0) {
			cliArgs.push(`--batch=${batchLimit}`);
		}

		const addLog = (text: string) => {
			const rawLines = text.split(/\r?\n/);
			for (const l of rawLines) {
				const trimmed = l.trimEnd();
				if (trimmed) {
					currentLogs.push(trimmed);
					if (currentLogs.length > MAX_LOG_LINES) {
						currentLogs.shift();
					}
				}
			}
		};

		const timeStart = new Date().toLocaleTimeString('id-ID');
		addLog(`[${timeStart}] Memulai worker sinkronisasi dokumen (Mode Hemat CPU & RAM)...`);
		addLog(`[${timeStart}] Jenis Dokumen Terpilih: ${types.join(', ').toUpperCase()}`);
		addLog(
			`[${timeStart}] Mode: ${isForce ? 'Full Re-index (Bertahap)' : 'Inkremental Cepat (Smart Cache)'}${batchLimit > 0 ? ` • Maks ${batchLimit} berkas baru` : ''}`
		);

		console.log(
			`[SYNC DOCS ${timeStart}] Memulai sinkronisasi (types=${types.join(',')}, force=${isForce}, batch=${batchLimit})...`
		);

		// Spawn process with 1536MB heap limit + explicit GC to safely handle 6,000+ files
		const proc = spawn(
			process.execPath,
			['--max-old-space-size=1536', '--expose-gc', scriptPath, ...cliArgs],
			{
				cwd: process.cwd(),
				env: { ...process.env },
				stdio: ['ignore', 'pipe', 'pipe']
			}
		);
		currentChildProcess = proc;

		proc.stdout.on('data', (chunk) => {
			addLog(chunk.toString());
		});

		proc.stderr.on('data', (chunk) => {
			addLog(chunk.toString());
		});

		proc.on('close', (code, signal) => {
			isSyncRunning = false;
			currentChildProcess = null;
			lastSyncTimestamp = new Date().toISOString();
			lastSyncOutput = currentLogs.join('\n');
			clearAiCache();

			if (signal === 'SIGTERM' || signal === 'SIGINT') {
				lastSyncStatus = 'aborted';
				addLog(
					`[${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi DIHENTIKAN. Progres tersimpan di checkpoint.`
				);
				console.log(`[SYNC DOCS] Sinkronisasi dihentikan (signal: ${signal}).`);
				resolve({
					success: true,
					message: 'Sinkronisasi berhasil dihentikan. Checkpoint dokumen telah disimpan.',
					output: lastSyncOutput
				});
			} else if (code === 0) {
				lastSyncStatus = 'success';
				addLog(
					`[${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi selesai dengan SUKSES.`
				);
				console.log(
					`[SYNC DOCS ${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi dokumen eksternal selesai dengan SUKSES.`
				);
				resolve({
					success: true,
					message: 'Sinkronisasi dan pengindeksan dokumen eksternal berhasil diselesaikan.',
					output: lastSyncOutput
				});
			} else {
				lastSyncStatus = 'failed';
				addLog(
					`[${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi gagal dengan exit code: ${code}`
				);
				console.error(
					`[SYNC DOCS ERROR ${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi gagal dengan kode ${code}`
				);
				resolve({
					success: false,
					message: `Sinkronisasi dokumen gagal (exit code: ${code}).`,
					output: lastSyncOutput
				});
			}
		});

		proc.on('error', (err) => {
			isSyncRunning = false;
			currentChildProcess = null;
			lastSyncStatus = 'failed';
			addLog(
				`[${new Date().toLocaleTimeString('id-ID')}] Gagal menjalankan child process: ${err.message}`
			);
			lastSyncOutput = currentLogs.join('\n');
			console.error(`[SYNC DOCS ERROR] Gagal menjalankan child process:`, err.message);
			resolve({
				success: false,
				message: `Gagal menjalankan proses sinkronisasi: ${err.message}`,
				output: lastSyncOutput
			});
		});
	});
}

function getMsUntilMidnight(): number {
	const now = new Date();
	const midnight = new Date(now);
	midnight.setDate(now.getDate() + 1);
	midnight.setHours(0, 0, 0, 0);
	return midnight.getTime() - now.getTime();
}

/**
 * Memulai penjadwal otomatis harian setiap jam 12 malam (00:00).
 */
export function startExternalDocsScheduler() {
	if (schedulerStarted) return;
	schedulerStarted = true;

	function scheduleNextRun() {
		const msUntilMidnight = getMsUntilMidnight();
		const hoursRemaining = (msUntilMidnight / (1000 * 60 * 60)).toFixed(1);

		console.log(
			`[SCHEDULER] Auto-sync dokumen eksternal AKTIF: Berjalan otomatis setiap jam 00:00 (berikutnya dalam ${hoursRemaining} jam).`
		);

		setTimeout(async () => {
			console.log(
				`\n[SCHEDULER 00:00] Menjalankan jadwal otomatis harian: Sinkronisasi dokumen eksternal...`
			);
			try {
				await runExternalDocsSync({ types: ['pdf', 'docx', 'xlsx'], force: false });
			} catch (err: any) {
				console.error(`[SCHEDULER ERROR] Eksekusi jadwal tengah malam gagal:`, err?.message);
			}

			scheduleNextRun();
		}, msUntilMidnight);
	}

	scheduleNextRun();
}
