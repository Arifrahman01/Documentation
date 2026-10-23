<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { marked } from 'marked';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		BookOpen, 
		Sparkles, 
		ChevronRight, 
		ChevronLeft, 
		FileText, 
		Copy, 
		Check, 
		ListTree
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mobileSidebarOpen = $state(false);
	let copiedSnippet = $state(false);

	$effect(() => {
		ui.currentContext = {
			type: 'docs',
			title: data.article.title,
			key: data.slug,
			snippet: data.article.snippet
		};
	});

	// Parse TOC Headings (H2 and H3)
	const headings = $derived.by(() => {
		const lines = data.content.split('\n');
		const list: { id: string; text: string; level: number }[] = [];
		for (const line of lines) {
			const h2Match = line.match(/^##\s+(.+)$/);
			const h3Match = line.match(/^###\s+(.+)$/);
			if (h2Match) {
				const text = h2Match[1].trim();
				const id = text.toLowerCase().replace(/[^\w]+/g, '-');
				list.push({ id, text, level: 2 });
			} else if (h3Match) {
				const text = h3Match[1].trim();
				const id = text.toLowerCase().replace(/[^\w]+/g, '-');
				list.push({ id, text, level: 3 });
			}
		}
		return list;
	});

	// Render Markdown HTML with GitHub Alerts formatting
	const renderedHtml = $derived.by(() => {
		let raw = data.content;
		// Replace markdown alert blocks
		raw = raw.replace(/>\s*\[!NOTE\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-blue-500 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><strong>Note:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!TIP\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-emerald-500 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><strong>Tip:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!IMPORTANT\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-amber-500 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><strong>Important:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!WARNING\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-red-500 bg-red-50/60 p-3.5 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200"><strong>Warning:</strong> $1</div>');
		
		return marked.parse(raw);
	});

	function askAiAboutDoc() {
		ui.openAi(`Rangkum konsep utama, best practice, dan arsitektur dari dokumen "${data.article.title}".`, {
			type: 'docs',
			title: data.article.title,
			key: data.slug
		});
	}
</script>

<svelte:head>
	<title>{data.article.title} - Dokumentasi Teknis</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	<div class="flex gap-8 py-8">
		<!-- Left Sidebar (Desktop) -->
		<aside class="hidden lg:block w-64 shrink-0">
			<div class="sticky top-24 space-y-6">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold uppercase tracking-wider text-zinc-400">Daftar Panduan</span>
					<Badge variant="outline" class="text-[10px]">{data.treeData.length} Modul</Badge>
				</div>

				<nav class="space-y-4">
					{#each data.treeData as group}
						<div>
							<div class="px-2 pb-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
								{group.title}
							</div>
							<div class="space-y-0.5">
								{#each group.nodes as node}
									{@const isCurrent = node.path === data.slug}
									<a
										href="/docs/{node.path}"
										class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {isCurrent
											? 'bg-zinc-100 text-zinc-900 font-semibold dark:bg-zinc-800 dark:text-zinc-50'
											: 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'}"
									>
										<FileText class="h-3.5 w-3.5 opacity-60" />
										<span class="truncate">{node.title}</span>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</nav>
			</div>
		</aside>

		<!-- Main Content Area -->
		<div class="min-w-0 flex-1 max-w-3xl">
			<!-- Breadcrumb & AI Action -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
				<div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
					<a href="/" class="hover:underline">Home</a>
					<ChevronRight class="h-3.5 w-3.5" />
					<a href="/docs/get-started/quick-start" class="hover:underline">Docs</a>
					<ChevronRight class="h-3.5 w-3.5" />
					<span class="text-zinc-900 dark:text-zinc-100 font-medium">{data.article.category}</span>
				</div>

				<Button
					variant="outline"
					size="sm"
					onclick={askAiAboutDoc}
					class="gap-1.5 text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
				>
					<Sparkles class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
					<span>Tanyakan AI tentang halaman ini</span>
				</Button>
			</div>

			<!-- Title & Header -->
			<div class="mt-6 mb-8">
				<Badge variant="secondary" class="mb-2 text-[10px]">
					{data.article.category}
				</Badge>
				<h1 class="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
					{data.article.title}
				</h1>
			</div>

			<!-- Markdown Rendered Body with Tailwind Typography -->
			<article class="prose prose-zinc dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-code:rounded prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none">
				{@html renderedHtml}
			</article>

			<Separator class="my-10" />

			<!-- Pagination Footer -->
			<div class="flex items-center justify-between gap-4">
				{#if data.prevArticle}
					<a href="/docs/{data.prevArticle.path}" class="flex-1">
						<div class="group flex flex-col rounded-xl border border-zinc-200 p-4 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
							<span class="flex items-center gap-1 text-[11px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
								<ChevronLeft class="h-3.5 w-3.5" /> Sebelumnya
							</span>
							<span class="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								{data.prevArticle.title}
							</span>
						</div>
					</a>
				{:else}
					<div></div>
				{/if}

				{#if data.nextArticle}
					<a href="/docs/{data.nextArticle.path}" class="flex-1 text-right">
						<div class="group flex flex-col rounded-xl border border-zinc-200 p-4 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
							<span class="flex items-center justify-end gap-1 text-[11px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
								Selanjutnya <ChevronRight class="h-3.5 w-3.5" />
							</span>
							<span class="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								{data.nextArticle.title}
							</span>
						</div>
					</a>
				{/if}
			</div>
		</div>

		<!-- Right Sidebar (On this page TOC) -->
		{#if headings.length > 0}
			<aside class="hidden xl:block w-56 shrink-0">
				<div class="sticky top-24 space-y-3">
					<div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
						<ListTree class="h-3.5 w-3.5" />
						<span>Di Halaman Ini</span>
					</div>
					<nav class="space-y-1.5 text-xs">
						{#each headings as h}
							<a
								href="#{h.id}"
								class="block transition-colors {h.level === 3 ? 'pl-3' : ''} text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
							>
								{h.text}
							</a>
						{/each}
					</nav>
				</div>
			</aside>
		{/if}
	</div>
</div>
