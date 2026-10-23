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
		Layers, 
		Building2, 
		BarChart3, 
		Globe, 
		ExternalLink, 
		ChevronDown, 
		ChevronsUpDown,
		X,
		Maximize2,
		Minimize2,
		Download,
		FileCode,
		FolderTree,
		MousePointerClick
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Sidebar View Switcher: 'explorer' (Semua Dokumen, default) vs 'outline' (Struktur Bab Catatan)
	let sidebarView = $state<'outline' | 'explorer'>('explorer');

	// Active main section filter for explorer: 'SAP' | 'SAC' | 'WEB' | 'ALL'
	let activeSection = $state<'SAP' | 'SAC' | 'WEB' | 'ALL'>('ALL');

	// Local mutable document state that responds to prop changes or editor saves
	let editorDoc = $state<any>(null);
	let currentDoc = $derived(editorDoc ?? data.doc);
	let customTree = $state<any>(null);
	let currentTree = $derived(customTree ?? data.treeData);
	let sidebarFilter = $state('');

	// Accordion / Collapsible state for category groups in Explorer
	let expandedCategories = $state<Record<string, boolean>>({});

	// VS Code Tabs Management
	interface DocTab {
		slug: string;
		title: string;
		section?: string;
	}
	let openTabs = $state<DocTab[]>([]);

	// Focus mode (Distraction-free / Full width reading)
	let isFocusMode = $state(false);

	// In-page search toggle
	let isSearchActive = $state(false);
	let inPageSearchQuery = $state('');

	// Outline Hierarchical Tree state
	interface OutlineNode {
		id: string;
		text: string;
		level: number;
		children: OutlineNode[];
	}
	let outlineFilter = $state('');
	let collapsedOutline = $state<Record<string, boolean>>({});
	let activeHeadingId = $state<string>('');

	// -------------------------------------------------------------
	// OBSIDIAN / NOTION STYLE CONTEXT MENU STATE (KLIK KANAN)
	// -------------------------------------------------------------
	interface ContextMenuState {
		open: boolean;
		x: number;
		y: number;
		targetDoc: any;
	}

	let contextMenu = $state<ContextMenuState>({
		open: false,
		x: 0,
		y: 0,
		targetDoc: null
	});

	let isEditorOpen = $state(false);
	let editorMode = $state<'create' | 'edit'>('edit');
	let editingDocTarget = $state<any>(null);
	let copiedUrl = $state(false);
	let copiedMarkdown = $state(false);
	let isDeleting = $state(false);

	// Load & sync open tabs with localStorage
	$effect(() => {
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem('portal_open_tabs');
				if (stored) {
					openTabs = JSON.parse(stored);
				}
			} catch (e) {}
		}
	});

	$effect(() => {
		if (data.slug) {
			const currentTitle = currentDoc?.title || data.article?.title || data.slug;
			const currentSection = currentDoc?.section || data.article?.section || 'SAP';
			
			const existingIndex = openTabs.findIndex((t) => t.slug === data.slug);
			if (existingIndex >= 0) {
				if (openTabs[existingIndex].title !== currentTitle) {
					openTabs[existingIndex].title = currentTitle;
				}
			} else {
				const updated = [...openTabs, { slug: data.slug, title: currentTitle, section: currentSection }].slice(-10);
				openTabs = updated;
			}

			if (typeof window !== 'undefined') {
				try {
					localStorage.setItem('portal_open_tabs', JSON.stringify(openTabs));
				} catch (e) {}
			}
		}
	});

	function closeTab(tabSlug: string, event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		const idx = openTabs.findIndex((t) => t.slug === tabSlug);
		if (idx === -1) return;

		const nextTabs = openTabs.filter((t) => t.slug !== tabSlug);
		openTabs = nextTabs;

		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('portal_open_tabs', JSON.stringify(nextTabs));
			} catch (e) {}
		}

		if (tabSlug === data.slug) {
			if (nextTabs.length > 0) {
				const nextIndex = Math.min(idx, nextTabs.length - 1);
				goto(`/docs/${nextTabs[nextIndex].slug}`);
			} else {
				goto('/docs/sap/overview');
			}
		}
	}

	function isCategoryExpanded(group: any): boolean {
		if (sidebarFilter.trim()) return true;
		if (expandedCategories[group.title] !== undefined) {
			return expandedCategories[group.title];
		}
		const containsCurrent = (group.nodes || []).some((n: any) => n.path === data.slug || n.slug === data.slug);
		return containsCurrent;
	}

	function toggleCategory(catTitle: string, group: any) {
		const current = isCategoryExpanded(group);
		expandedCategories[catTitle] = !current;
	}

	const allExpanded = $derived.by(() => {
		if (!filteredTree.length) return false;
		return filteredTree.every((g: any) => isCategoryExpanded(g));
	});

	function toggleAllCategories() {
		const nextState = !allExpanded;
		const updated: Record<string, boolean> = {};
		for (const g of filteredTree) {
			updated[g.title] = nextState;
		}
		expandedCategories = updated;
	}

	$effect(() => {
		if (data.slug) {
			editorDoc = null;
			const sec = (data.article?.section || currentDoc?.section) as 'SAP' | 'SAC' | 'WEB';
			if (['SAP', 'SAC', 'WEB'].includes(sec)) {
				activeSection = sec;
			}
			const cat = currentDoc?.category || data.article?.category;
			if (cat) {
				expandedCategories[cat] = true;
			}
		}
	});

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

	// Build Hierarchical Outline Tree: H1 -> H2 -> H3
	const outlineTree = $derived.by(() => {
		const lines = (currentDoc?.content || '').split('\n');
		const rawHeadings: { id: string; text: string; level: number }[] = [];

		for (const line of lines) {
			const m = line.match(/^(#{1,4})\s+(.+)$/);
			if (m) {
				const level = m[1].length;
				const text = m[2].trim().replace(/[*_`]/g, '');
				const id = text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
				rawHeadings.push({ id, text, level });
			}
		}

		if (rawHeadings.length === 0) return [];

		const rootNodes: OutlineNode[] = [];
		const stack: { node: OutlineNode; level: number }[] = [];

		for (const h of rawHeadings) {
			const node: OutlineNode = { id: h.id, text: h.text, level: h.level, children: [] };

			while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
				stack.pop();
			}

			if (stack.length === 0) {
				rootNodes.push(node);
			} else {
				stack[stack.length - 1].node.children.push(node);
			}

			stack.push({ node, level: h.level });
		}

		return rootNodes;
	});

	function isOutlineCollapsed(nodeId: string): boolean {
		if (outlineFilter.trim()) return false;
		return collapsedOutline[nodeId] === true;
	}

	function toggleOutlineNode(nodeId: string) {
		collapsedOutline[nodeId] = !isOutlineCollapsed(nodeId);
	}

	function toggleAllOutline() {
		const currentlyAllExpanded = Object.values(collapsedOutline).every((v) => !v);
		const updated: Record<string, boolean> = {};
		function traverse(nodes: OutlineNode[]) {
			for (const n of nodes) {
				updated[n.id] = currentlyAllExpanded;
				if (n.children) traverse(n.children);
			}
		}
		traverse(outlineTree);
		collapsedOutline = updated;
	}

	function filterOutlineNodes(nodes: OutlineNode[], query: string): OutlineNode[] {
		if (!query.trim()) return nodes;
		const q = query.toLowerCase();
		const result: OutlineNode[] = [];
		for (const n of nodes) {
			const matchesSelf = n.text.toLowerCase().includes(q);
			const filteredChildren = filterOutlineNodes(n.children, query);
			if (matchesSelf || filteredChildren.length > 0) {
				result.push({
					...n,
					children: matchesSelf ? n.children : filteredChildren
				});
			}
		}
		return result;
	}

	const filteredOutline = $derived(filterOutlineNodes(outlineTree, outlineFilter));

	function scrollToHeading(id: string) {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			activeHeadingId = id;
			el.classList.add('outline-anchor-target');
			setTimeout(() => {
				el.classList.remove('outline-anchor-target');
			}, 2000);
		}
	}

	// Active heading tracking on scroll
	$effect(() => {
		if (typeof window === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target.id) {
						activeHeadingId = entry.target.id;
						break;
					}
				}
			},
			{ rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
		);

		const observedHeadings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id]');
		observedHeadings.forEach((h) => observer.observe(h));

		return () => {
			observer.disconnect();
		};
	});

	// Render Markdown HTML with GitHub Alerts formatting & Heading Anchor IDs
	const renderedHtml = $derived.by(() => {
		let raw = currentDoc?.content || '';
		raw = raw.replace(/>\s*\[!NOTE\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-blue-500 bg-blue-50/70 p-4 text-xs text-blue-950 dark:bg-blue-950/40 dark:text-blue-200"><strong>Note:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!TIP\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200"><strong>Tip:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!IMPORTANT\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-amber-500 bg-amber-50/70 p-4 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-200"><strong>Important:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!WARNING\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-xl border-l-4 border-red-500 bg-red-50/70 p-4 text-xs text-red-950 dark:bg-red-950/40 dark:text-red-200"><strong>Warning:</strong> $1</div>');
		
		let parsed = marked.parse(raw) as string;
		parsed = parsed.replace(/<table>/g, '<div class="overflow-x-auto my-5 rounded-xl border border-zinc-200 dark:border-zinc-800"><table class="my-0">');
		parsed = parsed.replace(/<\/table>/g, '</table></div>');

		parsed = parsed.replace(/<h([1-4])>(.*?)<\/h\1>/g, (match, level, content) => {
			const cleanText = content.replace(/<[^>]+>/g, '').trim().replace(/[*_`]/g, '');
			const id = cleanText.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
			return `<h${level} id="${id}" class="scroll-mt-28 group relative">${content}</h${level}>`;
		});

		return parsed;
	});

	// Filtered sidebar groups based on active section and search filter
	const filteredTree = $derived.by(() => {
		const q = sidebarFilter.toLowerCase().trim();
		return currentTree
			.map((group: any) => {
				const nodes = (group.nodes || []).filter((n: any) => {
					const nodeSec = n.section || group.section || 'SAP';
					const matchesSection = activeSection === 'ALL' || nodeSec === activeSection;
					const matchesQuery = !q || n.title.toLowerCase().includes(q) || (n.category && n.category.toLowerCase().includes(q));
					return matchesSection && matchesQuery;
				});
				return {
					...group,
					nodes
				};
			})
			.filter((group: any) => group.nodes.length > 0);
	});

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

	function handleSaved(savedDoc: any) {
		editorDoc = savedDoc;
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

	function copyPageUrl() {
		if (typeof window !== 'undefined') {
			navigator.clipboard.writeText(window.location.href);
			copiedUrl = true;
			setTimeout(() => (copiedUrl = false), 2000);
		}
	}

	function copyRawMarkdown() {
		if (typeof window !== 'undefined' && currentDoc?.content) {
			navigator.clipboard.writeText(currentDoc.content);
			copiedMarkdown = true;
			setTimeout(() => (copiedMarkdown = false), 2000);
		}
	}

	function downloadMarkdown() {
		if (!currentDoc?.content) return;
		const blob = new Blob([currentDoc.content], { type: 'text/markdown;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const fileName = (currentDoc.title || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
		a.download = fileName;
		a.click();
		URL.revokeObjectURL(url);
	}

	// -------------------------------------------------------------
	// OBSIDIAN / NOTION CONTEXT MENU HANDLERS
	// -------------------------------------------------------------
	function openContextMenu(e: MouseEvent, docTarget: any = null) {
		e.preventDefault();
		e.stopPropagation();

		const menuWidth = 230;
		const menuHeight = 290;
		const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
		const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

		contextMenu = {
			open: true,
			x: Math.max(10, x),
			y: Math.max(10, y),
			targetDoc: docTarget || currentDoc
		};
	}

	function closeContextMenu() {
		if (contextMenu.open) {
			contextMenu = { open: false, x: 0, y: 0, targetDoc: null };
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('click', closeContextMenu);
			const handleKey = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					closeContextMenu();
				}
				// Obsidian Shortcut: Ctrl + E to Edit current note
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !isEditorOpen) {
					e.preventDefault();
					handleContextMenuEdit(currentDoc);
				}
				// Obsidian Shortcut: Ctrl + N to Create new note
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !isEditorOpen) {
					e.preventDefault();
					handleContextMenuCreate(currentDoc);
				}
			};
			window.addEventListener('keydown', handleKey);
			return () => {
				window.removeEventListener('click', closeContextMenu);
				window.removeEventListener('keydown', handleKey);
			};
		}
	});

	async function handleContextMenuEdit(target: any) {
		closeContextMenu();
		const docToEdit = target || currentDoc;
		const slug = docToEdit.slug || docToEdit.path || docToEdit.id;

		if (docToEdit.content || slug === data.slug) {
			editingDocTarget = docToEdit.content ? docToEdit : currentDoc;
			editorMode = 'edit';
			isEditorOpen = true;
		} else {
			try {
				const res = await fetch(`/api/docs/${slug}`);
				if (res.ok) {
					editingDocTarget = await res.json();
				} else {
					editingDocTarget = docToEdit;
				}
			} catch (e) {
				editingDocTarget = docToEdit;
			}
			editorMode = 'edit';
			isEditorOpen = true;
		}
	}

	function handleContextMenuCreate(target: any) {
		closeContextMenu();
		const parentDoc = target || currentDoc;
		const sec = parentDoc?.section && ['SAP', 'SAC', 'WEB'].includes(parentDoc.section)
			? parentDoc.section
			: (activeSection !== 'ALL' ? activeSection : (currentDoc?.section || 'SAP'));
		const cat = parentDoc?.category || currentDoc?.category || 'General';

		editingDocTarget = {
			section: sec,
			category: cat,
			title: '',
			content: '',
			tags: [sec, cat]
		};
		editorMode = 'create';
		isEditorOpen = true;
	}

	function handleContextMenuAi(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		ui.openAi(`Jelaskan rincian dan arsitektur dari dokumen "${t.title}".`, {
			type: 'docs',
			title: t.title,
			key: t.slug || t.path || t.id
		});
	}

	function handleContextMenuCopyLink(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		const slug = t.slug || t.path || t.id;
		if (typeof window !== 'undefined') {
			const fullUrl = `${window.location.origin}/docs/${slug}`;
			navigator.clipboard.writeText(fullUrl);
			copiedUrl = true;
			setTimeout(() => (copiedUrl = false), 2000);
		}
	}

	function handleContextMenuCopyMarkdown(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		if (t.content && typeof window !== 'undefined') {
			navigator.clipboard.writeText(t.content);
			copiedMarkdown = true;
			setTimeout(() => (copiedMarkdown = false), 2000);
		} else {
			copyRawMarkdown();
		}
	}

	function handleContextMenuDownload(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		if (t.content) {
			const blob = new Blob([t.content], { type: 'text/markdown;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${(t.title || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
			a.click();
			URL.revokeObjectURL(url);
		} else {
			downloadMarkdown();
		}
	}

	async function handleContextMenuDelete(target: any) {
		closeContextMenu();
		const docToDelete = target || currentDoc;
		const slug = docToDelete.slug || docToDelete.path || docToDelete.id;
		const title = docToDelete.title || 'dokumen ini';

		if (!confirm(`Apakah Anda yakin ingin menghapus dokumen "${title}"?`)) {
			return;
		}

		isDeleting = true;
		try {
			const res = await fetch(`/api/docs/${slug}`, { method: 'DELETE' });
			if (res.ok) {
				alert(`Dokumen "${title}" berhasil dihapus.`);
				if (slug === data.slug) {
					goto('/docs/sap/overview');
				} else {
					fetch('/api/docs')
						.then((r) => r.json())
						.then((d) => {
							if (d.treeData) customTree = d.treeData;
						})
						.catch(() => {});
				}
			} else {
				alert('Gagal menghapus dokumen.');
			}
		} catch (err: any) {
			alert('Terjadi kesalahan saat menghapus: ' + err.message);
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>{currentDoc?.title || data.article.title} - Portal Dokumentasi</title>
</svelte:head>

<!-- Recursive Snippet for Hierarchical Outline Items -->
{#snippet renderOutlineItem(node: OutlineNode, depth: number)}
	{@const collapsed = isOutlineCollapsed(node.id)}
	{@const hasChildren = node.children && node.children.length > 0}
	{@const isActive = activeHeadingId === node.id}

	<div
		class="outline-node group/node"
		oncontextmenu={(e) => openContextMenu(e, currentDoc)}
		role="treeitem"
		aria-selected={isActive}
		tabindex="0"
	>
		<div
			class="flex items-center gap-1.5 py-1 px-1.5 rounded-md text-xs transition-colors {isActive
				? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-l-2 border-blue-600'
				: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'}"
			style="padding-left: {depth * 14 + 6}px;"
		>
			{#if hasChildren}
				<button
					type="button"
					onclick={() => toggleOutlineNode(node.id)}
					class="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-transform shrink-0"
				>
					<ChevronDown
						class="h-3 w-3 transition-transform duration-150 {collapsed ? '-rotate-90' : 'rotate-0'}"
					/>
				</button>
			{:else}
				<span class="w-3 shrink-0 text-center text-zinc-300 dark:text-zinc-600 font-bold">•</span>
			{/if}

			<button
				type="button"
				onclick={() => scrollToHeading(node.id)}
				class="truncate text-left flex-1 hover:underline"
				title={node.text}
			>
				{node.text}
			</button>
		</div>

		{#if hasChildren && !collapsed}
			<div class="border-l border-zinc-200/80 dark:border-zinc-800/80 ml-3">
				{#each node.children as child}
					{@render renderOutlineItem(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div 
	class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
	oncontextmenu={(e) => openContextMenu(e, currentDoc)}
	role="region"
	aria-label="Dokumentasi Workspace"
>
	<!-- ======================================================== -->
	<!-- VS CODE TOP TAB BAR                                       -->
	<!-- ======================================================== -->
	<div class="mt-4 flex items-center justify-between border-b border-zinc-200 bg-zinc-100/90 dark:border-zinc-800 dark:bg-zinc-950 rounded-t-xl px-2 pt-1.5 overflow-x-auto">
		<div class="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
			{#each openTabs as tab}
				{@const isActive = tab.slug === data.slug}
				<div
					class="group relative flex items-center gap-2 rounded-t-lg border-t-2 px-3 py-1.5 text-xs font-medium transition-all {isActive
						? 'border-indigo-600 bg-white text-zinc-900 shadow-2xs dark:border-indigo-500 dark:bg-zinc-900 dark:text-zinc-100'
						: 'border-transparent bg-zinc-200/60 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'}"
					oncontextmenu={(e) => openContextMenu(e, tab)}
					role="tab"
					tabindex="0"
				>
					<a
						href="/docs/{tab.slug}"
						class="flex items-center gap-1.5 truncate max-w-[170px]"
						title="{tab.title} (Klik kanan untuk opsi)"
					>
						{#if tab.section === 'SAP'}
							<span class="text-blue-600 dark:text-blue-400 font-bold text-[10px]">SAP</span>
						{:else if tab.section === 'SAC'}
							<span class="text-purple-600 dark:text-purple-400 font-bold text-[10px]">SAC</span>
						{:else}
							<FileCode class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
						{/if}
						<span class="truncate">{tab.title}.md</span>
					</a>

					<button
						type="button"
						onclick={(e) => closeTab(tab.slug, e)}
						title="Tutup Tab"
						class="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			{/each}
		</div>

		<!-- Right Side Tab Action Buttons -->
		<div class="flex items-center gap-1.5 pb-1 pl-2 shrink-0">
			<Badge variant="outline" class="hidden sm:inline-flex gap-1 text-[10px] font-mono border-zinc-300 dark:border-zinc-700">
				<span>Markdown Viewer</span>
			</Badge>
			<Button
				variant="ghost"
				size="icon"
				title={isFocusMode ? 'Keluar Mode Fokus' : 'Mode Fokus Layar Penuh'}
				onclick={() => (isFocusMode = !isFocusMode)}
				class="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
			>
				{#if isFocusMode}
					<Minimize2 class="h-3.5 w-3.5" />
				{:else}
					<Maximize2 class="h-3.5 w-3.5" />
				{/if}
			</Button>
		</div>
	</div>

	<!-- ======================================================== -->
	<!-- VS CODE BREADCRUMB BAR                                    -->
	<!-- ======================================================== -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70">
		<div class="flex items-center gap-1.5 font-mono text-[11px] overflow-x-auto truncate">
			<a href="/" class="hover:underline flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
				<span>Home</span>
			</a>
			<ChevronRight class="h-3 w-3 text-zinc-400 shrink-0" />
			<span class="font-semibold {currentDoc?.section === 'SAP' ? 'text-blue-600 dark:text-blue-400' : currentDoc?.section === 'SAC' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}">
				{currentDoc?.section || data.article.section || 'SAP'}
			</span>
			<ChevronRight class="h-3 w-3 text-zinc-400 shrink-0" />
			<span class="text-zinc-700 dark:text-zinc-300">{currentDoc?.category || data.article.category}</span>
			<ChevronRight class="h-3 w-3 text-zinc-400 shrink-0" />
			<span class="font-bold text-zinc-900 dark:text-zinc-100 truncate">{currentDoc?.title || data.article.title}.md</span>
		</div>

		<div class="flex items-center gap-2 shrink-0">
			{#if currentDoc?.sacUrl}
				<a
					href={currentDoc.sacUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-semibold bg-purple-600 text-white hover:bg-purple-700 shadow-2xs transition-colors"
				>
					<ExternalLink class="h-3 w-3" />
					<span>Buka Story SAC ↗</span>
				</a>
			{/if}
			<div class="flex items-center gap-1 text-[11px] text-zinc-400">
				<Clock class="h-3 w-3" />
				<span>{readingTime}m</span>
			</div>
		</div>
	</div>

	<!-- ======================================================== -->
	<!-- VS CODE MARKDOWN TOOLBAR                                  -->
	<!-- ======================================================== -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/30">
		<!-- Left Tools: View Switchers -->
		<div class="flex items-center gap-1">
			<Button
				variant={sidebarView === 'explorer' ? 'secondary' : 'ghost'}
				size="sm"
				onclick={() => (sidebarView = 'explorer')}
				title="Tampilkan Explorer / Semua Dokumen"
				class="h-7 gap-1 px-2.5 text-xs {sidebarView === 'explorer' ? 'font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50' : 'text-zinc-600 dark:text-zinc-400'}"
			>
				<FolderTree class="h-3.5 w-3.5" />
				<span>Explorer</span>
			</Button>

			<Button
				variant={sidebarView === 'outline' ? 'secondary' : 'ghost'}
				size="sm"
				onclick={() => (sidebarView = 'outline')}
				title="Tampilkan Outline / Hierarki Catatan"
				class="h-7 gap-1 px-2.5 text-xs {sidebarView === 'outline' ? 'font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50' : 'text-zinc-600 dark:text-zinc-400'}"
			>
				<ListTree class="h-3.5 w-3.5" />
				<span>Outline</span>
			</Button>

			<Separator orientation="vertical" class="h-4 mx-1" />

			<Button
				variant="ghost"
				size="sm"
				onclick={() => (isSearchActive = !isSearchActive)}
				title="Cari di catatan ini"
				class="h-7 gap-1 px-2 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
			>
				<Search class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Cari</span>
			</Button>
		</div>

		<!-- Right Tools: Actions & Obsidian/Notion Tip -->
		<div class="flex items-center gap-1">
			<div class="hidden md:flex items-center gap-1 text-[11px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/60 mr-1">
				<MousePointerClick class="h-3 w-3 text-zinc-400" />
				<span>Klik kanan untuk Edit & Tambah Baru</span>
			</div>

			<Button
				variant="secondary"
				size="sm"
				onclick={askAiAboutDoc}
				class="h-7 gap-1 px-2.5 text-xs border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
			>
				<Sparkles class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
				<span>AI Assistant</span>
			</Button>

			<Button
				variant="ghost"
				size="icon"
				title="Salin Raw Markdown"
				onclick={copyRawMarkdown}
				class="h-7 w-7 text-zinc-600 dark:text-zinc-400"
			>
				{#if copiedMarkdown}
					<Check class="h-3.5 w-3.5 text-emerald-600" />
				{:else}
					<FileText class="h-3.5 w-3.5" />
				{/if}
			</Button>

			<Button
				variant="ghost"
				size="icon"
				title="Salin Tautan Halaman"
				onclick={copyPageUrl}
				class="h-7 w-7 text-zinc-600 dark:text-zinc-400"
			>
				{#if copiedUrl}
					<Check class="h-3.5 w-3.5 text-emerald-600" />
				{:else}
					<Copy class="h-3.5 w-3.5" />
				{/if}
			</Button>

			<Button
				variant="ghost"
				size="icon"
				title="Unduh File (.md)"
				onclick={downloadMarkdown}
				class="h-7 w-7 text-zinc-600 dark:text-zinc-400"
			>
				<Download class="h-3.5 w-3.5" />
			</Button>
		</div>
	</div>

	<!-- In-Page Search Bar Banner -->
	{#if isSearchActive}
		<div class="flex items-center gap-2 border-b border-zinc-200 bg-amber-50/50 px-4 py-2 dark:border-zinc-800 dark:bg-amber-950/20">
			<Search class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
			<input
				type="text"
				bind:value={inPageSearchQuery}
				placeholder="Ketik kata kunci untuk mencari di dalam teks..."
				class="flex-1 bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
			/>
			<button
				type="button"
				onclick={() => { isSearchActive = false; inPageSearchQuery = ''; }}
				class="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}

	<!-- ======================================================== -->
	<!-- MAIN WORKSPACE LAYOUT (SIDEBAR + CONTENT + TOC)           -->
	<!-- ======================================================== -->
	<div class="flex gap-8 py-6">
		<!-- Left Sidebar (Desktop, hidden in focus mode) -->
		{#if !isFocusMode}
			<aside class="hidden lg:block w-72 shrink-0">
				<div class="sticky top-20 space-y-3.5">
					<!-- Top Switcher: EXPLORER vs OUTLINE -->
					<div class="grid grid-cols-2 gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-900 text-center text-xs font-semibold">
						<button
							type="button"
							onclick={() => (sidebarView = 'explorer')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all {sidebarView === 'explorer'
								? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
								: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
						>
							<FolderTree class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
							<span>Explorer</span>
						</button>

						<button
							type="button"
							onclick={() => (sidebarView = 'outline')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all {sidebarView === 'outline'
								? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
								: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
						>
							<ListTree class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
							<span>Outline</span>
							{#if outlineTree.length > 0}
								<span class="rounded px-1.5 py-0.2 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
									{outlineTree.length}
								</span>
							{/if}
						</button>
					</div>

					<!-- VIEW 1: OUTLINE MODE (Struktur Bab Catatan Ini, persis seperti di screenshot VS Code) -->
					{#if sidebarView === 'outline'}
						<div class="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/60">
							<div class="flex items-center justify-between">
								<span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
									Struktur Dokumen (Outline)
								</span>
								<div class="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										title="Ciutkan / Bentangkan Semua"
										onclick={toggleAllOutline}
										class="h-6 w-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
									>
										<ChevronsUpDown class="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>

							<!-- Filter in Outline -->
							<div class="relative">
								<Search class="absolute left-2.5 top-2.5 h-3 w-3 text-zinc-400" />
								<input
									type="text"
									bind:value={outlineFilter}
									placeholder="Cari bagian heading..."
									class="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-1 pl-7 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
								/>
							</div>

							<!-- Outline Hierarchical Tree -->
							<div class="space-y-0.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
								{#if filteredOutline.length > 0}
									{#each filteredOutline as node}
										{@render renderOutlineItem(node, 0)}
									{/each}
								{:else}
									<div class="py-6 text-center text-xs text-zinc-400">
										{#if outlineFilter.trim()}
											Tidak ada heading yang cocok dengan "{outlineFilter}"
										{:else}
											Dokumen ini belum memiliki heading (#, ##, ###)
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<!-- VIEW 2: EXPLORER MODE (Pohon Semua Dokumen SAP/SAC/WEB) -->
						<div
							class="space-y-3"
							oncontextmenu={(e) => openContextMenu(e, null)}
							role="region"
							aria-label="Semua Dokumen"
						>
							<!-- Header & Expand Button (Buttons Removed per user request) -->
							<div class="flex items-center justify-between">
								<span class="text-xs font-bold uppercase tracking-wider text-zinc-400">Semua Dokumen</span>
								<div class="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										title={allExpanded ? 'Ciutkan Semua' : 'Bentangkan Semua'}
										onclick={toggleAllCategories}
										class="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-md"
									>
										<ChevronsUpDown class="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>

							<!-- Section Switcher: SAP | SAC | WEB | Semua -->
							<div class="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900 text-center shadow-2xs">
								<button
									type="button"
									onclick={() => (activeSection = 'SAP')}
									class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'SAP'
										? 'bg-blue-600 text-white shadow-xs'
										: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
								>
									<span>SAP</span>
								</button>
								<button
									type="button"
									onclick={() => (activeSection = 'SAC')}
									class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'SAC'
										? 'bg-purple-600 text-white shadow-xs'
										: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
								>
									<span>SAC</span>
								</button>
								<button
									type="button"
									onclick={() => (activeSection = 'WEB')}
									class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'WEB'
										? 'bg-emerald-600 text-white shadow-xs'
										: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
								>
									<span>WEB</span>
								</button>
								<button
									type="button"
									onclick={() => (activeSection = 'ALL')}
									class="flex flex-col items-center justify-center rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'ALL'
										? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950 shadow-xs'
										: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
								>
									<span>Semua</span>
								</button>
							</div>

							<!-- Quick Filter Input -->
							<div class="relative">
								<Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
								<input
									type="text"
									bind:value={sidebarFilter}
									placeholder="Filter dalam {activeSection === 'ALL' ? 'semua' : activeSection}..."
									class="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
								/>
							</div>

							<!-- Navigation Groups (Collapsible Accordion) -->
							<nav class="space-y-1.5 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
								{#each filteredTree as group}
									{@const expanded = isCategoryExpanded(group)}
									<div
										class="rounded-xl transition-colors {expanded ? 'bg-zinc-50/60 dark:bg-zinc-900/30' : ''}"
										oncontextmenu={(e) => openContextMenu(e, { section: group.section, category: group.title, title: `Kategori: ${group.title}` })}
										role="group"
									>
										<button
											type="button"
											onclick={() => toggleCategory(group.title, group)}
											class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-800 hover:bg-zinc-100/80 dark:text-zinc-200 dark:hover:bg-zinc-800/60 transition-colors"
										>
											<div class="flex items-center gap-1.5 truncate">
												<ChevronDown
													class="h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 shrink-0 {expanded ? 'rotate-0 text-zinc-700 dark:text-zinc-300' : '-rotate-90'}"
												/>
												<Layers class="h-3 w-3 text-zinc-400 shrink-0" />
												<span class="truncate font-medium">{group.title}</span>
											</div>

											<div class="flex items-center gap-1.5 shrink-0">
												{#if activeSection === 'ALL' && group.section}
													<span class="rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase {group.section === 'SAP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : group.section === 'SAC' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}">
														{group.section}
													</span>
												{/if}
												<span class="text-[10px] text-zinc-400 font-medium px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800">
													{group.nodes.length}
												</span>
											</div>
										</button>

										{#if expanded}
											<div class="space-y-0.5 pl-3 ml-3 border-l-2 border-zinc-200 dark:border-zinc-800 my-1 animate-in fade-in duration-150">
												{#each group.nodes as node}
													{@const isCurrent = node.path === data.slug || node.slug === data.slug}
													<a
														href="/docs/{node.path}"
														oncontextmenu={(e) => openContextMenu(e, node)}
														class="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {isCurrent
															? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-2xs font-semibold'
															: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'}"
														title="{node.title} (Klik kanan untuk opsi)"
													>
														<div class="flex items-center gap-2 truncate">
															{#if node.section === 'SAP'}
																<Building2 class="h-3.5 w-3.5 opacity-60 shrink-0" />
															{:else if node.section === 'SAC'}
																<BarChart3 class="h-3.5 w-3.5 opacity-60 shrink-0" />
															{:else}
																<Globe class="h-3.5 w-3.5 opacity-60 shrink-0" />
															{/if}
															<span class="truncate">{node.title}</span>
														</div>
													</a>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</nav>
						</div>
					{/if}
				</div>
			</aside>
		{/if}

		<!-- ======================================================== -->
		<!-- MAIN CONTENT AREA                                         -->
		<!-- ======================================================== -->
		<div
			class="min-w-0 flex-1 {isFocusMode ? 'max-w-4xl mx-auto' : 'max-w-3xl'}"
			oncontextmenu={(e) => openContextMenu(e, currentDoc)}
			role="article"
		>
			<!-- Document Title & Meta Header -->
			<div class="mb-8">
				<div class="flex flex-wrap items-center gap-2 mb-3">
					{#if (currentDoc?.section || data.article.section) === 'SAP'}
						<Badge class="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
							<Building2 class="h-3 w-3" />
							<span>SAP Enterprise</span>
						</Badge>
					{:else if (currentDoc?.section || data.article.section) === 'SAC'}
						<Badge class="gap-1 border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300">
							<BarChart3 class="h-3 w-3" />
							<span>SAC Analytics</span>
						</Badge>
					{:else}
						<Badge class="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
							<Globe class="h-3 w-3" />
							<span>WEB Stack</span>
						</Badge>
					{/if}

					<Badge variant="outline" class="text-[11px] font-semibold">
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
			<article class="prose prose-zinc dark:prose-invert max-w-none prose-headings:scroll-mt-28 prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-code:rounded prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none leading-relaxed">
				{@html renderedHtml}
			</article>

			<!-- Clean Quick Action Banner (Buttons removed, Right-Click Hint) -->
			<div class="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<MousePointerClick class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
						<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
							Tip: Klik kanan di mana saja untuk mengedit, menambah catatan baru, atau menyalin link seperti di Obsidian & Notion.
						</span>
					</div>

					<div class="flex items-center gap-2 shrink-0">
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
		</div>

		<!-- Right Sidebar (AI Copilot Quick Action) -->
		{#if !isFocusMode}
			<aside class="hidden xl:block w-64 shrink-0">
				<div class="sticky top-20 space-y-6">
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

					<!-- Document Metadata Card -->
					<div class="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/30 text-xs space-y-2">
						<div class="font-semibold text-zinc-700 dark:text-zinc-300">Info Berkas</div>
						<div class="text-[11px] text-zinc-500 space-y-1">
							<div class="flex justify-between">
								<span>Format:</span>
								<span class="font-mono text-zinc-700 dark:text-zinc-300">Markdown (.md)</span>
							</div>
							<div class="flex justify-between">
								<span>Bagian:</span>
								<span class="font-semibold text-zinc-700 dark:text-zinc-300">{currentDoc?.section || 'SAP'}</span>
							</div>
							<div class="flex justify-between">
								<span>Kategori:</span>
								<span class="text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">{currentDoc?.category || 'General'}</span>
							</div>
							{#if currentDoc?.updatedAt}
								<div class="flex justify-between">
									<span>Pembaruan:</span>
									<span class="text-zinc-700 dark:text-zinc-300">{new Date(currentDoc.updatedAt).toLocaleDateString('id-ID')}</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</aside>
		{/if}
	</div>
</div>

<!-- ======================================================== -->
<!-- OBSIDIAN / NOTION FLOATING CONTEXT MENU                   -->
<!-- ======================================================== -->
{#if contextMenu.open}
	<div
		class="fixed z-50 min-w-[240px] max-w-[280px] overflow-hidden rounded-xl border border-zinc-200/90 bg-white/95 p-1.5 text-xs text-zinc-800 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100 select-none ring-1 ring-black/5 dark:ring-white/10"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => { if (e.key === 'Escape') closeContextMenu(); }}
		role="menu"
		tabindex="-1"
	>
		{#if contextMenu.targetDoc?.title}
			<div class="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-900 truncate max-w-[260px] flex items-center gap-1.5">
				<FileText class="h-3 w-3 text-zinc-400 shrink-0" />
				<span class="truncate">{contextMenu.targetDoc.title}</span>
			</div>
		{/if}

		<div class="space-y-0.5 pt-1">
			<button
				type="button"
				onclick={() => handleContextMenuEdit(contextMenu.targetDoc)}
				class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 transition-colors"
			>
				<div class="flex items-center gap-2">
					<Edit3 class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
					<span>Edit Catatan</span>
				</div>
				<kbd class="text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-1 py-0.2 rounded font-mono">Ctrl+E</kbd>
			</button>

			<button
				type="button"
				onclick={() => handleContextMenuCreate(contextMenu.targetDoc)}
				class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 transition-colors"
			>
				<div class="flex items-center gap-2">
					<Plus class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
					<span>Tambah Catatan Baru</span>
				</div>
				<kbd class="text-[9px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-1 py-0.2 rounded font-mono">Ctrl+N</kbd>
			</button>

			<button
				type="button"
				onclick={() => handleContextMenuAi(contextMenu.targetDoc)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200 transition-colors"
			>
				<Sparkles class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
				<span>Tanya AI Copilot</span>
			</button>

			<div class="my-1 border-t border-zinc-100 dark:border-zinc-900"></div>

			<button
				type="button"
				onclick={() => handleContextMenuCopyLink(contextMenu.targetDoc)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 transition-colors"
			>
				<Copy class="h-3.5 w-3.5 text-zinc-500" />
				<span>Salin Tautan</span>
			</button>

			<button
				type="button"
				onclick={() => handleContextMenuCopyMarkdown(contextMenu.targetDoc)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 transition-colors"
			>
				<FileText class="h-3.5 w-3.5 text-zinc-500" />
				<span>Salin Raw Markdown</span>
			</button>

			<button
				type="button"
				onclick={() => handleContextMenuDownload(contextMenu.targetDoc)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 transition-colors"
			>
				<Download class="h-3.5 w-3.5 text-zinc-500" />
				<span>Unduh File (.md)</span>
			</button>

			{#if contextMenu.targetDoc}
				<div class="my-1 border-t border-zinc-100 dark:border-zinc-900"></div>

				<button
					type="button"
					onclick={() => handleContextMenuDelete(contextMenu.targetDoc)}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
				>
					<Trash2 class="h-3.5 w-3.5" />
					<span>Hapus Catatan</span>
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- Modal Document Editor & AI Generator -->
<DocEditorModal
	bind:isOpen={isEditorOpen}
	mode={editorMode}
	initialDoc={editingDocTarget || (editorMode === 'edit' ? currentDoc : null)}
	categories={categoriesList}
	onSave={handleSaved}
/>
