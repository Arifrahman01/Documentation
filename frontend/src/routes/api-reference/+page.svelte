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
			description: 'Mengirim prompt ke model Gemini 3.8 Flash Medium dengan dukungan konteks percakapan dan in-memory LRU cache.',
			request: `{
  "query": "Jelaskan arsitektur MVC di SAPUI5",
  "context": "Konteks pengguna: Halaman Model View Controller",
  "history": [
    { "role": "user", "content": "Halo" },
    { "role": "assistant", "content": "Halo! Ada yang bisa saya bantu?" }
  ]
}`,
			response: `{
  "reply": "Model View Controller (MVC) di SAPUI5 memisahkan data bisnis (Model)...",
  "model": "gemini-3.8-flash-medium",
  "cached": false,
  "executionTimeMs": 240
}`
		},
		{
			id: 'ai-status',
			method: 'GET',
			path: '/api/ai/status',
			title: 'Healthcheck & Cache Status',
			description: 'Memeriksa status koneksi ke model AI lokal serta jumlah cache jawaban aktif.',
			request: null,
			response: `{
  "status": "online",
  "model": "gemini-3.8-flash-medium",
  "cachedEntries": 14,
  "availableModels": ["gemini-3.8-flash-medium", "gemini-3.8-flash"]
}`
		},
		{
			id: 'search',
			method: 'POST',
			path: '/api/search',
			title: 'Full-text Documentation Search',
			description: 'Pencarian kata kunci cepat pada 9 artikel dokumentasi dan 7 aplikasi enterprise.',
			request: `{
  "query": "fuel management",
  "limit": 5
}`,
			response: `{
  "results": [
    {
      "title": "Fuel Management System",
      "category": "Operations & Logistics",
      "url": "http://jgfuel.id",
      "type": "app"
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
			<div class="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
				<Terminal class="h-3.5 w-3.5 text-indigo-500" />
				<span>RESTful API Specifications</span>
			</div>
			<h1 class="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
				API Reference
			</h1>
			<p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
				Spesifikasi endpoint backend untuk layanan AI Copilot, caching respons lokal, pencarian semantik, dan interoperabilitas sistem.
			</p>
		</div>

		<Button
			variant="outline"
			size="sm"
			onclick={() => ui.openAi('Jelaskan cara kerja endpoint /api/ai/chat dan format payloadnya')}
			class="gap-1.5 text-xs text-indigo-600 border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
		>
			<Sparkles class="h-3.5 w-3.5" />
			<span>Tanyakan AI tentang API</span>
		</Button>
	</div>

	<Separator class="my-8" />

	<!-- Endpoints List -->
	<div class="space-y-8">
		{#each endpoints as ep}
			<Card class="overflow-hidden border-zinc-200 dark:border-zinc-800">
				<CardHeader class="border-b border-zinc-100 bg-zinc-50/50 p-5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<Badge class={ep.method === 'POST' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-mono' : 'bg-blue-600 hover:bg-blue-700 text-white font-mono'}>
								{ep.method}
							</Badge>
							<code class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
								{ep.path}
							</code>
						</div>

						<Button
							variant="ghost"
							size="sm"
							onclick={() => copyCode(ep.path, ep.id + '-path')}
							class="h-8 gap-1 text-xs text-zinc-500"
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

					<CardTitle class="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100">
						{ep.title}
					</CardTitle>
					<CardDescription class="text-xs text-zinc-500 dark:text-zinc-400">
						{ep.description}
					</CardDescription>
				</CardHeader>

				<CardContent class="p-5 space-y-5">
					<!-- Request Payload if present -->
					{#if ep.request}
						<div>
							<div class="mb-2 flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Request Body (JSON)</span>
								<button
									onclick={() => copyCode(ep.request!, ep.id + '-req')}
									class="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1"
								>
									{#if copiedSnippet === ep.id + '-req'}
										<Check class="h-3 w-3 text-emerald-500" />
									{:else}
										<Copy class="h-3 w-3" />
									{/if}
									<span>Salin</span>
								</button>
							</div>
							<pre class="rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs font-mono text-zinc-100 overflow-x-auto dark:border-zinc-800"><code>{ep.request}</code></pre>
						</div>
					{/if}

					<!-- Response Payload -->
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Response Payload (200 OK)</span>
							<button
								onclick={() => copyCode(ep.response, ep.id + '-res')}
								class="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1"
							>
								{#if copiedSnippet === ep.id + '-res'}
									<Check class="h-3 w-3 text-emerald-500" />
								{:else}
									<Copy class="h-3 w-3" />
								{/if}
								<span>Salin</span>
							</button>
						</div>
						<pre class="rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs font-mono text-emerald-400 overflow-x-auto dark:border-zinc-800"><code>{ep.response}</code></pre>
					</div>
				</CardContent>
			</Card>
		{/each}
	</div>
</div>
