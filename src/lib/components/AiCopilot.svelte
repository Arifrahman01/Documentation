<script lang="ts">
	import { onMount } from 'svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { marked } from 'marked';
	import { sanitizeRenderedHtml } from '$lib/utils/markdown';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Sparkles, 
		X, 
		Send, 
		Trash2, 
		Bot, 
		User, 
		Loader2, 
		Copy, 
		Check
	} from '@lucide/svelte';

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	let messages = $state<Message[]>([
		{
			role: 'assistant',
			content: 'Halo! Saya adalah **AI Copilot**, asisten terpadu untuk Helpdesk & Knowledge Base Dokumen Enterprise.\n\nKarena sistem dokumentasi ini terintegrasi penuh dengan Helpdesk, Anda dapat menanyakan:\n• Panduan teknis & SOP modul (SAP, SAC, FMS, Web, dll.)\n• Kendala sistem atau status tiket Helpdesk\n• Solusi penanganan masalah (*troubleshooting*) dan perangkuman dokumen\n\nSilakan ketik pertanyaan atau kendala yang ingin Anda konsultasikan!'
		}
	]);

	let inputQuery = $state('');
	let isLoading = $state(false);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLTextAreaElement | null>(null);
	let copiedIndex = $state<number | null>(null);
	let sendOnCtrlEnter = $state(false);

	$effect(() => {
		if (ui.isAiOpen) {
			setTimeout(() => inputEl?.focus(), 60);
			if (ui.aiInitialPrompt) {
				const prompt = ui.aiInitialPrompt;
				ui.aiInitialPrompt = '';
				sendMessage(prompt);
			}
		}
	});

	$effect(() => {
		if (messages.length && messagesContainer) {
			setTimeout(() => {
				messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
			}, 50);
		}
	});

	function autoResize() {
		if (!inputEl) return;
		inputEl.style.height = 'auto';
		const nextHeight = Math.min(Math.max(inputEl.scrollHeight, 40), 160);
		inputEl.style.height = `${nextHeight}px`;
	}

	async function sendMessage(textToSend?: string) {
		const query = (textToSend || inputQuery).trim();
		if (!query || isLoading) return;

		inputQuery = '';
		if (inputEl) {
			inputEl.style.height = '40px';
		}
		messages = [...messages, { role: 'user', content: query }];
		isLoading = true;

		try {
			const systemContext = `Konteks pengguna saat ini: Tipe: ${ui.currentContext.type}, Judul Halaman: ${ui.currentContext.title || 'Overview'}.`;
			
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: query,
					context: systemContext,
					documentContext: ui.currentContext.snippet || '',
					currentRoute: ui.currentContext.title || '',
					history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
				})
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data = await res.json();
			const reply = data.reply || data.response || data.message || 'Maaf, tidak ada jawaban dari server AI.';

			messages = [...messages, { role: 'assistant', content: reply }];
		} catch (err: any) {
			messages = [
				...messages,
				{
					role: 'assistant',
					content: `Terjadi kendala saat menghubungi AI Copilot: ${err.message || 'Server offline'}. Pastikan endpoint AI lokal aktif.`
				}
			];
		} finally {
			isLoading = false;
			setTimeout(() => inputEl?.focus(), 20);
		}
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
					sendMessage();
				} else {
					// Enter biasa -> biarkan buat baris baru secara alami, lalu sesuaikan tinggi
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
				sendMessage();
			}
		}
	}

	function clearChat() {
		messages = [
			{
				role: 'assistant',
				content: 'Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru mengenai dokumentasi atau aplikasi!'
			}
		];
	}

	function copyMessage(text: string, index: number) {
		navigator.clipboard.writeText(text);
		copiedIndex = index;
		setTimeout(() => (copiedIndex = null), 2000);
	}
	onMount(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const isJ = e.key.toLowerCase() === 'j' || e.code === 'KeyJ';
			if (((e.ctrlKey || e.metaKey) || e.altKey) && isJ) {
				e.preventDefault();
				e.stopPropagation();
				if (ui.isAiOpen) ui.closeAi();
				else ui.openAi();
			} else if (e.key === 'Escape' && ui.isAiOpen) {
				e.preventDefault();
				ui.closeAi();
			}
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	});
</script>

<!-- Floating Trigger Pill (Bottom Right - Mobile Only since Desktop Header already has AI Copilot button) -->
{#if !ui.isAiOpen}
	<Button
		onclick={() => ui.openAi()}
		class="fixed bottom-5 right-5 z-40 h-10 gap-2 rounded-full px-4 text-xs font-semibold shadow-xl md:hidden"
		aria-label="Buka AI Copilot"
	>
		<Sparkles class="h-3.5 w-3.5" />
		<span>AI Copilot</span>
	</Button>
{/if}

<!-- Slide-over Drawer -->
{#if ui.isAiOpen}
	<!-- Backdrop -->
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity"
		onclick={(e) => { if (e.target === e.currentTarget) ui.closeAi(); }}
		onkeydown={(e) => { if (e.key === 'Escape') ui.closeAi(); }}
		tabindex="-1"
	>
		<!-- Drawer Panel -->
		<div class="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border px-5 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
						<Sparkles class="h-4 w-4" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-semibold text-foreground">AI Copilot</h3>
							<Badge variant="secondary" class="text-[10px]">
								Helpdesk Knowledge Base
							</Badge>
						</div>
						<p class="text-xs text-muted-foreground">Asisten Helpdesk, panduan dokumen & solusi sistem</p>
					</div>
				</div>

				<div class="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onclick={clearChat}
						title="Bersihkan chat"
						aria-label="Bersihkan riwayat chat"
						class="h-8 w-8 text-muted-foreground"
					>
						<Trash2 class="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onclick={() => ui.closeAi()}
						title="Tutup (ESC)"
						aria-label="Tutup AI Copilot"
						class="h-8 w-8 text-muted-foreground"
					>
						<X class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Context Indicator Banner -->
			<div class="border-b border-border bg-muted/30 px-5 py-2 text-[11px] text-muted-foreground">
				<div class="flex items-center gap-2 font-medium">
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-foreground/70"></span>
					<span>Konteks: <strong>{ui.currentContext.title || 'Portal Dokumentasi'}</strong></span>
				</div>
			</div>

			<!-- Messages Scroll Container -->
			<div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-5 space-y-4">
				{#each messages as msg, idx}
					<div class="flex gap-3 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						{#if msg.role === 'assistant'}
							<div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
								<Bot class="h-4 w-4" />
							</div>
						{/if}

						<div class="group relative max-w-[85%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed {msg.role === 'user'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted/60 text-foreground border border-border'}">
							
							{#if msg.role === 'assistant'}
								<div class="prose prose-xs dark:prose-invert max-w-none break-words text-[12px] leading-relaxed [&>p]:text-[12px] [&>p]:leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:my-1.5 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:my-1.5 [&>li]:text-[12px] [&>li]:leading-relaxed [&>li]:my-0.5 [&>h1]:text-[13px] [&>h1]:font-bold [&>h1]:mb-1.5 [&>h1]:mt-2 [&>h2]:text-[12.5px] [&>h2]:font-bold [&>h2]:mb-1.5 [&>h2]:mt-2 [&>h3]:text-[12px] [&>h3]:font-bold [&>h3]:mb-1 [&>h3]:mt-1.5 [&>h4]:text-[12px] [&>h4]:font-semibold [&>pre]:my-2 [&>pre]:p-2.5 [&>pre]:text-[11px] [&>pre]:rounded-lg [&>pre]:bg-zinc-950 [&>pre]:text-zinc-100 [&>code]:bg-muted [&>code]:text-[11px] [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>strong]:font-semibold">
									{@html sanitizeRenderedHtml(marked.parse(msg.content) as string)}
								</div>
								
								<Button
									variant="ghost"
									size="icon"
									onclick={() => copyMessage(msg.content, idx)}
									class="absolute right-1.5 top-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
									title="Salin jawaban"
									aria-label="Salin jawaban AI"
								>
									{#if copiedIndex === idx}
										<Check class="h-3 w-3" />
									{:else}
										<Copy class="h-3 w-3" />
									{/if}
								</Button>
							{:else}
								<div class="whitespace-pre-wrap text-[12px] leading-relaxed">{msg.content}</div>
							{/if}
						</div>

						{#if msg.role === 'user'}
							<div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
								<User class="h-4 w-4" />
							</div>
						{/if}
					</div>
				{/each}

				{#if isLoading}
					<div class="flex items-center gap-3">
						<div class="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-foreground">
							<Bot class="h-4 w-4" />
						</div>
						<div class="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground border border-border">
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Menyiapkan jawaban cerdas...</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Input Form -->
			<div class="border-t border-border p-4">
				<div class="relative flex items-end gap-2">
					<div class="relative flex-1">
						<textarea
							bind:this={inputEl}
							bind:value={inputQuery}
							onkeydown={handleKeydown}
							oninput={autoResize}
							rows={1}
							placeholder="Tanyakan kendala, status tiket, atau panduan modul Helpdesk..."
							class="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-40 resize-none overflow-y-auto block whitespace-pre-wrap"
						></textarea>
						<Button
							size="icon"
							onclick={() => sendMessage()}
							disabled={!inputQuery.trim() || isLoading}
							class="absolute right-1.5 bottom-1.5 h-7 w-7"
							title="Kirim pesan"
							aria-label="Kirim pesan ke AI Copilot"
						>
							<Send class="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
				<div class="mt-2 flex items-center justify-between text-[10px] text-muted-foreground px-1">
					<span>
						{#if sendOnCtrlEnter}
							Tekan <Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">Ctrl + Enter</Badge> untuk kirim, <Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">Enter</Badge> untuk baris baru
						{:else}
							Tekan <Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">Enter</Badge> untuk kirim, <Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">Shift + Enter</Badge> untuk baris baru
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
		</div>
	</div>
{/if}
