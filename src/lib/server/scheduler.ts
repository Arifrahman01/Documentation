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

const STATUS_FILE = path.resolve(process.cwd(), 'data/sync-status.json');

export interface SyncOptions {
	types?: string[];
	force?: boolean;
}

export function getSyncStatus() {
	// If process was running across SvelteKit reload, check status file
	let checkpointInfo: any = null;
	if (fs.existsSync(STATUS_FILE)) {
		try {
			checkpointInfo = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
		} catch (_) {}
	}

	return {
		isSyncRunning,
		lastSyncTimestamp,
		lastSyncStatus,
		activeTypes: currentActiveTypes,
		isIncremental: currentIsIncremental,
		checkpoint: checkpointInfo,
		logs: isSyncRunning ? currentLogs : lastSyncOutput ? lastSyncOutput.split('\n') : currentLogs,
		output: isSyncRunning ? currentLogs.join('\n') : lastSyncOutput
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
		currentLogs.push(`[${timestamp}] Permintaan pembatalan diterima. Mengirim sinyal aman SIGTERM ke worker...`);
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
 * Menggunakan child process agar memori parser (PDF/Excel) langsung dibersihkan oleh OS
 * dan tidak membebani memori utama server SvelteKit.
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

	// Trigger background execution without awaiting
	runExternalDocsSync(options).catch((err) => {
		console.error('[SCHEDULER ASYNC ERROR]:', err);
	});

	return {
		started: true,
		isSyncRunning: true,
		message: 'Proses sinkronisasi dokumen eksternal berhasil dimulai.'
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
		const types = options?.types && options.types.length > 0 ? options.types : ['pdf', 'docx', 'xlsx'];
		currentActiveTypes = types;
		cliArgs.push(`--types=${types.join(',')}`);

		const isForce = Boolean(options?.force);
		currentIsIncremental = !isForce;
		if (isForce) {
			cliArgs.push('--force');
		}

		const addLog = (text: string) => {
			const rawLines = text.split(/\r?\n/);
			for (const l of rawLines) {
				const trimmed = l.trimEnd();
				if (trimmed) {
					currentLogs.push(trimmed);
					if (currentLogs.length > 2500) {
						currentLogs.shift();
					}
				}
			}
		};

		const timeStart = new Date().toLocaleTimeString('id-ID');
		addLog(`[${timeStart}] Memulai worker sinkronisasi dokumen eksternal...`);
		addLog(`[${timeStart}] Jenis Dokumen Terpilih: ${types.join(', ').toUpperCase()}`);
		addLog(`[${timeStart}] Mode: ${isForce ? 'Full Re-index' : 'Inkremental Cepat (Smart Cache)'}`);

		console.log(`[SYNC DOCS ${timeStart}] Memulai sinkronisasi (types=${types.join(',')}, force=${isForce})...`);

		// Spawn process with 4GB heap limit to prevent OOM
		const proc = spawn(
			process.execPath,
			['--max-old-space-size=4096', scriptPath, ...cliArgs],
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
				addLog(`[${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi DIHENTIKAN. Progres tersimpan di checkpoint.`);
				console.log(`[SYNC DOCS] Sinkronisasi dihentikan (signal: ${signal}).`);
				resolve({
					success: true,
					message: 'Sinkronisasi berhasil dihentikan. Checkpoint dokumen telah disimpan.',
					output: lastSyncOutput
				});
			} else if (code === 0) {
				lastSyncStatus = 'success';
				addLog(`[${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi selesai dengan SUKSES.`);
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
				addLog(`[${new Date().toLocaleTimeString('id-ID')}] Sinkronisasi gagal dengan exit code: ${code}`);
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
			addLog(`[${new Date().toLocaleTimeString('id-ID')}] Gagal menjalankan child process: ${err.message}`);
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
	midnight.setHours(0, 0, 0, 0); // Tepat jam 00:00:00
	return midnight.getTime() - now.getTime();
}

/**
 * Memulai penjadwal otomatis harian setiap jam 12 malam (00:00).
 * Menghitung selisih milidetik secara presisi sehingga tidak mengalami pergeseran waktu (time drift).
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
				// Jadwal otomatis tengah malam selalu menggunakan mode inkremental hemat sumber daya
				await runExternalDocsSync({ types: ['pdf', 'docx', 'xlsx'], force: false });
			} catch (err: any) {
				console.error(`[SCHEDULER ERROR] Eksekusi jadwal tengah malam gagal:`, err?.message);
			}

			// Jadwalkan untuk jam 12 malam berikutnya
			scheduleNextRun();
		}, msUntilMidnight);
	}

	scheduleNextRun();
}
