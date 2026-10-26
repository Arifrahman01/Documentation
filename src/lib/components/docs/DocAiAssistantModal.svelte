<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
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
	let inputEl = $state<HTMLTextAreaElement | null>(null);
	let currentDocSlug = $state<string>('');
	let sendOnCtrlEnter = $state(false);

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

	$effect(() => {
		const slug = doc?.slug || doc?.path || doc?.id || '';
		if (slug && slug !== currentDocSlug) {
			currentDocSlug = slug;
			messages = [];
			inputQuery = '';
		}
	});

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

	function autoResize() {
		if (!inputEl) return;
		inputEl.style.height = 'auto';
		const nextHeight = Math.min(Math.max(inputEl.scrollHeight, 40), 160);
		inputEl.style.height = `${nextHeight}px`;
	}

	function handleKeydown(e: KeyboardEvent) {
		const isShift = e.shiftKey || (typeof e.getModifierState === 'function' && e.getModifierState('Shift'));
		const isAlt = e.altKey || (typeof e.getModifierState === 'function' && e.getModifierState('Alt'));
		const isCtrl = e.ctrlKey || e.metaKey;

		if (e.key === 'Enter') {
			if (sendOnCtrlEnter) {
				// Mode Ctrl + Enter untuk kirim, Enter biasa untuk baris baru
				if (isCtrl) {
					e.preventDefault();
					e.stopPropagation();
					askDocumentAi();
				} else {
					setTimeout(autoResize, 0);
				}
			} else {
				// Mode Standar: Shift+Enter / Alt+Enter untuk baris baru, Enter biasa untuk kirim
				if (isShift || isAlt) {
					e.preventDefault();
					e.stopPropagation();
					const target = e.currentTarget as HTMLTextAreaElement;
					const start = target.selectionStart ?? target.value.length;
					const end = target.selectionEnd ?? target.value.length;
					const val = target.value;
					inputQuery = val.substring(0, start) + '\n' + val.substring(end);
					setTimeout(() => {
						if (inputEl) {
							inputEl.selectionStart = inputEl.selectionEnd = start + 1;
							autoResize();
						}
					}, 0);
					return;
				}

				// Enter biasa -> Kirim pesan
				e.preventDefault();
				e.stopPropagation();
				askDocumentAi();
			}
		}
	}

	async function askDocumentAi(customPrompt?: string, actionLabel?: string) {
		const query = (customPrompt || inputQuery).trim();
		if (!query || isLoading) return;

		if (!customPrompt) {
			inputQuery = '';
			if (inputEl) inputEl.style.height = '40px';
		}
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
					content: `Gagal menghubungi AI Assistant Dokumen: ${err.message || 'Server tidak merespons'}.`
				}
			];
		} finally {
			isLoading = false;
			setTimeout(() => inputEl?.focus(), 20);
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
		<Card.Root class="relative flex w-full max-w-3xl max-h-[84vh] flex-col overflow-hidden rounded-xl border border-border bg-background py-0 gap-0 text-foreground shadow-2xl">
			<!-- Header: Strictly Scoped to Current Document -->
			<div class="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
				<div class="flex items-center gap-3 min-w-0">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
						<Sparkles class="h-4 w-4" />
					</div>
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-sm font-bold text-foreground">AI Assistant Dokumen</h3>
							<Badge variant="outline" class="gap-1 text-[10px] px-2 py-0">
								<Lock class="h-2.5 w-2.5" />
								<span>Lingkup Terkunci</span>
							</Badge>
						</div>
						<div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
							<FileText class="h-3 w-3 shrink-0" />
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
					<Button
						variant="ghost"
						size="icon"
						onpointerdown={(e) => e.stopPropagation()}
						onclick={closeModal}
						title="Tutup Modal (ESC)"
						aria-label="Tutup AI Assistant Dokumen"
						class="h-8 w-8 text-muted-foreground hover:text-foreground"
					>
						<X class="h-4 w-4 pointer-events-none" />
					</Button>
				</div>
			</div>

			<!-- Quick Document Actions Bar -->
			<div class="border-b border-border bg-muted/30 px-5 py-2.5">
				<div class="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
					<span>Aksi Cepat Dokumen Ini</span>
					<span class="text-[10px] font-normal text-muted-foreground/80">Hanya menganalisis isi catatan ini</span>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
					{#each quickActions as act}
						<Button
							variant="outline"
							size="sm"
							disabled={isLoading}
							onclick={() => askDocumentAi(act.prompt, act.label)}
							class="h-8 justify-start gap-2 px-3 text-xs font-medium"
						>
							<act.icon class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
							<span class="truncate">{act.label}</span>
						</Button>
					{/each}
				</div>
			</div>

			<!-- Analysis & Q&A Output Area -->
			<div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-5 space-y-4 min-h-[240px]">
				{#if messages.length === 0 && !isLoading}
					<div class="flex flex-col items-center justify-center py-8 text-center">
						<div class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground">
							<Sparkles class="h-5 w-5" />
						</div>
						<h4 class="text-sm font-semibold text-foreground">
							Asisten Fokus Dokumen: "{doc?.title}"
						</h4>
						<p class="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
							Berbeda dengan <strong>AI Copilot Global</strong> di pojok kanan atas, asisten ini hanya membaca dan menganalisis isi dokumen <strong>{doc?.title}</strong> agar jawaban tidak tercampur dengan modul lain.
						</p>
						<div class="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
							<Badge variant="secondary" class="font-normal px-3 py-1">
								Pilih salah satu Aksi Cepat di atas atau ketik pertanyaan spesifik di bawah
							</Badge>
						</div>
					</div>
				{/if}

				{#each messages as msg, idx}
					{#if msg.role === 'user'}
						<div class="flex justify-end">
							<div class="max-w-[85%] rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground shadow-2xs">
								{msg.content}
							</div>
						</div>
					{:else}
						<Card.Root class="p-4 py-4 gap-0 shadow-2xs">
							<div class="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
									<Sparkles class="h-3.5 w-3.5 text-muted-foreground" />
									<span>{msg.label || 'Hasil Analisis Dokumen'}</span>
								</div>
								<div class="flex items-center gap-1">
									{#if onPinToArticle}
										<Button
											variant="outline"
											size="sm"
											onclick={() => handlePin(msg.content, msg.label)}
											title="Sematkan hasil ini di atas artikel agar bisa dibaca sambil scroll dokumen"
											class="h-7 gap-1 px-2 text-[11px]"
										>
											<Pin class="h-3 w-3" />
											<span>Sematkan di Artikel</span>
										</Button>
									{/if}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => copyReply(msg.content, idx)}
										title="Salin hasil"
										class="h-7 gap-1 px-2 text-[11px]"
									>
										{#if copiedIdx === idx}
											<Check class="h-3 w-3" />
											<span>Tersalin</span>
										{:else}
											<Copy class="h-3 w-3" />
											<span>Salin</span>
										{/if}
									</Button>
								</div>
							</div>

							<div class="prose prose-xs dark:prose-invert max-w-none text-[12.5px] leading-relaxed [&>p]:text-[12.5px] [&>p]:leading-relaxed [&>li]:text-[12.5px] [&>h1]:text-[13.5px] [&>h2]:text-[13px] [&>h3]:text-[12.5px] [&>pre]:text-[11px] [&>code]:text-[11px]">
								{@html renderMarkdown(msg.content)}
							</div>
						</Card.Root>
					{/if}
				{/each}

				{#if isLoading}
					<div class="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
						<Loader2 class="h-4 w-4 animate-spin shrink-0" />
						<span>Menganalisis isi dokumen <strong>"{doc?.title}"</strong>...</span>
					</div>
				{/if}
			</div>

			<!-- Input Footer -->
			<div class="border-t border-border bg-muted/20 px-5 py-3">
				<div class="flex items-end gap-2">
					<div class="relative flex-1">
						<MessageSquare class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
						<textarea
							bind:this={inputEl}
							bind:value={inputQuery}
							onkeydown={handleKeydown}
							oninput={autoResize}
							rows={1}
							placeholder="Tanyakan apa saja di panduan modul '{doc?.title}' untuk kendala Helpdesk..."
							class="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-40 resize-none overflow-y-auto block whitespace-pre-wrap"
						></textarea>
					</div>
					<Button
						type="button"
						size="sm"
						onclick={() => askDocumentAi()}
						disabled={!inputQuery.trim() || isLoading}
						class="h-10 gap-1.5 px-4 text-xs font-semibold shrink-0"
					>
						<Send class="h-3.5 w-3.5" />
						<span>Tanya Modul</span>
					</Button>
				</div>
				<div class="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
					<span>
						{#if sendOnCtrlEnter}
							Tekan <kbd class="rounded border px-1 py-0.5 font-mono text-[9px]">Ctrl + Enter</kbd> untuk kirim, <kbd class="rounded border px-1 py-0.5 font-mono text-[9px]">Enter</kbd> untuk baris baru
						{:else}
							Tekan <kbd class="rounded border px-1 py-0.5 font-mono text-[9px]">Enter</kbd> untuk kirim, <kbd class="rounded border px-1 py-0.5 font-mono text-[9px]">Shift + Enter</kbd> untuk baris baru
						{/if}
					</span>
					<button
						type="button"
						onclick={() => (sendOnCtrlEnter = !sendOnCtrlEnter)}
						class="text-[10px] text-primary hover:underline cursor-pointer ml-2 shrink-0 font-medium"
					>
						{sendOnCtrlEnter ? 'Ubah: Enter kirim' : 'Ubah: Ctrl+Enter kirim'}
					</button>
				</div>
			</div>
		</Card.Root>
	</div>
{/if}
