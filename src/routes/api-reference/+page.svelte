<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Terminal, Sparkles, Copy, Check, ArrowRight, ShieldCheck, Zap } from '@lucide/svelte';

	$effect(() => {
		ui.currentContext = { type: 'api', title: 'API Reference & Integrasi Arsitektur' };
	});

	let copiedSnippet = $state<string | null>(null);

	function copyCode(text: string, id: string) {
		navigator.clipboard.writeText(text);
		copiedSnippet = id;
		setTimeout(() => (copiedSnippet = null), 2000);
	}

	const endpoints = [
		{
			id: 'ai-chat',
			method: 'POST',
			path: '/api/ai/chat',
			title: 'AI Copilot Query & Chat Completion',
			description: 'Mengirim prompt ke AI Copilot dengan dukungan pencarian semantik RAG, proteksi anti-halusinasi, dan in-memory cache.',
			request: `{
  "query": "Jelaskan konsep Model View Controller",
  "context": "Konteks opsional halaman aktif",
  "history": [
    { "role": "user", "content": "Halo" },
    { "role": "assistant", "content": "Halo! Ada yang bisa saya bantu?" }
  ]
}`,
			response: `{
  "reply": "Model View Controller (MVC) memisahkan data bisnis (Model)...",
  "cached": false,
  "executionTimeMs": 240
}`
		},
		{
			id: 'ai-status',
			method: 'GET',
			path: '/api/ai/status',
			title: 'Healthcheck & Cache Status',
			description: 'Memeriksa status gateway AI Copilot serta jumlah cache jawaban aktif.',
			request: null,
			response: `{
  "status": "online",
  "service": "AI Copilot Engine",
  "cachedEntries": 14
}`
		},
		{
			id: 'quick-search',
			method: 'GET',
			path: '/api/ai/quick-search?q=fuel',
			title: 'Semantic & Fuzzy Quick Search',
			description: 'Pencarian cepat lintas seluruh artikel dokumentasi (SAP, SAC, WEB) dan katalog aplikasi enterprise.',
			request: null,
			response: `{
  "query": "fuel",
  "results": [
    {
      "id": "sap/overview",
      "title": "Arsitektur SAP ERP & S/4HANA",
      "section": "SAP",
      "category": "Architecture",
      "slug": "sap/overview"
    }
  ]
}`
		},
		{
			id: 'docs-list',
			method: 'GET',
			path: '/api/docs',
			title: 'List & Sync Documentation Articles',
			description: 'Mengambil seluruh daftar artikel dokumentasi beserta struktur folder, kategori, dan metadata.',
			request: null,
			response: `{
  "documents": [
    {
      "id": "sac/overview",
      "slug": "sac/overview",
      "section": "SAC",
      "category": "Overview & BI",
      "title": "SAP Analytics Cloud (SAC) Overview"
    }
  ]
}`
		}
	];
</script>

<svelte:head>
	<title>API Reference - Spesifikasi REST Endpoints</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
	<!-- Hero -->
	<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
		<div>
			<Badge variant="outline" class="gap-2 px-3 py-1 text-xs">
				<Terminal class="h-3.5 w-3.5 text-foreground" />
				<span>RESTful API Specifications</span>
			</Badge>
			<h1 class="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
				API Reference
			</h1>
			<p class="mt-2 text-sm text-muted-foreground max-w-2xl">
				Spesifikasi endpoint backend untuk layanan AI Copilot, caching respons lokal, pencarian cepat, dan manajemen dokumen.
			</p>
		</div>

		<Button
			variant="outline"
			size="sm"
			onclick={() => ui.openAi('Jelaskan cara kerja endpoint /api/ai/chat dan format payloadnya')}
			class="gap-1.5 text-xs"
		>
			<Sparkles class="h-3.5 w-3.5" />
			<span>Tanyakan AI tentang API</span>
		</Button>
	</div>

	<Separator class="my-8" />

	<!-- Endpoints List -->
	<div class="space-y-8">
		{#each endpoints as ep}
			<Card class="overflow-hidden border-border">
				<CardHeader class="border-b border-border bg-muted/30 p-5">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<Badge variant={ep.method === 'POST' ? 'default' : 'secondary'} class="font-mono">
								{ep.method}
							</Badge>
							<code class="text-sm font-semibold text-foreground font-mono">
								{ep.path}
							</code>
						</div>

						<Button
							variant="ghost"
							size="sm"
							onclick={() => copyCode(ep.path, ep.id + '-path')}
							class="h-8 gap-1 text-xs text-muted-foreground"
						>
							{#if copiedSnippet === ep.id + '-path'}
								<Check class="h-3.5 w-3.5 text-emerald-500" />
								<span>Tersalin</span>
							{:else}
								<Copy class="h-3.5 w-3.5" />
								<span>Salin Path</span>
							{/if}
						</Button>
					</div>

					<CardTitle class="mt-3 text-base font-bold text-foreground">
						{ep.title}
					</CardTitle>
					<CardDescription class="text-xs text-muted-foreground">
						{ep.description}
					</CardDescription>
				</CardHeader>

				<CardContent class="p-5 space-y-5">
					<!-- Request Payload if present -->
					{#if ep.request}
						<div>
							<div class="mb-2 flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request Body (JSON)</span>
								<button
									onclick={() => copyCode(ep.request!, ep.id + '-req')}
									class="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
								>
									{#if copiedSnippet === ep.id + '-req'}
										<Check class="h-3 w-3 text-emerald-500" />
									{:else}
										<Copy class="h-3 w-3" />
									{/if}
									<span>Salin</span>
								</button>
							</div>
							<pre class="rounded-xl border border-border bg-zinc-950 p-4 text-xs font-mono text-zinc-100 overflow-x-auto"><code>{ep.request}</code></pre>
						</div>
					{/if}

					<!-- Response Payload -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response Payload (200 OK)</span>
							<button
								onclick={() => copyCode(ep.response, ep.id + '-res')}
								class="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
							>
								{#if copiedSnippet === ep.id + '-res'}
									<Check class="h-3 w-3 text-emerald-500" />
								{:else}
									<Copy class="h-3 w-3" />
								{/if}
								<span>Salin</span>
							</button>
						</div>
						<pre class="rounded-xl border border-border bg-zinc-950 p-4 text-xs font-mono text-emerald-400 overflow-x-auto"><code>{ep.response}</code></pre>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>
</div>
