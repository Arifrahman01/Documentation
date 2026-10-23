<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { marked } from 'marked';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import DocEditorModal from '$lib/components/DocEditorModal.svelte';
	import { 
		BookOpen, 
		Sparkles, 
		ChevronRight, 
		ChevronLeft, 
		FileText, 
		Copy, 
		Check, 
		ListTree,
		Plus,
		Edit3,
		Trash2,
		Clock,
		Search,
		Calendar,
		Tag,
		Layers
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local mutable document state that responds to prop changes or editor saves
	let editorDoc = $state<any>(null);
	let currentDoc = $derived(editorDoc ?? data.doc);
	let customTree = $state<any>(null);
	let currentTree = $derived(customTree ?? data.treeData);
	let sidebarFilter = $state('');

	$effect(() => {
		// Reset local override when route param slug changes
		if (data.slug) {
			editorDoc = null;
		}
	});

	let isEditorOpen = $state(false);
	let editorMode = $state<'create' | 'edit'>('edit');
	let copiedUrl = $state(false);
	let isDeleting = $state(false);

	$effect(() => {
		ui.currentContext = {
			type: 'docs',
			title: currentDoc?.title || data.article.title,
			key: data.slug,
			snippet: currentDoc?.description || currentDoc?.snippet || data.article.snippet
		};
	});

	// Reading time estimate
	const readingTime = $derived.by(() => {
		const words = (currentDoc?.content || '').split(/\s+/).length;
		return Math.max(1, Math.ceil(words / 180));
	});

	// Parse TOC Headings (H2 and H3)
	const headings = $derived.by(() => {
		const lines = (currentDoc?.content || '').split('\n');
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
		let raw = currentDoc?.content || '';
		// Replace markdown alert blocks
		raw = raw.replace(/>\s*\[!NOTE\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-blue-500 bg-blue-50/70 p-4 text-xs text-blue-950 dark:bg-blue-950/40 dark:text-blue-200"><strong>Note:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!TIP\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200"><strong>Tip:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!IMPORTANT\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-amber-500 bg-amber-50/70 p-4 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"><strong>Important:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!WARNING\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-red-500 bg-red-50/70 p-4 text-xs text-red-950 dark:bg-red-950/40 dark:text-red-200"><strong>Warning:</strong> $1</div>');
		
		return marked.parse(raw);
	});

	// Filtered sidebar groups
	const filteredTree = $derived.by(() => {
		const q = sidebarFilter.toLowerCase().trim();
		if (!q) return currentTree;
		return currentTree
			.map((group: any) => ({
				...group,
				nodes: group.nodes.filter((n: any) => n.title.toLowerCase().includes(q))
			}))
			.filter((group: any) => group.nodes.length > 0);
	});

	// Distinct categories list
	const categoriesList = $derived.by(() => {
		return currentTree.map((g: any) => g.title);
	});

	function askAiAboutDoc() {
		ui.openAi(`Rangkum konsep utama, best practice, dan arsitektur dari dokumen "${currentDoc?.title || data.article.title}".`, {
			type: 'docs',
			title: currentDoc?.title || data.article.title,
			key: data.slug
		});
	}

	function openCreateModal() {
		editorMode = 'create';
		isEditorOpen = true;
	}

	function openEditModal() {
		editorMode = 'edit';
		isEditorOpen = true;
	}

	function handleSaved(savedDoc: any) {
		editorDoc = savedDoc;
		// Refresh tree
		fetch('/api/docs')
			.then((r) => r.json())
			.then((d) => {
				if (d.treeData) customTree = d.treeData;
			})
			.catch(() => {});
		
		if (savedDoc.slug && savedDoc.slug !== data.slug) {
			goto(`/docs/${savedDoc.slug}`);
		}
	}

	async function handleDelete() {
		if (!confirm(`Apakah Anda yakin ingin menghapus dokumen "${currentDoc?.title}"?`)) {
			return;
		}

		isDeleting = true;
		try {
			const res = await fetch(`/api/docs/${data.slug}`, { method: 'DELETE' });
			if (res.ok) {
				alert('Dokumen berhasil dihapus.');
				goto('/docs/get-started/quick-start');
			} else {
				alert('Gagal menghapus dokumen.');
			}
		} catch (err: any) {
			alert('Terjadi kesalahan saat menghapus: ' + err.message);
		} finally {
			isDeleting = false;
		}
	}

	function copyPageUrl() {
		if (typeof window !== 'undefined') {
			navigator.clipboard.writeText(window.location.href);
			copiedUrl = true;
			setTimeout(() => (copiedUrl = false), 2000);
		}
	}
</script>

<svelte:head>
	<title>{currentDoc?.title || data.article.title} - Portal Dokumentasi</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	<div class="flex gap-8 py-8">
		<!-- Left Sidebar (Desktop) -->
		<aside class="hidden lg:block w-72 shrink-0">
			<div class="sticky top-24 space-y-4">
				<!-- Header & Add Button -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold uppercase tracking-wider text-zinc-400">Daftar Panduan</span>
						<Badge variant="outline" class="text-[10px]">{currentTree.length} Kategori</Badge>
					</div>

					<Button
						variant="outline"
						size="sm"
						onclick={openCreateModal}
						class="h-7 gap-1 px-2 text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
					>
						<Plus class="h-3.5 w-3.5" />
						<span>Buat</span>
					</Button>
				</div>

				<!-- Quick Filter Input -->
				<div class="relative">
					<Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
					<input
						type="text"
						bind:value={sidebarFilter}
						placeholder="Filter panduan..."
						class="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
					/>
				</div>

				<!-- Navigation Groups -->
				<nav class="space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto pr-1">
					{#each filteredTree as group}
						<div>
							<div class="flex items-center gap-1.5 px-2 pb-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
								<Layers class="h-3 w-3 text-zinc-400" />
								<span>{group.title}</span>
							</div>
							<div class="space-y-0.5">
								{#each group.nodes as node}
									{@const isCurrent = node.path === data.slug}
									<a
										href="/docs/{node.path}"
										class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {isCurrent
											? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-2xs'
											: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'}"
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
			<!-- Breadcrumb, Metadata & Actions Bar -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
				<div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
					<a href="/" class="hover:underline">Home</a>
					<ChevronRight class="h-3.5 w-3.5" />
					<a href="/docs/get-started/quick-start" class="hover:underline">Docs</a>
					<ChevronRight class="h-3.5 w-3.5" />
					<span class="text-zinc-900 dark:text-zinc-100 font-medium">{currentDoc?.category || data.article.category}</span>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={openEditModal}
						class="h-8 gap-1.5 text-xs shadow-2xs"
					>
						<Edit3 class="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" />
						<span>Edit Dokumen</span>
					</Button>

					<Button
						variant="outline"
						size="sm"
						onclick={openCreateModal}
						class="h-8 gap-1.5 text-xs shadow-2xs border-dashed"
					>
						<Plus class="h-3.5 w-3.5" />
						<span>Tambah Baru</span>
					</Button>

					<Button
						variant="secondary"
						size="sm"
						onclick={askAiAboutDoc}
						class="h-8 gap-1.5 text-xs border border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
					>
						<Sparkles class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
						<span>Tanya AI</span>
					</Button>
				</div>
			</div>

			<!-- Document Title & Meta Header -->
			<div class="mt-6 mb-8">
				<div class="flex flex-wrap items-center gap-2 mb-3">
					<Badge variant="secondary" class="text-[11px] font-semibold">
						{currentDoc?.category || data.article.category}
					</Badge>
					<span class="text-xs text-zinc-400">•</span>
					<div class="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
						<Clock class="h-3.5 w-3.5" />
						<span>{readingTime} menit baca</span>
					</div>
					{#if currentDoc?.updatedAt}
						<span class="text-xs text-zinc-400">•</span>
						<div class="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
							<Calendar class="h-3.5 w-3.5" />
							<span>{new Date(currentDoc.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
						</div>
					{/if}
				</div>

				<h1 class="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
					{currentDoc?.title || data.article.title}
				</h1>

				{#if currentDoc?.description || data.article.snippet}
					<p class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
						{currentDoc?.description || data.article.snippet}
					</p>
				{/if}

				<!-- Tags list -->
				{#if currentDoc?.tags && currentDoc.tags.length > 0}
					<div class="mt-4 flex flex-wrap items-center gap-1.5">
						{#each currentDoc.tags as tag}
							<Badge variant="outline" class="gap-1 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
								<Tag class="h-2.5 w-2.5 opacity-60" />
								<span>{tag}</span>
							</Badge>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Markdown Rendered Body with Tailwind Typography -->
			<article class="prose prose-zinc dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-code:rounded prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none leading-relaxed">
				{@html renderedHtml}
			</article>

			<!-- Quick Editor Trigger Banner -->
			<div class="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<Sparkles class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
							<span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ingin melengkapi atau memperbarui panduan ini?</span>
						</div>
						<p class="text-xs text-zinc-500 dark:text-zinc-400">
							Anda dapat mengedit langsung atau meminta AI Copilot untuk menambahkan bagian baru, contoh kode, atau diagram.
						</p>
					</div>

					<div class="flex items-center gap-2 shrink-0">
						<Button size="sm" variant="outline" onclick={openEditModal} class="gap-1 text-xs">
							<Edit3 class="h-3.5 w-3.5" />
							<span>Edit Dokumen</span>
						</Button>
						<Button size="sm" onclick={copyPageUrl} variant="ghost" class="gap-1 text-xs">
							{#if copiedUrl}
								<Check class="h-3.5 w-3.5 text-emerald-600" />
								<span>Tersalin</span>
							{:else}
								<Copy class="h-3.5 w-3.5" />
								<span>Salin Link</span>
							{/if}
						</Button>
					</div>
				</div>
			</div>

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

			<!-- Danger zone / Delete button -->
			<div class="mt-8 flex justify-end">
				<Button
					variant="ghost"
					size="sm"
					onclick={handleDelete}
					disabled={isDeleting}
					class="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
				>
					<Trash2 class="h-3.5 w-3.5 mr-1" />
					<span>Hapus Dokumen Ini</span>
				</Button>
			</div>
		</div>

		<!-- Right Sidebar (TOC & AI Help) -->
		<aside class="hidden xl:block w-64 shrink-0">
			<div class="sticky top-24 space-y-6">
				<!-- Table of Contents -->
				{#if headings.length > 0}
					<div class="space-y-3">
						<div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
							<ListTree class="h-3.5 w-3.5" />
							<span>Di Halaman Ini</span>
						</div>
						<nav class="space-y-1.5 text-xs max-h-[300px] overflow-y-auto pr-1">
							{#each headings as h}
								<a
									href="#{h.id}"
									class="block transition-colors {h.level === 3 ? 'pl-3' : ''} text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 truncate"
								>
									{h.text}
								</a>
							{/each}
						</nav>
					</div>
				{/if}

				<!-- Quick AI Assistant Action Widget -->
				<div class="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
					<div class="flex items-center gap-2 mb-2">
						<Sparkles class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
						<span class="text-xs font-bold text-indigo-950 dark:text-indigo-200">AI Assistant Cepat</span>
					</div>
					<p class="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
						Minta AI merangkum isi panduan ini atau jelaskan arsitektur teknis secara interaktif.
					</p>
					<div class="space-y-1.5">
						<Button
							size="sm"
							variant="outline"
							onclick={() => ui.openAi(`Rangkum poin kunci dokumen "${currentDoc?.title}" dalam 3 butir padat.`)}
							class="w-full justify-start text-[11px] h-7 bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-900"
						>
							⚡ Ringkas 3 Poin
						</Button>
						<Button
							size="sm"
							variant="outline"
							onclick={() => ui.openAi(`Buatkan contoh kode implementasi praktis terkait topik "${currentDoc?.title}".`)}
							class="w-full justify-start text-[11px] h-7 bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-900"
						>
							💻 Buat Contoh Kode
						</Button>
					</div>
				</div>
			</div>
		</aside>
	</div>
</div>

<!-- Modal Document Editor & AI Generator -->
<DocEditorModal
	bind:isOpen={isEditorOpen}
	mode={editorMode}
	initialDoc={editorMode === 'edit' ? currentDoc : null}
	categories={categoriesList}
	onSave={handleSaved}
/>
