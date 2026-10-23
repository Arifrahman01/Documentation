<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import {
		Sparkles,
		X,
		Send,
		FileText,
		Lock,
		Loader2,
		Copy,
		Check,
		Trash2,
		Pin,
		ListChecks,
		Cpu,
		BookOpen,
		Zap,
		MessageSquare
	} from '@lucide/svelte';

	interface DocMessage {
		role: 'user' | 'assistant';
		content: string;
		label?: string;
	}

	interface Props {
		isOpen: boolean;
		doc: any;
		initialPrompt?: string;
		onPinToArticle?: (content: string, title: string) => void;
	}

	let {
		isOpen = $bindable(false),
		doc,
		initialPrompt = '',
		onPinToArticle
	}: Props = $props();

	let messages = $state<DocMessage[]>([]);
	let inputQuery = $state('');
	let isLoading = $state(false);
	let copiedIdx = $state<number | null>(null);
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let currentDocSlug = $state<string>('');

	const quickActions = [
		{
			id: 'tldr',
			label: 'Ringkasan Eksekutif',
			icon: Zap,
			prompt: 'Buatkan Ringkasan Eksekutif (TL;DR) dan poin-poin utama dari dokumen ini secara padat dan terstruktur.'
		},
		{
			id: 'tech',
			label: 'Bedah Teknis / Rumus',
			icon: Cpu,
			prompt: 'Jelaskan secara rinci arsitektur teknis, konfigurasi, rumus perhitungan, atau potongan kode yang tertulis di dalam dokumen ini.'
		},
		{
			id: 'checklist',
			label: 'Checklist Langkah Kerja',
			icon: ListChecks,
			prompt: 'Susun daftar langkah kerja (Actionable Checklist) berurutan berdasarkan panduan yang ada di dalam dokumen ini.'
		},
		{
			id: 'glossary',
			label: 'Daftar Istilah Penting',
			icon: BookOpen,
			prompt: 'identifikasi dan jelaskan istilah-istilah teknis, parameter, T-Code, atau komponen penting yang disebutkan dalam dokumen ini.'
		}
	];

	// Reset conversation whenever user switches to a different document so scope stays 100% isolated
	$effect(() => {
		const slug = doc?.slug || doc?.path || doc?.id || '';
		if (slug && slug !== currentDocSlug) {
			currentDocSlug = slug;
			messages = [];
			inputQuery = '';
		}
	});

	// Focus input or trigger initialPrompt when modal opens
	$effect(() => {
		if (isOpen) {
			setTimeout(() => inputEl?.focus(), 60);
			if (initialPrompt && initialPrompt.trim()) {
				const p = initialPrompt;
				askDocumentAi(p);
			}
		}
	});

	$effect(() => {
		if (messages.length && scrollContainer) {
			setTimeout(() => {
				scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
			}, 50);
		}
	});

	function closeModal(e?: Event) {
		if (e) e.stopPropagation();
		isOpen = false;
	}

	async function askDocumentAi(customPrompt?: string, actionLabel?: string) {
		const query = (customPrompt || inputQuery).trim();
		if (!query || isLoading) return;

		if (!customPrompt) inputQuery = '';
		messages = [...messages, { role: 'user', content: query, label: actionLabel }];
		isLoading = true;

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query,
					strictDocScope: true,
					docMeta: {
						title: doc?.title || 'Dokumen Aktif',
						section: doc?.section || 'SAP',
						category: doc?.category || 'General',
						slug: doc?.slug || doc?.path || ''
					},
					documentContext: doc?.content || doc?.description || '',
					currentRoute: doc?.title || '',
					history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
				})
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data = await res.json();
			const reply =
				data.reply || data.message || 'Maaf, tidak dapat menghasilkan analisis untuk dokumen ini.';

			messages = [...messages, { role: 'assistant', content: reply, label: actionLabel }];
		} catch (err: any) {
			messages = [
				...messages,
				{
					role: 'assistant',
					content: `⚠️ Gagal menghubungi AI Assistant Dokumen: ${err.message || 'Server tidak merespons'}.`
				}
			];
		} finally {
			isLoading = false;
		}
	}

	function copyReply(text: string, idx: number) {
		if (typeof window !== 'undefined') {
			navigator.clipboard.writeText(text);
			copiedIdx = idx;
			setTimeout(() => (copiedIdx = null), 2000);
		}
	}

	function handlePin(content: string, label?: string) {
		if (onPinToArticle) {
			onPinToArticle(content, label || `Analisis AI: ${doc?.title || 'Dokumen'}`);
			isOpen = false;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && isOpen) {
			closeModal(e);
		}
	}}
/>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-3 pt-[6vh] sm:p-6 sm:pt-[8vh] backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModal(e);
		}}
		role="dialog"
		aria-modal="true"
		aria-label="AI Assistant Khusus Dokumen"
		tabindex="-1"
	>
		<div class="relative flex w-full max-w-3xl max-h-[84vh] flex-col overflow-hidden rounded-2xl border border-indigo-500/30 bg-background text-foreground shadow-2xl ring-1 ring-indigo-500/20">
			<!-- Header: Strictly Scoped to Current Document -->
			<div class="flex items-center justify-between border-b border-border bg-gradient-to-r from-indigo-950/40 via-purple-950/25 to-background px-5 py-3.5">
				<div class="flex items-center gap-3 min-w-0">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
						<Sparkles class="h-4 w-4" />
					</div>
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-sm font-bold text-foreground">AI Assistant Dokumen</h3>
							<Badge variant="outline" class="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0">
								<Lock class="h-2.5 w-2.5" />
								<span>Lingkup Terkunci</span>
							</Badge>
						</div>
						<div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
							<FileText class="h-3 w-3 text-indigo-500 shrink-0" />
							<span class="font-semibold text-foreground truncate">{doc?.title || 'Dokumen Aktif'}.md</span>
							<span>•</span>
							<span class="text-[11px]">{doc?.section || 'SAP'} / {doc?.category || 'General'}</span>
						</div>
					</div>
				</div>

				<div class="flex items-center gap-1.5 shrink-0">
					{#if messages.length > 0}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (messages = [])}
							title="Reset analisis dokumen ini"
							class="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
						>
							<Trash2 class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">Reset</span>
						</Button>
					{/if}
					<button
						type="button"
						onpointerdown={(e) => e.stopPropagation()}
						onclick={closeModal}
						title="Tutup Modal (ESC)"
						aria-label="Tutup AI Assistant Dokumen"
						class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-500"
					>
						<X class="h-4 w-4 pointer-events-none" />
					</button>
				</div>
			</div>

			<!-- Quick Document Actions Bar (Notion AI Style) -->
			<div class="border-b border-border bg-muted/40 px-5 py-2.5">
				<div class="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
					<span>Aksi Cepat Dokumen Ini</span>
					<span class="text-[10px] font-normal text-muted-foreground/80">Hanya menganalisis isi catatan ini</span>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
					{#each quickActions as act}
						<button
							type="button"
							disabled={isLoading}
							onclick={() => askDocumentAi(act.prompt, act.label)}
							class="flex items-center gap-2 rounded-xl border border-border bg-background/90 px-3 py-2 text-left text-xs font-medium text-foreground shadow-2xs transition-all hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 disabled:opacity-50"
						>
							<act.icon class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
							<span class="truncate">{act.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Analysis & Q&A Output Area -->
			<div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-5 space-y-4 min-h-[240px]">
				{#if messages.length === 0 && !isLoading}
					<div class="flex flex-col items-center justify-center py-8 text-center">
						<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
							<Sparkles class="h-6 w-6" />
						</div>
						<h4 class="text-sm font-semibold text-foreground">
							Asisten Fokus Dokumen: "{doc?.title}"
						</h4>
						<p class="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
							Berbeda dengan <strong>AI Copilot Global</strong> di pojok kanan atas, asisten ini hanya membaca dan menganalisis isi dokumen <strong>{doc?.title}</strong> agar jawaban tidak tercampur dengan modul lain.
						</p>
						<div class="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
							<span class="rounded-full border border-border bg-muted/50 px-3 py-1">
								💡 Pilih salah satu <strong>Aksi Cepat</strong> di atas atau ketik pertanyaan spesifik di bawah
							</span>
						</div>
					</div>
				{/if}

				{#each messages as msg, idx}
					{#if msg.role === 'user'}
						<div class="flex justify-end">
							<div class="max-w-[85%] rounded-2xl rounded-br-xs bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white shadow-xs">
								{msg.content}
							</div>
						</div>
					{:else}
						<div class="rounded-2xl border border-border bg-card p-4 shadow-xs">
							<div class="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
									<Sparkles class="h-3.5 w-3.5" />
									<span>{msg.label || 'Hasil Analisis Dokumen'}</span>
								</div>
								<div class="flex items-center gap-1">
									{#if onPinToArticle}
										<button
											type="button"
											onclick={() => handlePin(msg.content, msg.label)}
											title="Sematkan hasil ini di atas artikel agar bisa dibaca sambil scroll dokumen"
											class="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors"
										>
											<Pin class="h-3 w-3" />
											<span>Sematkan di Artikel</span>
										</button>
									{/if}
									<button
										type="button"
										onclick={() => copyReply(msg.content, idx)}
										title="Salin hasil"
										class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
									>
										{#if copiedIdx === idx}
											<Check class="h-3 w-3 text-emerald-500" />
											<span class="text-emerald-500">Tersalin</span>
										{:else}
											<Copy class="h-3 w-3" />
											<span>Salin</span>
										{/if}
									</button>
								</div>
							</div>

							<div class="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
								{@html renderMarkdown(msg.content)}
							</div>
						</div>
					{/if}
				{/each}

				{#if isLoading}
					<div class="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
						<Loader2 class="h-4 w-4 animate-spin text-indigo-500 shrink-0" />
						<span>Menganalisis isi dokumen <strong>"{doc?.title}"</strong>...</span>
					</div>
				{/if}
			</div>

			<!-- Input Footer -->
			<div class="border-t border-border bg-muted/30 px-5 py-3.5">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						askDocumentAi();
					}}
					class="flex items-center gap-2"
				>
					<div class="relative flex-1">
						<MessageSquare class="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
						<Input
							bind:ref={inputEl}
							type="text"
							bind:value={inputQuery}
							disabled={isLoading}
							placeholder="Tanyakan apa saja yang ada di dalam dokumen '{doc?.title}'..."
							class="h-10 rounded-xl pl-9 pr-4 text-xs"
						/>
					</div>
					<Button
						type="submit"
						size="sm"
						disabled={!inputQuery.trim() || isLoading}
						class="h-10 gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"
					>
						<Send class="h-3.5 w-3.5" />
						<span>Tanya Dokumen</span>
					</Button>
				</form>
			</div>
		</div>
	</div>
{/if}
