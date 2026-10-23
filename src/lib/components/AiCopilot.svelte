<script lang="ts">
	import { onMount } from 'svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { marked } from 'marked';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
		ArrowRight
	} from '@lucide/svelte';

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	let messages = $state<Message[]>([
		{
			role: 'assistant',
			content: 'Halo! Saya adalah **AI Copilot**, asisten resmi untuk Portal Dokumentasi & Program Navigator Enterprise.\n\nSaya siap membantu Anda memahami arsitektur sistem, navigasi 7 aplikasi enterprise, implementasi kode teknis, maupun merangkum dokumen yang sedang dibuka.\n\nSilakan pilih salah satu pertanyaan cepat di bawah atau ketik pertanyaan Anda!'
		}
	]);

	let inputQuery = $state('');
	let isLoading = $state(false);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let copiedIndex = $state<number | null>(null);

	const contextualPrompts = $derived.by(() => {
		const ctx = ui.currentContext;
		if (ctx.type === 'docs' && ctx.title) {
			return [
				`Rangkum konsep utama "${ctx.title}"`,
				'Buatkan contoh kode implementasi lengkap',
				'Apa potensi kendala teknis & solusinya?',
				'Jelaskan arsitektur data binding & modelnya'
			];
		}
		if (ctx.type === 'apps') {
			return [
				'Jelaskan alur kerja Fuel Management System (FMS)',
				'Bagaimana cara integrasi CDS Views ke SAC?',
				'Alur approval di Marketing System (JMS)',
				'Fitur pelaporan insiden di KPI Safety (SHE)',
				'Mekanisme notifikasi penagihan di PPPN'
			];
		}
		if (ctx.type === 'api') {
			return [
				'Jelaskan endpoint /api/ai/chat dan format payloadnya',
				'Cara kerja in-memory response cache TTL',
				'Best practice CSRF & Bearer token authorization',
				'Contoh request cURL untuk pencarian semantik'
			];
		}
		return [
			'Apa fungsi Fuel Management System (FMS)?',
			'Bagaimana integrasi CDS Views ke SAC Dev & Prod?',
			'Modul apa saja yang ada di KPI Safety?',
			'Apa tujuan aplikasi penagihan PPPN?',
			'Akses dokumen di File Manager Enterprise'
		];
	});

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

	async function sendMessage(textToSend?: string) {
		const query = (textToSend || inputQuery).trim();
		if (!query || isLoading) return;

		inputQuery = '';
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
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
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

<!-- Floating Trigger Pill (Bottom Right) -->
{#if !ui.isAiOpen}
	<Button
		onclick={() => ui.openAi()}
		class="fixed bottom-6 right-6 z-40 h-10 gap-2 rounded-full px-4 text-xs font-semibold shadow-xl transition-transform hover:scale-105"
	>
		<Sparkles class="h-3.5 w-3.5" />
		<span>Ask AI Copilot</span>
		<Badge variant="outline" class="px-1.5 py-0 text-[9px] bg-background text-foreground">Ctrl J</Badge>
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
								Enterprise
							</Badge>
						</div>
						<p class="text-xs text-muted-foreground">Asisten teknis dokumentasi & sistem enterprise</p>
					</div>
				</div>

				<div class="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onclick={clearChat}
						title="Bersihkan chat"
						class="h-8 w-8 text-muted-foreground"
					>
						<Trash2 class="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onclick={() => ui.closeAi()}
						title="Tutup (ESC)"
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

						<div class="group relative max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed {msg.role === 'user'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted/60 text-foreground border border-border'}">
							
							{#if msg.role === 'assistant'}
								<div class="prose prose-xs dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>pre]:my-2 [&>pre]:p-2.5 [&>pre]:rounded-lg [&>pre]:bg-zinc-950 [&>pre]:text-zinc-100 [&>code]:bg-zinc-200/60 dark:[&>code]:bg-zinc-800/80 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded">
									{@html marked.parse(msg.content)}
								</div>
								
								<Button
									variant="ghost"
									size="icon"
									onclick={() => copyMessage(msg.content, idx)}
									class="absolute right-1.5 top-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
									title="Salin jawaban"
								>
									{#if copiedIndex === idx}
										<Check class="h-3 w-3" />
									{:else}
										<Copy class="h-3 w-3" />
									{/if}
								</Button>
							{:else}
								<div class="whitespace-pre-wrap">{msg.content}</div>
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

			<!-- Prompt Suggestion Chips -->
			<div class="border-t border-border bg-muted/20 p-3">
				<div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
					Pertanyaan Cepat
				</div>
				<div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
					{#each contextualPrompts as prompt}
						<Button
							variant="outline"
							size="sm"
							onclick={() => sendMessage(prompt)}
							disabled={isLoading}
							class="h-7 gap-1 px-2.5 text-[11px] font-normal"
						>
							<span>{prompt}</span>
							<ArrowRight class="h-2.5 w-2.5 opacity-50" />
						</Button>
					{/each}
				</div>
			</div>

			<!-- Input Form -->
			<div class="border-t border-border p-4">
				<div class="relative flex items-center">
					<Input
						bind:ref={inputEl}
						type="text"
						bind:value={inputQuery}
						onkeydown={handleKeydown}
						placeholder="Tanyakan apapun ke AI Copilot..."
						class="pr-12 text-xs h-10"
					/>
					<Button
						size="icon"
						onclick={() => sendMessage()}
						disabled={!inputQuery.trim() || isLoading}
						class="absolute right-1.5 h-7 w-7"
					>
						<Send class="h-3.5 w-3.5" />
					</Button>
				</div>
				<div class="mt-2 text-center text-[10px] text-muted-foreground">
					Tekan <Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">Enter</Badge> untuk mengirim
				</div>
			</div>
		</div>
	</div>
{/if}
