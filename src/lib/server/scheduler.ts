import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

let isSyncRunning = false;
let schedulerStarted = false;
let lastSyncTimestamp: string | null = null;
let lastSyncStatus: 'success' | 'failed' | null = null;

export function getSyncStatus() {
	return {
		isSyncRunning,
		lastSyncTimestamp,
		lastSyncStatus
	};
}

/**
 * Menjalankan proses ekstraksi dan pengindeksan dokumen eksternal di latar belakang.
 * Menggunakan child process agar memori parser (PDF/Excel) langsung dibersihkan oleh OS
 * dan tidak membebani memori utama server SvelteKit.
 */
export function runExternalDocsSync(): Promise<{ success: boolean; message: string; output?: string }> {
	if (isSyncRunning) {
		return Promise.resolve({
			success: false,
			message: 'Sinkronisasi dokumen sedang berjalan di latar belakang.'
		});
	}

	return new Promise((resolve) => {
		isSyncRunning = true;
		const scriptPath = path.resolve(process.cwd(), 'scripts/index-external-docs.cjs');

		if (!fs.existsSync(scriptPath)) {
			isSyncRunning = false;
			console.warn('[SCHEDULER] Skrip index-external-docs.cjs tidak ditemukan di:', scriptPath);
			return resolve({
				success: false,
				message: `Berkas skrip indexer tidak ditemukan di: ${scriptPath}`
			});
		}

		console.log(
			`[SYNC DOCS ${new Date().toLocaleTimeString()}] Memulai sinkronisasi dokumen eksternal (worker process)...`
		);

		const proc = spawn(process.execPath, [scriptPath], {
			cwd: process.cwd(),
			env: { ...process.env },
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		proc.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		proc.on('close', (code) => {
			isSyncRunning = false;
			lastSyncTimestamp = new Date().toISOString();

			if (code === 0) {
				lastSyncStatus = 'success';
				console.log(
					`[SYNC DOCS ${new Date().toLocaleTimeString()}] Sinkronisasi dokumen eksternal selesai dengan SUKSES.`
				);
				resolve({
					success: true,
					message: 'Sinkronisasi dan pengindeksan dokumen eksternal berhasil diselesaikan.',
					output: stdout
				});
			} else {
				lastSyncStatus = 'failed';
				console.error(
					`[SYNC DOCS ERROR ${new Date().toLocaleTimeString()}] Sinkronisasi gagal dengan kode ${code}:`,
					stderr || stdout
				);
				resolve({
					success: false,
					message: `Sinkronisasi dokumen gagal (exit code: ${code}).`,
					output: stderr || stdout
				});
			}
		});

		proc.on('error', (err) => {
			isSyncRunning = false;
			lastSyncStatus = 'failed';
			console.error(`[SYNC DOCS ERROR] Gagal menjalankan child process:`, err.message);
			resolve({
				success: false,
				message: `Gagal menjalankan proses sinkronisasi: ${err.message}`
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
				await runExternalDocsSync();
			} catch (err: any) {
				console.error(`[SCHEDULER ERROR] Eksekusi jadwal tengah malam gagal:`, err?.message);
			}

			// Jadwalkan untuk jam 12 malam berikutnya
			scheduleNextRun();
		}, msUntilMidnight);
	}

	scheduleNextRun();
}
