<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		RefreshCw,
		CheckCircle2,
		AlertCircle,
		Terminal,
		Copy,
		Check,
		Trash2,
		Clock,
		FolderTree,
		X,
		FileText,
		SlidersHorizontal,
		Zap,
		ShieldCheck,
		Square,
		Layers
	} from '@lucide/svelte';

	let isSyncRunning = $state(false);
	let lastSyncTimestamp = $state<string | null>(null);
	let lastSyncStatus = $state<'success' | 'failed' | 'aborted' | null>(null);
	let logs = $state<string[]>([]);
	let isCopied = $state(false);
	let terminalEl = $state<HTMLDivElement | null>(null);
	let pollInterval = $state<any>(null);

	// Filtering & Mode Configuration
	let selectedTypes = $state<string[]>(['pdf', 'docx', 'xlsx']);
	let isIncremental = $state(true);
	let showFilters = $state(false);

	const availableDocTypes = [
		{ id: 'pdf', label: 'PDF (.pdf)', desc: 'SOP, Regulasi, Formulir', default: true },
		{ id: 'docx', label: 'Word (.docx)', desc: 'Kebijakan, Notulen, Memo', default: true },
		{ id: 'xlsx', label: 'Excel (.xlsx, .xls)', desc: 'Master Data & Spreadsheet', default: true },
		{ id: 'pptx', label: 'Presentasi (.pptx)', desc: 'Slide Materi & Training', default: false },
		{ id: 'txt', label: 'Teks (.txt, .md)', desc: 'Catatan Singkat & Readme', default: false }
	];

	function toggleType(typeId: string) {
		if (selectedTypes.includes(typeId)) {
			// Don't allow deselecting all
			if (selectedTypes.length > 1) {
				selectedTypes = selectedTypes.filter((t) => t !== typeId);
			}
		} else {
			selectedTypes = [...selectedTypes, typeId];
		}
	}

	// Synchronize on modal open
	$effect(() => {
		if (ui.isSyncModalOpen) {
			fetchStatus();

			if (ui.syncModalAutoTrigger) {
				ui.syncModalAutoTrigger = false;
				triggerSync();
			}

			startPolling();
		} else {
			stopPolling();
		}
	});

	function startPolling() {
		stopPolling();
		pollInterval = setInterval(() => {
			fetchStatus();
		}, 500);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function fetchStatus() {
		try {
			const res = await fetch('/api/docs/sync-external');
			if (res.ok) {
				const data = await res.json();
				isSyncRunning = Boolean(data.isSyncRunning);
				lastSyncTimestamp = data.lastSyncTimestamp;
				lastSyncStatus = data.lastSyncStatus;

				if (Array.isArray(data.logs) && data.logs.length > 0) {
					logs = data.logs;
				} else if (typeof data.output === 'string' && data.output.trim()) {
					logs = data.output.split('\n');
				}

				if (Array.isArray(data.activeTypes) && data.activeTypes.length > 0 && isSyncRunning) {
					selectedTypes = data.activeTypes;
				}

				// Auto scroll terminal smoothly to the latest line
				if (terminalEl) {
					requestAnimationFrame(() => {
						if (terminalEl) {
							terminalEl.scrollTop = terminalEl.scrollHeight;
						}
					});
				}
			}
		} catch (_) {}
	}

	async function triggerSync() {
		if (isSyncRunning) return;
		isSyncRunning = true;

		const timeNow = new Date().toLocaleTimeString('id-ID');
		const modeLabel = isIncremental ? 'Inkremental Cepat (Smart Cache)' : 'Full Re-index';
		logs.push(`[${timeNow}] Mengirim perintah sinkronisasi (${selectedTypes.join(', ').toUpperCase()} - ${modeLabel})...`);

		try {
			const res = await fetch('/api/docs/sync-external', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					types: selectedTypes,
					force: !isIncremental
				})
			});
			if (res.ok) {
				fetchStatus();
			}
		} catch (err: any) {
			logs.push(`[ERROR] Gagal memicu sinkronisasi: ${err?.message}`);
			isSyncRunning = false;
		}
	}

	async function stopSync() {
		if (!isSyncRunning) return;
		const timeNow = new Date().toLocaleTimeString('id-ID');
		logs.push(`[${timeNow}] Mengirim permintaan penghentian aman ke server...`);

		try {
			await fetch('/api/docs/sync-external?action=stop', { method: 'POST' });
			fetchStatus();
		} catch (err: any) {
			logs.push(`[ERROR] Gagal mengirim sinyal penghentian: ${err?.message}`);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			ui.closeSyncModal();
		}
	}

	function copyLogs() {
		if (!logs.length) return;
		navigator.clipboard.writeText(logs.join('\n'));
		isCopied = true;
		setTimeout(() => (isCopied = false), 2000);
	}

	function clearLogs() {
		logs = [];
	}

	function formatTime(iso: string | null) {
		if (!iso) return 'Belum pernah';
		try {
			const d = new Date(iso);
			return d.toLocaleString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		} catch {
			return iso;
		}
	}
</script>

{#if ui.isSyncModalOpen}
	<!-- Backdrop with Instant Blur & Fade -->
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) ui.closeSyncModal();
		}}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Modal Window Box -->
		<div
			class="relative flex w-full max-w-2xl max-h-[92vh] flex-col rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-5 sm:p-6 gap-3.5 animate-in zoom-in-95 duration-150 overflow-hidden"
		>
			<!-- Top Header -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-2xs"
					>
						<RefreshCw class="size-5 {isSyncRunning ? 'animate-spin' : ''}" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h3 class="text-base font-bold text-foreground">
								Sinkronisasi Dokumen Eksternal
							</h3>
						</div>
						<p class="text-xs text-muted-foreground mt-0.5">
							Ekstraksi & indeksasi berkas terpilih untuk basis pengetahuan AI Copilot
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<!-- Live Status Badge -->
					{#if isSyncRunning}
						<Badge
							variant="outline"
							class="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-1"
						>
							<RefreshCw class="size-3 animate-spin" />
							<span>Sedang Berjalan</span>
						</Badge>
					{:else if lastSyncStatus === 'success'}
						<Badge
							variant="outline"
							class="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-1"
						>
							<CheckCircle2 class="size-3" />
							<span>Selesai Sukses</span>
						</Badge>
					{:else if lastSyncStatus === 'aborted'}
						<Badge
							variant="outline"
							class="gap-1.5 border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 py-1"
						>
							<ShieldCheck class="size-3" />
							<span>Dihentikan Aman</span>
						</Badge>
					{:else if lastSyncStatus === 'failed'}
						<Badge
							variant="outline"
							class="gap-1.5 border-destructive/40 bg-destructive/10 text-destructive py-1"
						>
							<AlertCircle class="size-3" />
							<span>Gagal Terakhir</span>
						</Badge>
					{:else}
						<Badge variant="outline" class="gap-1.5 text-muted-foreground py-1">
							<span>Siap Dijalankan</span>
						</Badge>
					{/if}

					<!-- Top Right Close X Button -->
					<Button
						variant="ghost"
						size="icon"
						onclick={() => ui.closeSyncModal()}
						class="size-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
						title="Tutup (Esc)"
						aria-label="Tutup jendela pop up"
					>
						<X class="size-4" />
					</Button>
				</div>
			</div>

			<!-- Resilience Notice Banner (Anti-Putus) -->
			<div class="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground">
				<ShieldCheck class="size-4 text-emerald-500 shrink-0 mt-0.5" />
				<div class="leading-relaxed">
					<strong class="text-foreground">Tahan Putus & Mandiri di Background:</strong> Proses berjalan di sisi server. Anda dapat menutup pop-up atau browser kapan saja tanpa membatalkan sinkronisasi. Checkpoint tersimpan otomatis setiap 20 berkas.
				</div>
			</div>

			<!-- Filter & Mode Collapsible Header -->
			<div class="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-2.5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 text-xs font-semibold text-foreground">
						<SlidersHorizontal class="size-3.5 text-primary" />
						<span>Filter Jenis Dokumen & Mode</span>
					</div>

					<button
						type="button"
						onclick={() => (showFilters = !showFilters)}
						class="text-[11px] font-medium text-primary hover:underline cursor-pointer"
					>
						{showFilters ? 'Tutup Pilihan' : 'Ubah Jenis Dokumen & Mode'}
					</button>
				</div>

				<!-- Selected Types Summary (When collapsed) -->
				{#if !showFilters}
					<div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
						<span>Jenis Aktif:</span>
						{#each selectedTypes as t}
							<Badge variant="secondary" class="uppercase text-[10px] px-1.5 py-0 font-mono">
								.{t}
							</Badge>
						{/each}
						<span class="text-muted-foreground/60">•</span>
						<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
							<Zap class="size-3" />
							{isIncremental ? 'Inkremental (Cepat / Cache)' : 'Full Re-index'}
						</span>
					</div>
				{/if}

				<!-- Expanded Filter Options -->
				{#if showFilters}
					<div class="space-y-3 pt-1 border-t border-border/50 animate-in fade-in duration-150">
						<!-- Document Type Chips -->
						<div>
							<div class="text-[11px] text-muted-foreground mb-1.5">Pilih jenis berkas yang akan diekstrak:</div>
							<div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
								{#each availableDocTypes as dt}
									<button
										type="button"
										onclick={() => toggleType(dt.id)}
										disabled={isSyncRunning}
										class="flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer {selectedTypes.includes(dt.id) ? 'bg-primary/10 border-primary/50 text-foreground shadow-2xs' : 'bg-background/60 border-border text-muted-foreground opacity-60'} disabled:cursor-not-allowed"
									>
										<div class="mt-0.5 size-3.5 rounded border flex items-center justify-center shrink-0 {selectedTypes.includes(dt.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}">
											{#if selectedTypes.includes(dt.id)}
												<Check class="size-2.5 stroke-[3]" />
											{/if}
										</div>
										<div class="min-w-0">
											<div class="text-xs font-semibold leading-tight truncate">{dt.label}</div>
											<div class="text-[10px] text-muted-foreground leading-tight truncate mt-0.5">{dt.desc}</div>
										</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- Sync Mode Selector -->
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
							<span class="text-muted-foreground">Strategi Eksekusi:</span>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => (isIncremental = true)}
									disabled={isSyncRunning}
									class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all {isIncremental ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'bg-background border-border text-muted-foreground'}"
								>
									<Zap class="size-3" />
									<span>Cepat (Inkremental)</span>
								</button>
								<button
									type="button"
									onclick={() => (isIncremental = false)}
									disabled={isSyncRunning}
									class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all {!isIncremental ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400' : 'bg-background border-border text-muted-foreground'}"
								>
									<RefreshCw class="size-3" />
									<span>Penuh (Full Re-index)</span>
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Control Bar -->
			<div
				class="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-muted/40 p-2.5"
			>
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<Clock class="size-3.5 text-primary shrink-0" />
					<span>Terakhir sinkron: <strong>{formatTime(lastSyncTimestamp)}</strong></span>
				</div>

				<div class="flex items-center gap-2">
					<Button
						size="sm"
						variant="outline"
						onclick={copyLogs}
						disabled={!logs.length}
						class="h-8 gap-1.5 text-xs cursor-pointer active:scale-95 transition-transform"
						title="Salin seluruh log ke clipboard"
					>
						{#if isCopied}
							<Check class="size-3.5 text-emerald-500" />
							<span>Tersalin</span>
						{:else}
							<Copy class="size-3.5" />
							<span>Salin Log</span>
						{/if}
					</Button>

					<Button
						size="sm"
						variant="ghost"
						onclick={clearLogs}
						disabled={!logs.length || isSyncRunning}
						class="h-8 size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
						title="Bersihkan log dari tampilan"
					>
						<Trash2 class="size-3.5" />
					</Button>

					{#if isSyncRunning}
						<Button
							size="sm"
							variant="destructive"
							onclick={stopSync}
							class="h-8 gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
							title="Hentikan proses sinkronisasi dengan aman"
						>
							<Square class="size-3 fill-current" />
							<span>Hentikan Sinkron</span>
						</Button>
					{:else}
						<Button
							size="sm"
							onclick={triggerSync}
							class="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95 transition-transform"
						>
							<RefreshCw class="size-3.5" />
							<span>Mulai Sinkron Sekarang</span>
						</Button>
					{/if}
				</div>
			</div>

			<!-- Live Terminal View -->
			<div class="space-y-1.5 flex-1 flex flex-col min-h-0">
				<div class="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1">
					<div class="flex items-center gap-1.5">
						<Terminal class="size-3.5 text-primary" />
						<span>Live Terminal Output</span>
					</div>
					<span class="font-mono text-[10px] text-muted-foreground/70">{logs.length} baris log</span>
				</div>

				<div
					bind:this={terminalEl}
					class="relative h-[250px] w-full overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 font-mono text-[11.5px] leading-relaxed text-zinc-300 shadow-inner select-text"
					role="log"
					aria-live="polite"
				>
					{#if logs.length > 0}
						<div class="space-y-0.5">
							{#each logs as line}
								{#if line.includes('[ERROR]') || line.includes('[FATAL]') || line.includes('Gagal')}
									<div class="text-rose-400 font-medium">{line}</div>
								{:else if line.includes('[SYNC DOCS]') || line.includes('SUKSES') || line.includes('Selesai') || line.includes('Total Terindeks')}
									<div class="text-emerald-400 font-medium">{line}</div>
								{:else if line.startsWith('===')}
									<div class="text-zinc-500">{line}</div>
								{:else if line.includes('Target Folder') || line.includes('Jenis Dokumen')}
									<div class="text-sky-300">{line}</div>
								{:else if line.includes('Progres pemrosesan') || line.includes('dari cache')}
									<div class="text-amber-300 font-mono">{line}</div>
								{:else if line.includes('DIHENTIKAN') || line.includes('Sinyal penghentian')}
									<div class="text-sky-400 font-medium">{line}</div>
								{:else}
									<div class="text-zinc-300">{line}</div>
								{/if}
							{/each}
						</div>
					{:else}
						<div class="flex h-full flex-col items-center justify-center text-center text-zinc-500 text-xs">
							<Terminal class="size-8 opacity-40 mb-2 stroke-[1.5]" />
							<p>Belum ada rekaman log proses.</p>
							<p class="text-[10px] text-zinc-600 mt-0.5">
								Pilih jenis dokumen dan klik tombol "Mulai Sinkron Sekarang".
							</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer Info Metadata -->
			<div
				class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border/60 text-[11px] text-muted-foreground"
			>
				<div class="flex items-center gap-2 truncate">
					<FolderTree class="size-3.5 text-primary shrink-0" />
					<span class="truncate"
						>Otomatis Tengah Malam: <strong>00:00 (Inkremental / Cepat)</strong></span
					>
				</div>
				<div class="flex items-center gap-2 self-end sm:self-auto">
					<Button
						variant="outline"
						size="sm"
						onclick={() => ui.closeSyncModal()}
						class="h-7.5 px-3.5 text-xs cursor-pointer active:scale-95 transition-transform"
					>
						Tutup
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
