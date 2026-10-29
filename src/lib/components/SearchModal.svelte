<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import docsData from '$lib/data/docsIndex.json';
	import appsData from '$lib/data/apps.json';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Search, FileText, ExternalLink, Sparkles, X, CornerDownLeft, BookUser } from '@lucide/svelte';

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
	let liveDocs = $state<DocSearchItem[]>(((docsData as any).documents || (docsData as any).articles || []) as DocSearchItem[]);
	let liveApps = $state(appsData.programs || []);
	let liveUserDocs = $state<any[]>([]);

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

			fetch('/api/my-docs')
				.then((r) => (r.ok ? r.json() : null))
				.then((d) => {
					if (Array.isArray(d?.documents)) liveUserDocs = d.documents;
				})
				.catch(() => {});
		}
	});

	const filteredArticles = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return liveDocs.slice(0, 4);
		return liveDocs
			.filter(
				(a) =>
					a.title.toLowerCase().includes(q) ||
					a.category.toLowerCase().includes(q) ||
					(a.subcategory && a.subcategory.toLowerCase().includes(q)) ||
					(a.snippet && a.snippet.toLowerCase().includes(q)) ||
					(a.description && a.description.toLowerCase().includes(q))
			)
			.slice(0, 6);
	});

	const filteredUserDocs = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return liveUserDocs.slice(0, 3);
		return liveUserDocs
			.filter(
				(u) =>
					u.title.toLowerCase().includes(q) ||
					u.category.toLowerCase().includes(q) ||
					(u.subcategory && u.subcategory.toLowerCase().includes(q)) ||
					(u.content && u.content.toLowerCase().includes(q))
			)
			.slice(0, 4);
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
					(Array.isArray(p.tags) && p.tags.some((t: string) => t.toLowerCase().includes(q)))
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
		...filteredUserDocs.map((u) => ({
			type: 'userDoc' as const,
			id: u.slug || u.id,
			title: u.title,
			category: u.subcategory ? `${u.category} / ${u.subcategory}` : u.category,
			path: `/my-docs/${u.slug || u.id}`
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
		if (item.type === 'doc' || item.type === 'userDoc') {
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

{#if ui.isSearchOpen}
	<!-- Backdrop -->
	<div 
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-xs sm:p-6 sm:pt-[12vh]"
		onclick={(e) => { if (e.target === e.currentTarget) ui.closeSearch(); }}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<!-- Modal Box with Unified Styling -->
		<div class="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl transition-all">
			<!-- Search Bar Input -->
			<div class="flex items-center border-b border-border px-4 py-2.5 gap-2.5">
				<Search class="h-4 w-4 text-muted-foreground shrink-0" />
				<Input
					bind:ref={inputEl}
					bind:value={searchQuery}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Cari dokumentasi SAP/SAC/Web, Apps, atau catatan My Docs..."
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
			<div class="max-h-[60vh] overflow-y-auto p-2">
				{#if allResults.length === 0}
					<div class="py-12 text-center">
						<FileText class="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
						<p class="mt-2 text-sm font-medium text-foreground">Tidak ada hasil yang cocok</p>
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
									<Sparkles class="h-4 w-4 text-primary" />
									<span>Tanyakan AI Copilot tentang <strong>"{searchQuery}"</strong></span>
								</div>
								<Badge variant="secondary" class="text-[10px]">AI Copilot</Badge>
							</Button>
						</div>
					{/if}

					<!-- Articles Category (Enterprise Docs) -->
					{#if filteredArticles.length > 0}
						<div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							Dokumentasi Enterprise
						</div>
						<div class="space-y-0.5 mb-2.5">
							{#each filteredArticles as article, i}
								{@const isSelected = selectedIndex === i}
								<Button
									variant={isSelected ? 'secondary' : 'ghost'}
									onclick={() => selectItem({ type: 'doc', id: article.slug, title: article.title, category: article.category, path: `/docs/${article.slug}` })}
									onmouseenter={() => (selectedIndex = i)}
									class="flex h-auto w-full items-center justify-between px-3 py-2 text-left text-xs font-normal"
								>
									<div class="flex items-center gap-2.5 truncate">
										<FileText class="h-4 w-4 text-muted-foreground shrink-0" />
										<div class="truncate">
											<div class="font-medium text-foreground truncate">{article.title}</div>
											<div class="text-[10px] text-muted-foreground truncate">
												{article.subcategory ? `${article.category} / ${article.subcategory}` : article.category}
											</div>
										</div>
									</div>
									{#if isSelected}
										<CornerDownLeft class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
									{/if}
								</Button>
							{/each}
						</div>
					{/if}

					<!-- My Docs Category (Personal Notes) -->
					{#if filteredUserDocs.length > 0}
						<div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
							My Docs (Catatan Pribadi)
						</div>
						<div class="space-y-0.5 mb-2.5">
							{#each filteredUserDocs as uDoc, k}
								{@const uIdx = filteredArticles.length + k}
								{@const isSelected = selectedIndex === uIdx}
								<Button
									variant={isSelected ? 'secondary' : 'ghost'}
									onclick={() => selectItem({ type: 'userDoc', id: uDoc.slug || uDoc.id, title: uDoc.title, category: uDoc.category, path: `/my-docs/${uDoc.slug || uDoc.id}` })}
									onmouseenter={() => (selectedIndex = uIdx)}
									class="flex h-auto w-full items-center justify-between px-3 py-2 text-left text-xs font-normal"
								>
									<div class="flex items-center gap-2.5 truncate">
										<BookUser class="h-4 w-4 text-primary shrink-0" />
										<div class="truncate">
											<div class="font-medium text-foreground truncate">{uDoc.title}</div>
											<div class="text-[10px] text-muted-foreground truncate">
												{uDoc.subcategory ? `${uDoc.category} / ${uDoc.subcategory}` : uDoc.category}
											</div>
										</div>
									</div>
									<Badge variant="outline" class="text-[9px] border-primary/30 text-primary">
										Pribadi
									</Badge>
								</Button>
							{/each}
						</div>
					{/if}

					<!-- Apps Category -->
					{#if filteredApps.length > 0}
						<div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							Apps (Sistem Enterprise)
						</div>
						<div class="space-y-0.5">
							{#each filteredApps as prog, j}
								{@const itemIdx = filteredArticles.length + filteredUserDocs.length + j}
								{@const isSelected = selectedIndex === itemIdx}
								<Button
									variant={isSelected ? 'secondary' : 'ghost'}
									onclick={() => selectItem({ type: 'app', id: prog.id, title: prog.title, category: prog.categoryName, url: prog.url })}
									onmouseenter={() => (selectedIndex = itemIdx)}
									class="flex h-auto w-full items-center justify-between px-3 py-2 text-left text-xs font-normal"
								>
									<div class="flex items-center gap-2.5 truncate">
										<ExternalLink class="h-4 w-4 text-muted-foreground shrink-0" />
										<div class="truncate">
											<div class="font-medium text-foreground truncate">{prog.title}</div>
											<div class="text-[10px] text-muted-foreground truncate">{prog.subtitle}</div>
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
			<div class="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
				<div class="flex items-center gap-3">
					<span class="flex items-center gap-1">
						<Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">↑↓</Badge> Navigasi
					</span>
					<span class="flex items-center gap-1">
						<Badge variant="outline" class="px-1 py-0 text-[9px] font-mono">↵</Badge> Buka
					</span>
				</div>
				<span>Pencarian Cepat Global (Docs, My Docs, Apps)</span>
			</div>
		</div>
	</div>
{/if}
