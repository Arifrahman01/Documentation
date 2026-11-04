<script lang="ts">
	import { onMount } from 'svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
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
		Check,
		Lock,
		RotateCcw,
		FileText,
		ExternalLink
	} from '@lucide/svelte';

	interface SourceItem {
		title: string;
		url: string;
		category: string;
		type: 'SYNC_DOC' | 'USER_NOTE' | 'PORTAL_DOC';
		badge: string;
		fileUrl?: string;
	}

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		sources?: SourceItem[];
	}

	const WELCOME_MESSAGE =
		'Halo! Saya adalah **AI Copilot**. Silakan tanyakan apa saja terkait dokumentasi modul, catatan teknis, atau kendala sistem Anda.';

	const quickSuggestions = [
		'Apa saja isi note yang ada di program ini?',
		'Ringkasan status tiket di database Helpdesk',
		'Jelaskan panduan SAP RAP dari note saya',
		'Dokumen apa saja yang sudah disinkronkan?'
	];

	let messages = $state<Message[]>([
		{
			role: 'assistant',
			content: WELCOME_MESSAGE
		}
	]);

	let inputQuery = $state('');
	let isLoading = $state(false);
	let isStreamingText = $state(false);
	let activeAbortController: AbortController | null = null;
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLTextAreaElement | null>(null);
	let copiedIndex = $state<number | null>(null);
	let sendOnCtrlEnter = $state(false);

	$effect(() => {
		if (ui.isAiOpen) {
			auth.refresh();
			setTimeout(() => inputEl?.focus(), 60);
			if (ui.aiInitialPrompt) {
				const prompt = ui.aiInitialPrompt;
				ui.aiInitialPrompt = '';
				if (auth.isAuthenticated) {
					sendMessage(prompt);
				}
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

	function stopStreaming() {
		if (activeAbortController) {
			activeAbortController.abort();
			activeAbortController = null;
		}
		isLoading = false;
		isStreamingText = false;
	}

	async function sendMessage(textToSend?: string) {
		const query = (textToSend || inputQuery).trim();
		if (!query || isLoading) return;

		auth.refresh();
		if (!auth.isAuthenticated) {
			messages = [
				...messages,
				{
					role: 'assistant',
					content:
						'🔒 **Akses AI Memerlukan Sesi Login**\n\nSesi login tidak ditemukan. Silakan **login terlebih dahulu di aplikasi Helpdesk** untuk menggunakan fitur AI Copilot.'
				}
			];
			return;
		}

		inputQuery = '';
		if (inputEl) {
			inputEl.style.height = '40px';
		}
		const priorHistory = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
		messages = [...messages, { role: 'user', content: query }];
		isLoading = true;
		isStreamingText = false;
		const controller = new AbortController();
		activeAbortController = controller;

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'text/event-stream, application/json'
				},
				signal: controller.signal,
				body: JSON.stringify({
					query: query,
					documentContext: ui.currentContext.snippet || '',
					currentRoute: ui.currentContext.title || '',
					history: priorHistory,
					stream: true
				})
			});

			const contentType = (res.headers.get('content-type') || '').toLowerCase();

			if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
				const data = await res.json().catch(() => ({}));

				if (res.status === 401 || data?.requiresLogin) {
					auth.refresh();
					messages = [
						...messages,
						{
							role: 'assistant',
							content:
								data?.reply ||
								'🔒 **Akses AI Memerlukan Sesi Login**\n\nSesi login tidak ditemukan. Silakan **login terlebih dahulu di aplikasi Helpdesk** untuk menggunakan fitur AI Copilot.'
						}
					];
					return;
				}

				if (!res.ok) {
					throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
				}

				const reply =
					data.reply || data.response || data.message || 'Maaf, tidak ada jawaban dari server AI.';
				const sources: SourceItem[] = Array.isArray(data.sources) ? data.sources : [];

				messages = [...messages, { role: 'assistant', content: reply, sources }];
				return;
			}

			// SSE Streaming Mode: tampilkan token secara bertahap begitu tiba
			messages = [...messages, { role: 'assistant', content: '', sources: [] }];
			const assistantIdx = messages.length - 1;
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let sseBuffer = '';

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				sseBuffer += decoder.decode(value, { stream: true });
				const lines = sseBuffer.split(/\r?\n/);
				sseBuffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith('data:')) continue;
					const rawPayload = trimmed.slice(5).trim();
					if (!rawPayload || rawPayload === '[DONE]') continue;

					let evt: any;
					try {
						evt = JSON.parse(rawPayload);
					} catch {
						continue;
					}

					if (evt.type === 'delta' && evt.content) {
						isStreamingText = true;
						messages[assistantIdx].content += evt.content;
						messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight });
					} else if (evt.type === 'done') {
						if (evt.reply && !messages[assistantIdx].content) {
							messages[assistantIdx].content = evt.reply;
						}
						if (Array.isArray(evt.sources)) {
							messages[assistantIdx].sources = evt.sources;
						}
					} else if (evt.type === 'error') {
						throw new Error(evt.error || 'Gagal memproses aliran respons AI');
					}
				}
			}

			if (!messages[assistantIdx].content.trim()) {
				messages[assistantIdx].content = 'Maaf, tidak ada jawaban dari server AI.';
			}
		} catch (err: any) {
			if (err?.name === 'AbortError') return;
			const errMsg = `Terjadi kendala saat menghubungi AI Copilot: ${err.message || 'Server offline'}. Pastikan endpoint AI lokal aktif.`;
			const lastMsg = messages[messages.length - 1];
			if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content.trim()) {
				lastMsg.content = errMsg;
			} else {
				messages = [
					...messages,
					{
						role: 'assistant',
						content: errMsg
					}
				];
			}
		} finally {
			activeAbortController = null;
			isLoading = false;
			isStreamingText = false;
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
				content: WELCOME_MESSAGE
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
				{#if !auth.isAuthenticated}
					<div class="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-foreground shadow-xs space-y-3">
						<div class="flex items-start gap-3.5">
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400">
								<Lock class="h-5 w-5" />
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
									<h4 class="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
										Sesi Login Diperlukan
									</h4>
								</div>
								<p class="text-xs font-semibold text-foreground">
									Fitur AI hanya dapat digunakan oleh pengguna yang memiliki sesi aktif.
								</p>
								<p class="text-[11.5px] leading-relaxed text-muted-foreground">
									Silakan <strong>login terlebih dahulu di aplikasi Helpdesk</strong> menggunakan akun Anda, lalu kembali ke halaman ini atau klik tombol di bawah untuk memuat ulang sesi.
								</p>
							</div>
						</div>
						<div class="flex items-center justify-end gap-2 pt-1">
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									auth.refresh();
									if (!auth.isAuthenticated && typeof window !== 'undefined') {
										window.location.reload();
									}
								}}
								class="h-8 gap-1.5 text-xs font-semibold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 cursor-pointer"
							>
								<RotateCcw class="h-3.5 w-3.5" />
								<span>Cek Ulang Sesi Login</span>
							</Button>
						</div>
					</div>
				{/if}

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
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									onclick={(e) => {
										const anchor = (e.target as HTMLElement | null)?.closest('a');
										const href = anchor?.getAttribute('href') || '';
										if (href.startsWith('/docs/') || href.startsWith('/my-docs/')) {
											ui.closeAi();
										}
									}}
									class="prose prose-xs dark:prose-invert max-w-none break-words text-[12px] leading-relaxed [&>p]:text-[12px] [&>p]:leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:my-1.5 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:my-1.5 [&>li]:text-[12px] [&>li]:leading-relaxed [&>li]:my-0.5 [&>h1]:text-[13px] [&>h1]:font-bold [&>h1]:mb-1.5 [&>h1]:mt-2 [&>h2]:text-[12.5px] [&>h2]:font-bold [&>h2]:mb-1.5 [&>h2]:mt-2 [&>h3]:text-[12px] [&>h3]:font-bold [&>h3]:mb-1 [&>h3]:mt-1.5 [&>h4]:text-[12px] [&>h4]:font-semibold [&>pre]:my-2 [&>pre]:p-2.5 [&>pre]:text-[11px] [&>pre]:rounded-lg [&>pre]:bg-zinc-950 [&>pre]:text-zinc-100 [&>code]:bg-muted [&>code]:text-[11px] [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:font-medium"
								>
									{@html sanitizeRenderedHtml(marked.parse(msg.content) as string)}
								</div>

								{#if msg.sources && msg.sources.length > 0}
									<div class="mt-3 pt-2.5 border-t border-border/70 space-y-1.5">
										<div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
											<FileText class="h-3 w-3 text-primary" />
											<span>Sumber Dokumen (Klik untuk membuka):</span>
										</div>
										<div class="flex flex-col gap-1.5">
											{#each msg.sources as src}
												<div class="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/80 hover:bg-background hover:border-primary/40 px-2.5 py-1.5 transition-colors">
													<a
														href={src.url}
														onclick={() => ui.closeAi()}
														class="flex items-center gap-2 min-w-0 flex-1 text-left group/link"
														title="Buka dokumen: {src.title}"
													>
														<FileText class="h-3.5 w-3.5 shrink-0 text-primary" />
														<div class="min-w-0 flex-1">
															<div class="text-[11px] font-semibold text-foreground group-hover/link:text-primary group-hover/link:underline truncate">
																{src.title}
															</div>
															<div class="text-[9.5px] text-muted-foreground truncate">
																{src.badge} • {src.category}
															</div>
														</div>
														<ExternalLink class="h-3 w-3 shrink-0 text-muted-foreground group-hover/link:text-primary" />
													</a>
													{#if src.fileUrl}
														<a
															href={src.fileUrl}
															target="_blank"
															rel="noopener noreferrer"
															class="shrink-0 rounded border border-border bg-muted/60 hover:bg-muted px-1.5 py-0.5 text-[9.5px] font-medium text-foreground transition-colors"
															title="Buka / Unduh berkas asli ({src.title})"
														>
															Berkas Asli
														</a>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}
								
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

				{#if messages.length === 1 && !isLoading && auth.isAuthenticated}
					<div class="pl-10 space-y-1.5">
						<div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							Contoh Pertanyaan Cepat:
						</div>
						<div class="flex flex-wrap gap-1.5">
							{#each quickSuggestions as suggestion}
								<button
									type="button"
									onclick={() => sendMessage(suggestion)}
									class="rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1.5 text-left text-[11px] text-foreground transition-colors cursor-pointer active:scale-95"
								>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if isLoading && !isStreamingText}
					<div class="flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-foreground">
								<Bot class="h-4 w-4" />
							</div>
							<div class="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground border border-border">
								<Loader2 class="h-3.5 w-3.5 animate-spin" />
								<span>Mencari di dokumen, note & database Helpdesk...</span>
							</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							onclick={stopStreaming}
							class="h-7 px-2.5 text-[11px]"
						>
							Hentikan
						</Button>
					</div>
				{:else if isLoading && isStreamingText}
					<div class="flex justify-end">
						<Button
							variant="outline"
							size="sm"
							onclick={stopStreaming}
							class="h-7 gap-1.5 px-2.5 text-[11px]"
						>
							<Loader2 class="h-3 w-3 animate-spin" />
							<span>Hentikan Streaming</span>
						</Button>
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
							disabled={!auth.isAuthenticated}
							rows={1}
							placeholder={auth.isAuthenticated
								? 'Tanyakan isi dokumen sinkronisasi, isi note, atau database Helpdesk...'
								: 'Silakan login terlebih dahulu di aplikasi Helpdesk untuk menggunakan AI Copilot...'}
							class="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-10 text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-40 resize-none overflow-y-auto block whitespace-pre-wrap disabled:cursor-not-allowed disabled:opacity-60"
						></textarea>
						<Button
							size="icon"
							onclick={() => sendMessage()}
							disabled={!auth.isAuthenticated || !inputQuery.trim() || isLoading}
							class="absolute right-1.5 bottom-1.5 h-7 w-7"
							title={auth.isAuthenticated ? 'Kirim pesan' : 'Login terlebih dahulu di Helpdesk'}
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
