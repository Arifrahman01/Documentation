<script lang="ts">
	import { onMount } from 'svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import docsData from '$lib/data/docsIndex.json';
	import appsData from '$lib/data/apps.json';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Search, FileText, ExternalLink, Sparkles, X, CornerDownLeft } from '@lucide/svelte';

	interface DocSearchItem {
		slug: string;
		title: string;
		category: string;
		subcategory?: string;
		section?: string;
		snippet?: string;
		description?: string;
	}

	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let liveDocs = $state<DocSearchItem[]>((docsData.documents || []) as DocSearchItem[]);
	let liveApps = $state(appsData.programs || []);

	$effect(() => {
		if (ui.isSearchOpen) {
			searchQuery = '';
			selectedIndex = 0;
			setTimeout(() => inputEl?.focus(), 50);

			fetch('/api/docs')
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => {
					if (Array.isArray(d?.documents)) liveDocs = d.documents;
				})
				.catch(() => {});

			fetch('/api/apps')
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => {
					if (Array.isArray(d?.programs)) liveApps = d.programs;
				})
				.catch(() => {});
		}
	});

	const filteredArticles = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return liveDocs.slice(0, 5);
		return liveDocs
			.filter(
				(a) =>
					a.title.toLowerCase().includes(q) ||
					a.category.toLowerCase().includes(q) ||
					(a.subcategory && a.subcategory.toLowerCase().includes(q)) ||
					(a.snippet && a.snippet.toLowerCase().includes(q)) ||
					(a.description && a.description.toLowerCase().includes(q))
			)
			.slice(0, 8);
	});

	const filteredApps = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return liveApps.slice(0, 3);
		return liveApps
			.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.subtitle.toLowerCase().includes(q) ||
					p.description.toLowerCase().includes(q) ||
					p.tags.some((t: string) => t.toLowerCase().includes(q))
			)
			.slice(0, 4);
	});

	const allResults = $derived([
		...filteredArticles.map((a) => ({
			type: 'doc' as const,
			id: a.slug,
			title: a.title,
			category: a.subcategory ? `${a.category} / ${a.subcategory}` : a.category,
			path: `/docs/${a.slug}`
		})),
		...filteredApps.map((p) => ({
			type: 'app' as const,
			id: p.id,
			title: p.title,
			category: p.categoryName,
			url: p.url
		}))
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

	onMount(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const isK = e.key.toLowerCase() === 'k' || e.code === 'KeyK';
			if (((e.ctrlKey || e.metaKey) || e.altKey) && isK) {
				e.preventDefault();
				e.stopPropagation();
				if (ui.isSearchOpen) ui.closeSearch();
				else ui.openSearch();
			} else if (e.key === 'Escape' && ui.isSearchOpen) {
				e.preventDefault();
				ui.closeSearch();
			}
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	});
</script>

{#if ui.isSearchOpen}
	<!-- Backdrop -->
	<div 
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-xs sm:p-6 sm:pt-[15vh]"
		onclick={(e) => { if (e.target === e.currentTarget) ui.closeSearch(); }}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Modal Box with Shadcn Styling -->
		<div class="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl transition-all">
			<!-- Search Bar Input -->
			<div class="flex items-center border-b border-border px-4 py-2 gap-2">
				<Search class="h-4 w-4 text-muted-foreground shrink-0" />
				<Input
					bind:ref={inputEl}
					bind:value={searchQuery}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Cari dokumentasi teknis, API, atau sistem aplikasi..."
					class="h-10 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
				/>
				{#if searchQuery}
					<Button
						variant="ghost"
						size="icon"
						onclick={() => (searchQuery = '')}
						class="h-7 w-7 text-muted-foreground hover:text-foreground"
					>
						<X class="h-3.5 w-3.5" />
					</Button>
				{/if}
				<Badge variant="outline" class="px-1.5 py-0.5 text-[10px] font-mono">
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
							<Sparkles class="h-3.5 w-3.5" />
							<span>Tanya AI "{searchQuery}"</span>
						</Button>
					</div>
				{:else}
					<!-- Ask AI Quick Action if there is a query -->
					{#if searchQuery.trim()}
						<div class="mb-2 px-1">
							<Button
								variant="outline"
								onclick={askAiAboutSearch}
								class="flex h-auto w-full items-center justify-between p-2.5 text-left text-xs font-medium"
							>
								<div class="flex items-center gap-2">
									<Sparkles class="h-4 w-4 text-muted-foreground" />
									<span>Tanyakan AI Copilot tentang <strong>"{searchQuery}"</strong></span>
								</div>
								<Badge variant="secondary" class="text-[10px]">AI Copilot</Badge>
							</Button>
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
								<Button
									variant={isSelected ? 'secondary' : 'ghost'}
									onclick={() => selectItem({ type: 'doc', id: article.slug, title: article.title, category: article.category, path: `/docs/${article.slug}` })}
									onmouseenter={() => (selectedIndex = i)}
									class="flex h-auto w-full items-center justify-between px-3 py-2 text-left text-xs font-normal"
								>
									<div class="flex items-center gap-2.5">
										<FileText class="h-4 w-4 text-muted-foreground" />
										<div>
											<div class="font-medium text-foreground">{article.title}</div>
											<div class="text-[10px] text-muted-foreground">
												{article.subcategory ? `${article.category} / ${article.subcategory}` : article.category}
											</div>
										</div>
									</div>
									{#if isSelected}
										<CornerDownLeft class="h-3.5 w-3.5 text-muted-foreground" />
									{/if}
								</Button>
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
								<Button
									variant={isSelected ? 'secondary' : 'ghost'}
									onclick={() => selectItem({ type: 'app', id: prog.id, title: prog.title, category: prog.categoryName, url: prog.url })}
									onmouseenter={() => (selectedIndex = itemIdx)}
									class="flex h-auto w-full items-center justify-between px-3 py-2 text-left text-xs font-normal"
								>
									<div class="flex items-center gap-2.5">
										<ExternalLink class="h-4 w-4 text-muted-foreground" />
										<div>
											<div class="font-medium text-foreground">{prog.title}</div>
											<div class="text-[10px] text-muted-foreground">{prog.subtitle}</div>
										</div>
									</div>
									<Badge variant="secondary" class="text-[10px]">
										{prog.status}
									</Badge>
								</Button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<!-- Footer Tips -->
			<div class="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
				<div class="flex items-center gap-3">
					<span class="flex items-center gap-1">
						<Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">↑↓</Badge> Navigasi
					</span>
					<span class="flex items-center gap-1">
						<Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">↵</Badge> Buka
					</span>
				</div>
				<span>Pencarian Cepat Portal Dokumentasi</span>
			</div>
		</div>
	</div>
{/if}
