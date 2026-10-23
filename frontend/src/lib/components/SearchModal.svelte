<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import docsData from '$lib/data/docsIndex.json';
	import appsData from '$lib/data/apps.json';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Search, FileText, ExternalLink, Sparkles, X, CornerDownLeft } from '@lucide/svelte';

	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (ui.isSearchOpen) {
			searchQuery = '';
			selectedIndex = 0;
			setTimeout(() => inputEl?.focus(), 50);
		}
	});

	// Filtered articles
	const filteredArticles = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return docsData.articles.slice(0, 5);
		return docsData.articles.filter(
			(a) =>
				a.title.toLowerCase().includes(q) ||
				a.category.toLowerCase().includes(q) ||
				a.snippet.toLowerCase().includes(q)
		).slice(0, 8);
	});

	// Filtered apps
	const filteredApps = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return appsData.programs.slice(0, 3);
		return appsData.programs.filter(
			(p) =>
				p.title.toLowerCase().includes(q) ||
				p.subtitle.toLowerCase().includes(q) ||
				p.description.toLowerCase().includes(q) ||
				p.tags.some((t) => t.toLowerCase().includes(q))
		).slice(0, 4);
	});

	const allResults = $derived([
		...filteredArticles.map((a) => ({ type: 'doc' as const, id: a.path, title: a.title, category: a.category, path: `/docs/${a.path}` })),
		...filteredApps.map((p) => ({ type: 'app' as const, id: p.id, title: p.title, category: p.categoryName, url: p.url }))
	]);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			ui.closeSearch();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (allResults.length > 0) {
				selectedIndex = (selectedIndex + 1) % allResults.length;
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (allResults.length > 0) {
				selectedIndex = (selectedIndex - 1 + allResults.length) % allResults.length;
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (allResults[selectedIndex]) {
				selectItem(allResults[selectedIndex]);
			}
		}
	}

	function selectItem(item: (typeof allResults)[0]) {
		ui.closeSearch();
		if (item.type === 'doc') {
			goto(item.path);
		} else {
			window.open(item.url, '_blank', 'noopener,noreferrer');
		}
	}

	function askAiAboutSearch() {
		const q = searchQuery;
		ui.closeSearch();
		ui.openAi(q);
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			if (ui.isSearchOpen) ui.closeSearch();
			else ui.openSearch();
		}
	}}
/>

{#if ui.isSearchOpen}
	<!-- Backdrop -->
	<div 
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/60 p-4 pt-[12vh] backdrop-blur-xs sm:p-6 sm:pt-[15vh]"
		onclick={(e) => { if (e.target === e.currentTarget) ui.closeSearch(); }}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Modal Box with Shadcn Styling -->
		<div class="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl transition-all">
			<!-- Search Bar Input -->
			<div class="flex items-center border-b border-border px-4">
				<Search class="h-5 w-5 text-muted-foreground" />
				<input
					bind:this={inputEl}
					bind:value={searchQuery}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Cari dokumentasi teknis, API, atau sistem aplikasi..."
					class="h-14 w-full bg-transparent px-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none"
				/>
				{#if searchQuery}
					<button
						onclick={() => (searchQuery = '')}
						class="rounded p-1 text-muted-foreground hover:text-foreground"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
				<Badge variant="outline" class="ml-2 px-1.5 py-0.5 text-[10px]">
					ESC
				</Badge>
			</div>

			<!-- Results Body -->
			<div class="max-h-96 overflow-y-auto p-2">
				{#if allResults.length === 0}
					<div class="py-12 text-center">
						<FileText class="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
						<p class="mt-2 text-sm font-medium text-foreground">Tidak ada dokumen yang cocok</p>
						<p class="mt-1 text-xs text-muted-foreground">Coba kata kunci lain atau gunakan bantuan AI Copilot.</p>
						<Button
							size="sm"
							onclick={askAiAboutSearch}
							class="mt-4 gap-1.5 text-xs"
						>
							<Sparkles class="h-3.5 w-3.5 text-amber-300 dark:text-amber-500" />
							<span>Tanya AI "{searchQuery}"</span>
						</Button>
					</div>
				{:else}
					<!-- Ask AI Quick Action if there is a query -->
					{#if searchQuery.trim()}
						<div class="mb-2 px-2">
							<button
								onclick={askAiAboutSearch}
								class="flex w-full items-center justify-between rounded-lg border border-indigo-200/60 bg-indigo-50/50 p-2.5 text-left text-xs font-medium text-indigo-950 transition-colors hover:bg-indigo-100/70 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200 dark:hover:bg-indigo-950/60"
							>
								<div class="flex items-center gap-2">
									<Sparkles class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
									<span>Tanyakan AI Copilot tentang <strong>"{searchQuery}"</strong></span>
								</div>
								<Badge class="bg-indigo-600 text-white text-[10px]">Gemini 3.8</Badge>
							</button>
						</div>
					{/if}

					<!-- Articles Category -->
					{#if filteredArticles.length > 0}
						<div class="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Dokumentasi & Panduan
						</div>
						<div class="space-y-0.5 mb-3">
							{#each filteredArticles as article, i}
								{@const isSelected = selectedIndex === i}
								<button
									onclick={() => selectItem({ type: 'doc', id: article.path, title: article.title, category: article.category, path: `/docs/${article.path}` })}
									onmouseenter={() => (selectedIndex = i)}
									class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors {isSelected
										? 'bg-accent text-accent-foreground'
										: 'text-foreground hover:bg-muted/50'}"
								>
									<div class="flex items-center gap-2.5">
										<FileText class="h-4 w-4 text-muted-foreground" />
										<div>
											<div class="font-medium">{article.title}</div>
											<div class="text-[10px] text-muted-foreground">{article.category}</div>
										</div>
									</div>
									{#if isSelected}
										<CornerDownLeft class="h-3.5 w-3.5 text-muted-foreground" />
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Apps Category -->
					{#if filteredApps.length > 0}
						<div class="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Sistem & Aplikasi Enterprise
						</div>
						<div class="space-y-0.5">
							{#each filteredApps as prog, j}
								{@const itemIdx = filteredArticles.length + j}
								{@const isSelected = selectedIndex === itemIdx}
								<button
									onclick={() => selectItem({ type: 'app', id: prog.id, title: prog.title, category: prog.categoryName, url: prog.url })}
									onmouseenter={() => (selectedIndex = itemIdx)}
									class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors {isSelected
										? 'bg-accent text-accent-foreground'
										: 'text-foreground hover:bg-muted/50'}"
								>
									<div class="flex items-center gap-2.5">
										<ExternalLink class="h-4 w-4 text-emerald-500" />
										<div>
											<div class="font-medium">{prog.title}</div>
											<div class="text-[10px] text-muted-foreground">{prog.subtitle}</div>
										</div>
									</div>
									<Badge variant="secondary" class="text-[10px]">
										{prog.status}
									</Badge>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<!-- Footer Tips -->
			<div class="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
				<div class="flex items-center gap-3">
					<span class="flex items-center gap-1">
						<kbd class="rounded border border-border bg-background px-1 py-0.2">↑↓</kbd> Navigasi
					</span>
					<span class="flex items-center gap-1">
						<kbd class="rounded border border-border bg-background px-1 py-0.2">↵</kbd> Buka
					</span>
				</div>
				<span>Pencarian Cepat Portal Dokumentasi</span>
			</div>
		</div>
	</div>
{/if}
