<script lang="ts">
	import { untrack } from 'svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import DocEditorModal from '$lib/components/DocEditorModal.svelte';
	import DocAiAssistantModal from '$lib/components/docs/DocAiAssistantModal.svelte';
	import DocsContextMenu from '$lib/components/docs/DocsContextMenu.svelte';
	import DocsLightbox from '$lib/components/docs/DocsLightbox.svelte';
	import DocsRightOutline from '$lib/components/docs/DocsRightOutline.svelte';
	import { renderMarkdown, extractOutlineTree } from '$lib/utils/markdown';
	import {
		DOC_TEMPLATES,
		MARKDOWN_TABLE_SNIPPET,
		MARKDOWN_CHECKLIST_SNIPPET,
		type DocTemplate
	} from '$lib/utils/docTemplates';
	import {
		Sparkles,
		ChevronRight,
		ChevronLeft,
		FileText,
		FilePlus,
		FolderPlus,
		Folder,
		FolderOpen,
		Copy,
		Check,
		ListTree,
		Plus,
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
		MousePointerClick,
		MoreHorizontal,
		Edit3,
		Save,
		Eye,
		Columns2,
		Wand2,
		Code,
		List,
		Heading2,
		Heading3,
		Bold,
		Italic,
		Table,
		CheckSquare,
		Image as ImageIcon,
		FileUp,
		Loader2,
		LayoutTemplate
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Sidebar View Switcher (primarily for < xl screens; on xl+ Explorer is left & Outline is right)
	let sidebarView = $state<'outline' | 'explorer'>('explorer');
	let activeSection = $state<'SAP' | 'SAC' | 'WEB' | 'ALL'>('ALL');

	// Local mutable document & tree state
	let editorDoc = $state<any>(null);
	let currentDoc = $derived(editorDoc ?? data.doc);
	let customTree = $state<any>(null);
	let currentTree = $derived(customTree ?? data.treeData);
	let sidebarFilter = $state('');
	let expandedCategories = $state<Record<string, boolean>>({});

	// VS Code Tabs Management
	interface DocTab {
		slug: string;
		title: string;
		section?: string;
	}
	let openTabs = $state<DocTab[]>([]);

	// Focus mode & In-page search
	let isFocusMode = $state(false);
	let isSearchActive = $state(false);
	let inPageSearchQuery = $state('');
	let activeHeadingId = $state<string>('');

	// Lightbox state for zoomable images
	let lightboxSrc = $state<string | null>(null);
	let lightboxAlt = $state<string>('');

	// Obsidian Context Menu & Editor Modal State
	let contextMenu = $state<{ open: boolean; x: number; y: number; targetDoc: any }>({
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

	// Dedicated Single-Document AI Assistant Modal & Pinned Summary State
	let isDocAiOpen = $state(false);
	let docAiTarget = $state<any>(null);
	let docAiInitialPrompt = $state('');
	let pinnedAiSummary = $state<{ title: string; content: string; slug: string } | null>(null);

	// =========================================================================
	// OBSIDIAN FILE EXPLORER STATE (Create Folder / Create File First)
	// =========================================================================
	let explorerCreator = $state<{
		open: boolean;
		type: 'file' | 'folder';
		section: 'SAP' | 'SAC' | 'WEB';
		category: string;
		subcategory: string;
		isRootFolder: boolean;
		name: string;
		isSubmitting: boolean;
		error: string;
	}>({
		open: false,
		type: 'file',
		section: 'SAP',
		category: '',
		subcategory: '',
		isRootFolder: true,
		name: '',
		isSubmitting: false,
		error: ''
	});

	let pendingAutoEditSlug = $state<string>('');

	// =========================================================================
	// OBSIDIAN IN-PAGE NOTE EDITOR STATE (Write Directly Inside the Note!)
	// =========================================================================
	let isInlineEditing = $state(false);
	let inlineTitle = $state('');
	let inlineContent = $state('');
	let inlineMode = $state<'edit' | 'split' | 'preview'>('edit');
	let isSavingInline = $state(false);
	let inlineStatusMsg = $state('');
	let inlineErrorMsg = $state('');
	let showTemplateBar = $state(false);
	let inlineAiPrompt = $state('');
	let isInlineAiLoading = $state(false);
	let isUploadingInlineImage = $state(false);
	let inlineImageInputRef = $state<HTMLInputElement | null>(null);
	let inlineMdInputRef = $state<HTMLInputElement | null>(null);

	// Load & sync open tabs with localStorage (using untrack + lastSyncedSlug to prevent re-adding a tab when closing it)
	let tabsInitialized = false;
	let lastSyncedSlug = '';
	let closingSlug = '';

	function saveTabsToStorage(tabs: DocTab[]) {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('portal_open_tabs', JSON.stringify(tabs));
			} catch (_) {}
		}
	}

	function ensureTabOpen(docNode: any) {
		const slug = docNode?.path || docNode?.slug || data.slug;
		const title = docNode?.title || currentDoc?.title || data.article?.title || slug;
		const section = docNode?.section || currentDoc?.section || data.article?.section || 'SAP';
		if (!slug) return;

		if (!openTabs.some((t) => t.slug === slug)) {
			const updated = [...openTabs, { slug, title, section }].slice(-10);
			openTabs = updated;
			saveTabsToStorage(updated);
		}
	}

	$effect(() => {
		const activeSlug = data.slug;
		const currentTitle = currentDoc?.title || data.article?.title || activeSlug;
		const currentSection = currentDoc?.section || data.article?.section || 'SAP';

		if (!activeSlug) return;

		untrack(() => {
			if (closingSlug === activeSlug) return;

			let currentList = openTabs;
			const isFirstInit = !tabsInitialized && typeof window !== 'undefined';
			if (isFirstInit) {
				tabsInitialized = true;
				try {
					const stored = localStorage.getItem('portal_open_tabs');
					if (stored) {
						const parsed = JSON.parse(stored);
						if (Array.isArray(parsed)) currentList = parsed;
					}
				} catch (_) {}
			}

			const existingIndex = currentList.findIndex((t) => t.slug === activeSlug);
			if (existingIndex >= 0) {
				lastSyncedSlug = activeSlug;
				if (currentList[existingIndex].title !== currentTitle) {
					currentList = currentList.map((t, i) =>
						i === existingIndex ? { ...t, title: currentTitle } : t
					);
					openTabs = currentList;
					saveTabsToStorage(currentList);
				} else if (isFirstInit) {
					openTabs = currentList;
				}
			} else if (isFirstInit || activeSlug !== lastSyncedSlug) {
				// Only auto-add tab on initial mount or when navigating to a different document slug
				lastSyncedSlug = activeSlug;
				currentList = [
					...currentList,
					{ slug: activeSlug, title: currentTitle, section: currentSection }
				].slice(-10);
				openTabs = currentList;
				saveTabsToStorage(currentList);
			}
		});
	});

	async function closeTab(tabSlug: string, event?: Event) {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}

		const idx = openTabs.findIndex((t) => t.slug === tabSlug);
		if (idx === -1) return;

		const nextTabs = openTabs.filter((t) => t.slug !== tabSlug);
		openTabs = nextTabs;
		saveTabsToStorage(nextTabs);

		// Keep lastSyncedSlug equal to current data.slug so $effect never re-adds the closed tab
		if (tabSlug === data.slug) {
			closingSlug = tabSlug;
			lastSyncedSlug = tabSlug;
			try {
				if (nextTabs.length > 0) {
					const nextIndex = Math.min(idx, nextTabs.length - 1);
					const targetSlug = nextTabs[nextIndex].slug;
					lastSyncedSlug = targetSlug;
					await goto(`/docs/${targetSlug}`);
				}
			} finally {
				closingSlug = '';
			}
		}
	}

	function closeAllTabs(event?: Event) {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		lastSyncedSlug = data.slug;
		openTabs = [];
		saveTabsToStorage([]);
	}

	// Category & Sub-Category Accordion helpers
	let expandedSubcategories = $state<Record<string, boolean>>({});

	function isCategoryExpanded(group: any): boolean {
		if (sidebarFilter.trim()) return true;
		if (expandedCategories[group.title] !== undefined) {
			return expandedCategories[group.title];
		}
		return (group.nodes || []).some((n: any) => n.path === data.slug || n.slug === data.slug);
	}

	function toggleCategory(catTitle: string, group: any) {
		expandedCategories[catTitle] = !isCategoryExpanded(group);
	}

	function isSubcategoryExpanded(catTitle: string, subGroup: any): boolean {
		if (sidebarFilter.trim()) return true;
		const key = `${catTitle}::${subGroup.title}`;
		if (expandedSubcategories[key] !== undefined) {
			return expandedSubcategories[key];
		}
		return true;
	}

	function toggleSubcategory(catTitle: string, subGroup: any) {
		const key = `${catTitle}::${subGroup.title}`;
		expandedSubcategories[key] = !isSubcategoryExpanded(catTitle, subGroup);
	}

	const filteredTree = $derived.by(() => {
		const q = sidebarFilter.toLowerCase().trim();
		return currentTree
			.map((group: any) => {
				const groupSec = group.section || group.nodes?.[0]?.section || 'SAP';
				const matchesGroupSection = activeSection === 'ALL' || groupSec === activeSection;
				if (!matchesGroupSection) return null;

				const nodes = (group.nodes || []).filter((n: any) => {
					const nodeSec = n.section || groupSec;
					const matchesSection = activeSection === 'ALL' || nodeSec === activeSection;
					const matchesQuery =
						!q ||
						n.title.toLowerCase().includes(q) ||
						(n.category && n.category.toLowerCase().includes(q)) ||
						(n.subcategory && n.subcategory.toLowerCase().includes(q));
					return matchesSection && matchesQuery;
				});

				// Group into subcategories + directNodes (including empty subfolders!)
				const subMap = new Map<string, any[]>();
				if (Array.isArray(group.subfolders)) {
					for (const sf of group.subfolders) {
						if (sf && (!q || sf.toLowerCase().includes(q))) {
							subMap.set(sf, []);
						}
					}
				}

				const directNodes: any[] = [];
				for (const n of nodes) {
					const sub = (n.subcategory || '').trim();
					if (sub) {
						if (!subMap.has(sub)) subMap.set(sub, []);
						subMap.get(sub)!.push(n);
					} else {
						directNodes.push(n);
					}
				}
				const subcategories = Array.from(subMap.entries()).map(([title, subNodes]) => ({
					title,
					nodes: subNodes
				}));

				const matchesFolderQuery = !q || group.title.toLowerCase().includes(q);
				if (q && nodes.length === 0 && subcategories.length === 0 && !matchesFolderQuery) {
					return null;
				}

				return { ...group, section: groupSec, nodes, subcategories, directNodes };
			})
			.filter(Boolean);
	});

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

	const categoriesList = $derived.by(() => currentTree.map((g: any) => g.title));

	$effect(() => {
		if (data.slug) {
			editorDoc = null;
			const sec = (data.article?.section || currentDoc?.section) as 'SAP' | 'SAC' | 'WEB';
			if (['SAP', 'SAC', 'WEB'].includes(sec)) {
				activeSection = sec;
			}
			const cat = currentDoc?.category || data.article?.category;
			if (cat) expandedCategories[cat] = true;

			// Automatically enter Obsidian In-Page Note Writing Mode if file was just created or is empty
			const isNewlyCreated = pendingAutoEditSlug === data.slug;
			const isEmptyNote = !String(data.doc?.content || '').trim();
			if (isNewlyCreated || isEmptyNote) {
				pendingAutoEditSlug = '';
				startInlineEdit(data.doc);
			} else {
				isInlineEditing = false;
			}
		}
	});

	// =========================================================================
	// OBSIDIAN FILE EXPLORER ACTIONS: CREATE FOLDER / CREATE FILE FIRST
	// =========================================================================
	function resolveActiveContext(target?: any): {
		section: 'SAP' | 'SAC' | 'WEB';
		category: string;
		subcategory: string;
	} {
		const rawSec =
			target?.section && ['SAP', 'SAC', 'WEB'].includes(String(target.section).toUpperCase())
				? String(target.section).toUpperCase()
				: activeSection !== 'ALL'
					? activeSection
					: currentDoc?.section || 'SAP';
		const section = (['SAP', 'SAC', 'WEB'].includes(rawSec) ? rawSec : 'SAP') as
			| 'SAP'
			| 'SAC'
			| 'WEB';

		const defaultCat =
			section === 'SAP'
				? 'Overview & Landscape'
				: section === 'SAC'
					? 'Overview & BI'
					: 'Web Stack';

		let category = target?.category || '';
		if (!category) {
			if ((currentDoc?.section || 'SAP') === section && currentDoc?.category) {
				category = currentDoc.category;
			} else {
				const firstFolderInSec = currentTree.find((g: any) => (g.section || 'SAP') === section);
				category = firstFolderInSec?.title || defaultCat;
			}
		}
		const subcategory = target?.subcategory || '';
		return { section, category, subcategory };
	}

	function openExplorerCreateFile(target?: any) {
		closeContextMenu();
		sidebarView = 'explorer';
		const ctx = resolveActiveContext(target);
		expandedCategories[ctx.category] = true;

		explorerCreator = {
			open: true,
			type: 'file',
			section: ctx.section,
			category: ctx.category,
			subcategory: ctx.subcategory,
			isRootFolder: false,
			name: '',
			isSubmitting: false,
			error: ''
		};

		setTimeout(() => {
			const el = document.getElementById('explorer-creator-input') as HTMLInputElement | null;
			el?.focus();
		}, 30);
	}

	function openExplorerCreateFolder(target?: any) {
		closeContextMenu();
		sidebarView = 'explorer';
		const ctx = resolveActiveContext(target);
		const isSubfolderTarget = Boolean(target?.isFolder && target?.category && !target?.subcategory);

		explorerCreator = {
			open: true,
			type: 'folder',
			section: ctx.section,
			category: isSubfolderTarget ? target.category : '',
			subcategory: '',
			isRootFolder: !isSubfolderTarget,
			name: '',
			isSubmitting: false,
			error: ''
		};

		setTimeout(() => {
			const el = document.getElementById('explorer-creator-input') as HTMLInputElement | null;
			el?.focus();
		}, 30);
	}

	async function submitExplorerCreator(e?: Event) {
		if (e) e.preventDefault();
		const cleanName = explorerCreator.name.trim();
		if (!cleanName) return;

		explorerCreator.isSubmitting = true;
		explorerCreator.error = '';

		try {
			if (explorerCreator.type === 'folder') {
				const payload = explorerCreator.isRootFolder
					? {
							type: 'folder',
							section: explorerCreator.section,
							category: cleanName
						}
					: {
							type: 'folder',
							section: explorerCreator.section,
							category: explorerCreator.category,
							subcategory: cleanName
						};

				const res = await fetch('/api/docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || 'Gagal membuat folder');

				if (json.treeData) customTree = json.treeData;
				const targetCat = explorerCreator.isRootFolder ? cleanName : explorerCreator.category;
				expandedCategories[targetCat] = true;
				if (!explorerCreator.isRootFolder) {
					expandedSubcategories[`${targetCat}::${cleanName}`] = true;
				}
				explorerCreator.open = false;
			} else {
				// Create File (Note) first, then immediately open in Note Writing Mode
				const res = await fetch('/api/docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: cleanName.replace(/\.md$/i, ''),
						section: explorerCreator.section,
						category: explorerCreator.category,
						subcategory: explorerCreator.subcategory || undefined,
						content: ''
					})
				});
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || 'Gagal membuat file catatan');

				if (json.treeData) customTree = json.treeData;
				expandedCategories[explorerCreator.category] = true;
				explorerCreator.open = false;

				if (json.document?.slug) {
					pendingAutoEditSlug = json.document.slug;
					ensureTabOpen({
						slug: json.document.slug,
						title: json.document.title,
						section: json.document.section
					});
					await goto(`/docs/${json.document.slug}`);
				}
			}
		} catch (err: any) {
			explorerCreator.error = err.message || 'Gagal memproses permintaan';
		} finally {
			explorerCreator.isSubmitting = false;
		}
	}

	// =========================================================================
	// OBSIDIAN IN-PAGE NOTE WRITING & EDITING FUNCTIONS
	// =========================================================================
	function startInlineEdit(docToEdit?: any) {
		const d = docToEdit || currentDoc;
		inlineTitle = d?.title || '';
		inlineContent = d?.content || '';
		inlineMode = 'edit';
		inlineStatusMsg = '';
		inlineErrorMsg = '';
		isInlineEditing = true;

		setTimeout(() => {
			const textarea = document.getElementById('inline-note-textarea') as HTMLTextAreaElement | null;
			textarea?.focus();
		}, 40);
	}

	async function saveInlineNote(closeAfterSave = true) {
		if (!inlineTitle.trim()) {
			inlineErrorMsg = 'Judul catatan tidak boleh kosong.';
			return;
		}
		isSavingInline = true;
		inlineErrorMsg = '';
		inlineStatusMsg = '';

		try {
			const slug = currentDoc?.slug || data.slug;
			const res = await fetch(`/api/docs/${slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: inlineTitle.trim(),
					content: inlineContent,
					section: currentDoc?.section || data.article.section,
					category: currentDoc?.category || data.article.category,
					subcategory: currentDoc?.subcategory || data.article.subcategory
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan catatan');

			editorDoc = json.document;
			fetch('/api/docs')
				.then((r) => r.json())
				.then((d) => {
					if (d.treeData) customTree = d.treeData;
				})
				.catch(() => {});

			if (closeAfterSave) {
				isInlineEditing = false;
			} else {
				inlineStatusMsg = `✓ Tersimpan (${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`;
			}
		} catch (err: any) {
			inlineErrorMsg = err.message || 'Gagal menyimpan catatan';
		} finally {
			isSavingInline = false;
		}
	}

	function insertInlineSnippet(before: string, after: string = '') {
		const textarea = document.getElementById('inline-note-textarea') as HTMLTextAreaElement | null;
		if (!textarea) {
			inlineContent = `${inlineContent}${before}${after}`;
			return;
		}
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = inlineContent.substring(start, end) || 'Teks';
		const replacement = before + selected + after;
		inlineContent = inlineContent.substring(0, start) + replacement + inlineContent.substring(end);
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
		}, 10);
	}

	function applyInlineTemplate(tpl: DocTemplate) {
		if (inlineContent.trim().length > 40) {
			if (!confirm(`Ganti isi catatan saat ini dengan kerangka "${tpl.name}"?`)) return;
		}
		inlineContent = tpl.content;
		inlineStatusMsg = `📋 Kerangka "${tpl.name}" diterapkan!`;
		showTemplateBar = false;
	}

	async function runInlineAiAction(action: 'generate' | 'format' | 'improve' | 'code') {
		isInlineAiLoading = true;
		inlineErrorMsg = '';
		inlineStatusMsg = '';
		try {
			const sec = currentDoc?.section || data.article.section || 'SAP';
			const cat = currentDoc?.category || data.article.category || 'General';
			const effectivePrompt = inlineAiPrompt.trim() || inlineTitle.trim() || `Dokumentasi ${sec}`;

			const res = await fetch('/api/ai/doc-assist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action,
					prompt: effectivePrompt,
					section: sec,
					currentDoc: {
						title: inlineTitle,
						section: sec,
						category: cat,
						content: inlineContent
					}
				})
			});
			const d = await res.json();
			if (!res.ok || !d.success) throw new Error(d.error || 'Gagal memproses AI');

			if (action === 'generate') {
				inlineContent = d.result?.content || inlineContent;
				inlineStatusMsg = '✨ Draft catatan berhasil ditulis oleh AI!';
			} else if (action === 'format') {
				inlineContent = d.result?.content || inlineContent;
				inlineStatusMsg = '✨ Catatan mentah berhasil dirapikan ke format Markdown!';
			} else if (action === 'improve') {
				inlineContent = d.result?.content || inlineContent;
				inlineStatusMsg = '✨ Isi catatan berhasil dipoles oleh AI!';
			} else if (action === 'code') {
				inlineContent = `${inlineContent.trim()}\n\n${d.result?.content || ''}`;
				inlineStatusMsg = '✨ Contoh blok kode berhasil ditambahkan!';
			}
		} catch (err: any) {
			inlineErrorMsg = err.message || 'Gagal menjalankan AI';
		} finally {
			isInlineAiLoading = false;
		}
	}

	async function uploadInlineImage(file: File) {
		isUploadingInlineImage = true;
		const cleanFileName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'gambar';
		const placeholder = `\n![Mengunggah ${cleanFileName}...]()\n`;
		insertInlineSnippet(placeholder, '');

		try {
			const reader = new FileReader();
			const base64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});

			const res = await fetch('/api/upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ image: base64, filename: cleanFileName })
			});
			const json = await res.json();
			if (!res.ok || !json.url) throw new Error(json.error || 'Gagal mengunggah gambar');

			inlineContent = inlineContent.replace(placeholder.trim(), `![${cleanFileName}](${json.url})`);
			inlineStatusMsg = '🖼️ Gambar berhasil disisipkan!';
		} catch (err: any) {
			inlineContent = inlineContent.replace(placeholder, '');
			inlineErrorMsg = err.message || 'Gagal mengunggah gambar';
		} finally {
			isUploadingInlineImage = false;
		}
	}

	function handleInlinePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) uploadInlineImage(file);
				return;
			}
		}
	}

	function handleInlineDrop(e: DragEvent) {
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;
		if (files[0].type.startsWith('image/')) {
			e.preventDefault();
			uploadInlineImage(files[0]);
		}
	}

	function handleInlineFileUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			uploadInlineImage(target.files[0]);
			target.value = '';
		}
	}

	async function handleInlineMdImport(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		const text = await file.text();
		if (text.trim()) {
			inlineContent = inlineContent.trim() ? `${inlineContent}\n\n${text}` : text;
			inlineStatusMsg = `📂 File "${file.name}" berhasil diimpor!`;
		}
		target.value = '';
	}

	$effect(() => {
		ui.currentContext = {
			type: 'docs',
			title: currentDoc?.title || data.article.title,
			key: data.slug,
			snippet: currentDoc?.description || currentDoc?.snippet || data.article.snippet
		};
	});

	const readingTime = $derived.by(() => {
		const words = (currentDoc?.content || '').split(/\s+/).length;
		return Math.max(1, Math.ceil(words / 180));
	});

	// Outline & Markdown Rendering (via centralized utility)
	const outlineTree = $derived(extractOutlineTree(currentDoc?.content || ''));
	const renderedHtml = $derived(renderMarkdown(currentDoc?.content || ''));

	function scrollToHeading(id: string) {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			activeHeadingId = id;
			el.classList.add('outline-anchor-target');
			setTimeout(() => el.classList.remove('outline-anchor-target'), 2000);
		}
	}

	// Scroll-spy for active heading
	$effect(() => {
		if (typeof window === 'undefined' || !renderedHtml) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target.id) {
						activeHeadingId = entry.target.id;
						break;
					}
				}
			},
			{ rootMargin: '-90px 0px -65% 0px', threshold: 0.1 }
		);

		const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id]');
		headings.forEach((h) => observer.observe(h));

		return () => observer.disconnect();
	});

	// Delegated Click Handler on Article (for Copy Code buttons & Image Zoom Lightbox)
	function handleArticleClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (!target) return;

		// 1. Check if Copy Code button was clicked
		const copyBtn = target.closest('[data-copy-code]') as HTMLButtonElement | null;
		if (copyBtn) {
			const encoded = copyBtn.getAttribute('data-copy-code');
			if (encoded) {
				const decoded = decodeURIComponent(encoded);
				navigator.clipboard.writeText(decoded);
				const originalHtml = copyBtn.innerHTML;
				copyBtn.innerHTML = '<span class="text-emerald-400 font-semibold">✓ Tersalin!</span>';
				setTimeout(() => {
					copyBtn.innerHTML = originalHtml;
				}, 2000);
			}
			return;
		}

		// 2. Check if a zoomable image was clicked
		const imgEl = target.closest('img[data-zoomable="true"]') as HTMLImageElement | null;
		if (imgEl && imgEl.src) {
			lightboxSrc = imgEl.src;
			lightboxAlt = imgEl.alt || currentDoc?.title || 'Gambar Dokumentasi';
		}
	}

	// Actions & Context Menu Handlers (Scoped strictly to current document via DocAiAssistantModal)
	function askAiAboutDoc() {
		docAiTarget = currentDoc;
		docAiInitialPrompt = '';
		isDocAiOpen = true;
	}

	async function handleContextMenuAi(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		const slug = t.slug || t.path || t.id;

		if (t.content || slug === data.slug) {
			docAiTarget = t.content ? t : currentDoc;
		} else {
			try {
				const res = await fetch(`/api/docs/${slug}`);
				docAiTarget = res.ok ? await res.json() : t;
			} catch (_) {
				docAiTarget = t;
			}
		}
		docAiInitialPrompt = '';
		isDocAiOpen = true;
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
		a.download = (currentDoc.title || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
		a.click();
		URL.revokeObjectURL(url);
	}

	function openContextMenu(e: MouseEvent, docTarget: any = null) {
		e.preventDefault();
		e.stopPropagation();

		const menuWidth = 250;
		const menuHeight = 310;
		const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
		const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

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
					if (lightboxSrc) lightboxSrc = null;
					if (explorerCreator.open) explorerCreator.open = false;
				}
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && isInlineEditing) {
					e.preventDefault();
					saveInlineNote(false);
				}
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !isEditorOpen) {
					e.preventDefault();
					if (isInlineEditing) {
						saveInlineNote(true);
					} else {
						startInlineEdit(currentDoc);
					}
				}
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !isEditorOpen) {
					e.preventDefault();
					openExplorerCreateFile(currentDoc);
				}
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i' && !isEditorOpen) {
					e.preventDefault();
					askAiAboutDoc();
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
		const slug = docToEdit?.slug || docToEdit?.path || docToEdit?.id;

		if (!slug || slug === data.slug) {
			startInlineEdit(currentDoc);
		} else {
			pendingAutoEditSlug = slug;
			await goto(`/docs/${slug}`);
		}
	}

	function handleContextMenuCreate(target: any) {
		openExplorerCreateFile(target || currentDoc);
	}

	async function handleContextMenuDuplicate(target: any) {
		closeContextMenu();
		const docToDup = target || currentDoc;
		const slug = docToDup?.slug || docToDup?.path || docToDup?.id;

		let fullSource = docToDup;
		if (!fullSource?.content && slug && slug !== data.slug) {
			try {
				const res = await fetch(`/api/docs/${slug}`);
				if (res.ok) fullSource = await res.json();
			} catch (_) {}
		} else if (!fullSource?.content) {
			fullSource = currentDoc;
		}

		try {
			const res = await fetch('/api/docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: `${fullSource?.title || 'Catatan'} (Salinan)`,
					section: fullSource?.section || currentDoc?.section || 'SAP',
					category: fullSource?.category || currentDoc?.category || 'General',
					subcategory: fullSource?.subcategory || undefined,
					content: fullSource?.content || ''
				})
			});
			const json = await res.json();
			if (res.ok && json.document?.slug) {
				if (json.treeData) customTree = json.treeData;
				pendingAutoEditSlug = json.document.slug;
				await goto(`/docs/${json.document.slug}`);
			}
		} catch (_) {}
	}

	function handleArticleDblClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (!target) return;
		if (target.closest('button, a, pre, code, input, textarea, img')) return;
		if (!isInlineEditing) {
			startInlineEdit(currentDoc);
		}
	}

	function handleContextMenuCopyLink(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		const slug = t.slug || t.path || t.id;
		if (typeof window !== 'undefined') {
			navigator.clipboard.writeText(`${window.location.origin}/docs/${slug}`);
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
		if (target?.isFolder) {
			if ((target.nodeCount || 0) > 0) {
				alert('Folder ini masih berisi file catatan. Hapus atau pindahkan file di dalamnya terlebih dahulu.');
				return;
			}
			if (!confirm(`Hapus folder "${target.subcategory || target.category}"?`)) return;
			try {
				const res = await fetch('/api/docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						type: 'delete-folder',
						section: target.section,
						category: target.category,
						subcategory: target.subcategory
					})
				});
				const d = await res.json();
				if (res.ok && d.treeData) customTree = d.treeData;
			} catch (_) {}
			return;
		}

		const docToDelete = target || currentDoc;
		const slug = docToDelete.slug || docToDelete.path || docToDelete.id;
		const title = docToDelete.title || 'dokumen ini';

		if (!confirm(`Apakah Anda yakin ingin menghapus file catatan "${title}"?`)) return;

		try {
			const res = await fetch(`/api/docs/${slug}`, { method: 'DELETE' });
			if (res.ok) {
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
		}
	}
</script>

<svelte:head>
	<title>{currentDoc?.title || data.article.title} - Portal Dokumentasi</title>
</svelte:head>

<div
	class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
	oncontextmenu={(e) => openContextMenu(e, currentDoc)}
	role="region"
	aria-label="Dokumentasi Workspace"
>
	<!-- ======================================================== -->
	<!-- 1. VS CODE TOP TAB BAR                                    -->
	<!-- ======================================================== -->
	<div class="mt-3 flex items-center justify-between border-b border-border bg-muted/60 rounded-t-xl px-2 pt-1.5 overflow-x-auto">
		<div class="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 min-h-[34px]">
			{#if openTabs.length === 0}
				<button
					type="button"
					onclick={() => ensureTabOpen(currentDoc)}
					class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
				>
					<Plus class="h-3 w-3" />
					<span>Buka tab untuk dokumen ini</span>
				</button>
			{/if}

			{#each openTabs as tab (tab.slug)}
				{@const isActive = tab.slug === data.slug}
				<div
					class="group relative flex items-center gap-1.5 rounded-t-lg border-t-2 pl-3 pr-1.5 py-1.5 text-xs font-medium transition-all {isActive
						? 'border-indigo-600 bg-background text-foreground shadow-2xs dark:border-indigo-500'
						: 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}"
					oncontextmenu={(e) => openContextMenu(e, tab)}
					onauxclick={(e) => {
						if (e.button === 1) closeTab(tab.slug, e);
					}}
					role="tab"
					tabindex="0"
				>
					<a
						href="/docs/{tab.slug}"
						class="flex items-center gap-1.5 truncate max-w-[170px] py-0.5"
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
						onpointerdown={(e) => e.stopPropagation()}
						onmousedown={(e) => e.stopPropagation()}
						onclick={(e) => closeTab(tab.slug, e)}
						title="Tutup Tab"
						aria-label="Tutup Tab {tab.title}"
						class="relative z-10 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
					>
						<X class="h-3.5 w-3.5 pointer-events-none" />
					</button>
				</div>
			{/each}
		</div>

		<div class="flex items-center gap-1 pb-1 pl-2 shrink-0">
			{#if openTabs.length > 1}
				<button
					type="button"
					onclick={(e) => closeAllTabs(e)}
					title="Tutup Semua Tab"
					class="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
				>
					Tutup Semua
				</button>
			{/if}

			<Button
				variant="ghost"
				size="icon"
				title={isFocusMode ? 'Keluar Mode Fokus' : 'Mode Fokus Layar Penuh'}
				onclick={() => (isFocusMode = !isFocusMode)}
				class="h-7 w-7 text-muted-foreground hover:text-foreground"
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
	<!-- 2. UNIFIED BREADCRUMB & COMPACT ACTION BAR               -->
	<!-- ======================================================== -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/90 px-3.5 py-2 text-xs">
		<!-- Left: Breadcrumb Navigation -->
		<div class="flex items-center gap-1.5 font-mono text-[11px] overflow-x-auto truncate">
			<a href="/" class="hover:underline text-muted-foreground hover:text-foreground">Home</a>
			<ChevronRight class="h-3 w-3 text-muted-foreground shrink-0" />
			<span
				class="font-semibold {currentDoc?.section === 'SAP'
					? 'text-blue-600 dark:text-blue-400'
					: currentDoc?.section === 'SAC'
						? 'text-purple-600 dark:text-purple-400'
						: 'text-emerald-600 dark:text-emerald-400'}"
			>
				{currentDoc?.section || data.article.section || 'SAP'}
			</span>
			<ChevronRight class="h-3 w-3 text-muted-foreground shrink-0" />
			<span class="text-muted-foreground truncate">{currentDoc?.category || data.article.category}</span>
			{#if currentDoc?.subcategory || data.article?.subcategory}
				<ChevronRight class="h-3 w-3 text-muted-foreground shrink-0" />
				<span class="text-indigo-600 dark:text-indigo-400 font-medium truncate">
					{currentDoc?.subcategory || data.article?.subcategory}
				</span>
			{/if}
			<ChevronRight class="h-3 w-3 text-muted-foreground shrink-0" />
			<span class="font-bold text-foreground truncate">{currentDoc?.title || data.article.title}.md</span>
		</div>

		<!-- Right: Quick Actions & Discoverable Context Menu Button -->
		<div class="flex items-center gap-1 shrink-0">
			{#if currentDoc?.sacUrl}
				<a
					href={currentDoc.sacUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-purple-600 text-white hover:bg-purple-700 shadow-2xs transition-colors mr-1"
				>
					<ExternalLink class="h-3 w-3" />
					<span>Buka Story SAC ↗</span>
				</a>
			{/if}

			{#if isInlineEditing}
				<Button
					variant="default"
					size="sm"
					onclick={() => saveInlineNote(true)}
					disabled={isSavingInline}
					class="h-7 gap-1 px-2.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
				>
					{#if isSavingInline}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<Save class="h-3.5 w-3.5" />
					{/if}
					<span>Simpan & Baca</span>
				</Button>
			{:else}
				<Button
					variant="outline"
					size="sm"
					title="Tulis / Edit Isi Catatan Ini (Ctrl+E)"
					onclick={() => startInlineEdit(currentDoc)}
					class="h-7 gap-1 px-2.5 text-xs"
				>
					<Edit3 class="h-3.5 w-3.5 text-blue-500" />
					<span>Tulis / Edit</span>
					<kbd class="hidden md:inline-flex items-center rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
						Ctrl+E
					</kbd>
				</Button>
			{/if}

			<Button
				variant="ghost"
				size="sm"
				onclick={() => (isSearchActive = !isSearchActive)}
				title="Cari teks di halaman ini"
				class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
			>
				<Search class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Cari</span>
			</Button>

			<Button
				variant="secondary"
				size="sm"
				title="AI Assistant Khusus Dokumen Ini (Ctrl+I)"
				onclick={askAiAboutDoc}
				class="h-7 gap-1 px-2.5 text-xs border border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
			>
				<Sparkles class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
				<span class="hidden sm:inline">AI Assistant</span>
				<kbd class="hidden md:inline-flex items-center rounded bg-indigo-200/70 px-1 py-0.2 text-[9px] font-mono text-indigo-900 dark:bg-indigo-900/70 dark:text-indigo-200">
					Ctrl+I
				</kbd>
			</Button>

			<Button
				variant="ghost"
				size="icon"
				title="Salin Tautan Halaman"
				onclick={copyPageUrl}
				class="h-7 w-7 text-muted-foreground hover:text-foreground"
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
				class="h-7 w-7 text-muted-foreground hover:text-foreground"
			>
				<Download class="h-3.5 w-3.5" />
			</Button>

			<!-- Discoverable More Actions Button (Triggers the same Obsidian Context Menu) -->
			<Button
				variant="outline"
				size="sm"
				title="Opsi Catatan: Edit (Ctrl+E), Tambah Baru (Ctrl+N), Hapus (Atau Klik Kanan di mana saja)"
				onclick={(e) => openContextMenu(e, currentDoc)}
				class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground ml-0.5"
			>
				<MoreHorizontal class="h-3.5 w-3.5" />
				<span class="hidden md:inline text-[11px]">Aksi</span>
			</Button>
		</div>
	</div>

	<!-- In-Page Search Bar Banner -->
	{#if isSearchActive}
		<div class="flex items-center gap-2 border-b border-border bg-amber-50/60 px-4 py-2 dark:bg-amber-950/20">
			<Search class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
			<input
				type="text"
				bind:value={inPageSearchQuery}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						isSearchActive = false;
						inPageSearchQuery = '';
					}
				}}
				placeholder="Ketik kata kunci untuk mencari di dalam catatan ini..."
				class="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
			/>
			<button
				type="button"
				onclick={() => {
					isSearchActive = false;
					inPageSearchQuery = '';
				}}
				title="Tutup Pencarian (ESC)"
				aria-label="Tutup Pencarian"
				class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-amber-500/15 hover:text-foreground"
			>
				<X class="h-3.5 w-3.5 pointer-events-none" />
			</button>
		</div>
	{/if}

	<!-- ======================================================== -->
	<!-- 3. THREE-COLUMN WORKSPACE (EXPLORER + ARTICLE + OUTLINE)  -->
	<!-- ======================================================== -->
	<div class="flex gap-7 py-6">
		<!-- LEFT SIDEBAR: EXPLORER (Pohon Semua Dokumen) -->
		{#if !isFocusMode}
			<aside class="hidden lg:block w-68 shrink-0">
				<div class="sticky top-20 space-y-3">
					<!-- Switcher only shown on lg screens where Right Outline is hidden; on xl+ Explorer is dedicated left -->
					<div class="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-center text-xs font-semibold xl:hidden">
						<button
							type="button"
							onclick={() => (sidebarView = 'explorer')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all {sidebarView === 'explorer'
								? 'bg-background text-foreground shadow-xs'
								: 'text-muted-foreground hover:text-foreground'}"
						>
							<FolderTree class="h-3.5 w-3.5 text-indigo-500" />
							<span>Explorer</span>
						</button>

						<button
							type="button"
							onclick={() => (sidebarView = 'outline')}
							class="flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all {sidebarView === 'outline'
								? 'bg-background text-foreground shadow-xs'
								: 'text-muted-foreground hover:text-foreground'}"
						>
							<ListTree class="h-3.5 w-3.5 text-blue-500" />
							<span>Outline</span>
						</button>
					</div>

					{#if sidebarView === 'outline'}
						<div class="xl:hidden">
							<DocsRightOutline
								{outlineTree}
								{activeHeadingId}
								onSelectHeading={scrollToHeading}
								onContextMenu={(e) => openContextMenu(e, currentDoc)}
							/>
						</div>
					{/if}

					<!-- Explorer Tree (Always visible on xl+, or when sidebarView === 'explorer') -->
					<div
						class="space-y-3 {sidebarView === 'outline' ? 'hidden xl:block' : ''}"
						oncontextmenu={(e) => openContextMenu(e, null)}
						role="region"
						aria-label="Semua Dokumen"
					>
						<!-- Explorer Header with Obsidian File Explorer Actions: + File | + Folder | Collapse -->
						<div class="flex items-center justify-between px-1">
							<span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
								File Explorer
							</span>
							<div class="flex items-center gap-1">
								<Button
									variant="outline"
									size="sm"
									title="Buat File Catatan Baru (Ctrl+N)"
									onclick={() => openExplorerCreateFile()}
									class="h-6 gap-1 px-2 text-[11px] font-semibold"
								>
									<FilePlus class="h-3 w-3 text-emerald-500" />
									<span>+ File</span>
								</Button>
								<Button
									variant="outline"
									size="sm"
									title="Buat Folder Baru (Kategori)"
									onclick={() => openExplorerCreateFolder()}
									class="h-6 gap-1 px-2 text-[11px] font-semibold"
								>
									<FolderPlus class="h-3 w-3 text-amber-500" />
									<span>+ Folder</span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									title={allExpanded ? 'Ciutkan Semua Folder' : 'Bentangkan Semua Folder'}
									onclick={toggleAllCategories}
									class="h-6 w-6 text-muted-foreground hover:text-foreground rounded-md"
								>
									<ChevronsUpDown class="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>

						<!-- Section Switcher: SAP | SAC | WEB | Semua -->
						<div class="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-center shadow-2xs">
							<button
								type="button"
								onclick={() => (activeSection = 'SAP')}
								class="rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'SAP'
									? 'bg-blue-600 text-white shadow-xs'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								SAP
							</button>
							<button
								type="button"
								onclick={() => (activeSection = 'SAC')}
								class="rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'SAC'
									? 'bg-purple-600 text-white shadow-xs'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								SAC
							</button>
							<button
								type="button"
								onclick={() => (activeSection = 'WEB')}
								class="rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'WEB'
									? 'bg-emerald-600 text-white shadow-xs'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								WEB
							</button>
							<button
								type="button"
								onclick={() => (activeSection = 'ALL')}
								class="rounded-lg py-1.5 text-[11px] font-bold transition-all {activeSection === 'ALL'
									? 'bg-foreground text-background shadow-xs'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								Semua
							</button>
						</div>

						<!-- OBSIDIAN INLINE FILE / FOLDER CREATOR BOX -->
						{#if explorerCreator.open}
							<form
								onsubmit={submitExplorerCreator}
								class="rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-2.5 space-y-2 shadow-sm animate-in fade-in duration-100"
							>
								<div class="flex items-center justify-between gap-1 text-[10px] font-semibold">
									<div class="flex items-center gap-1.5 truncate">
										{#if explorerCreator.type === 'folder'}
											<FolderPlus class="h-3.5 w-3.5 text-amber-500 shrink-0" />
											<span class="truncate text-foreground">
												{explorerCreator.isRootFolder
													? `Folder Baru di ${explorerCreator.section}`
													: `Sub-Folder di ${explorerCreator.category}`}
											</span>
										{:else}
											<FilePlus class="h-3.5 w-3.5 text-emerald-500 shrink-0" />
											<span class="truncate text-foreground">
												File Baru di {explorerCreator.section} / {explorerCreator.subcategory || explorerCreator.category}
											</span>
										{/if}
									</div>
									<button
										type="button"
										onclick={() => (explorerCreator.open = false)}
										class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
									>
										<X class="h-3 w-3" />
									</button>
								</div>

								{#if explorerCreator.type === 'file'}
									<!-- Quick folder selector within current section so user can also pick any folder -->
									<select
										bind:value={explorerCreator.category}
										class="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none"
									>
										{#each currentTree.filter((g: any) => (g.section || 'SAP') === explorerCreator.section) as folderGroup}
											<option value={folderGroup.title}>📁 {folderGroup.title}</option>
										{/each}
									</select>
								{/if}

								<div class="flex items-center gap-1.5">
									<Input
										id="explorer-creator-input"
										type="text"
										bind:value={explorerCreator.name}
										placeholder={explorerCreator.type === 'folder'
											? 'Ketik nama folder lalu Enter...'
											: 'Ketik nama catatan lalu Enter...'}
										class="h-7 text-xs flex-1"
									/>
									<Button
										type="submit"
										size="sm"
										disabled={explorerCreator.isSubmitting || !explorerCreator.name.trim()}
										class="h-7 px-2.5 text-[11px]"
									>
										{explorerCreator.isSubmitting ? '...' : 'Buat'}
									</Button>
								</div>

								{#if explorerCreator.error}
									<p class="text-[10px] text-destructive">{explorerCreator.error}</p>
								{/if}
							</form>
						{/if}

						<!-- Quick Filter Input -->
						<div class="relative">
							<Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
							<Input
								type="text"
								bind:value={sidebarFilter}
								onkeydown={(e) => {
									if (e.key === 'Escape') sidebarFilter = '';
								}}
								placeholder="Filter dalam {activeSection === 'ALL' ? 'semua' : activeSection}..."
								class="h-8 pl-8 pr-7 text-xs"
							/>
							{#if sidebarFilter}
								<button
									type="button"
									onclick={() => (sidebarFilter = '')}
									title="Hapus Filter"
									aria-label="Hapus Filter"
									class="absolute right-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
								>
									<X class="h-3 w-3 pointer-events-none" />
								</button>
							{/if}
						</div>

						<!-- Navigation Groups (File Explorer Folders & Files) -->
						<nav class="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
							{#each filteredTree as group}
								{@const expanded = isCategoryExpanded(group)}
								<div
									class="group/folder rounded-xl transition-colors {expanded ? 'bg-muted/30' : ''}"
									oncontextmenu={(e) =>
										openContextMenu(e, {
											isFolder: true,
											nodeCount: group.nodes.length,
											section: group.section,
											category: group.title,
											title: `Folder: ${group.title}`
										})}
									role="group"
								>
									<div class="flex items-center justify-between pr-1 rounded-lg hover:bg-muted/80 transition-colors">
										<button
											type="button"
											onclick={() => toggleCategory(group.title, group)}
											class="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-foreground truncate"
										>
											<ChevronDown
												class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 {expanded
													? 'rotate-0 text-foreground'
													: '-rotate-90'}"
											/>
											{#if expanded}
												<FolderOpen class="h-3.5 w-3.5 text-amber-500 shrink-0" />
											{:else}
												<Folder class="h-3.5 w-3.5 text-amber-500 shrink-0" />
											{/if}
											<span class="truncate font-medium">{group.title}</span>
										</button>

										<div class="flex items-center gap-0.5 shrink-0">
											<!-- Quick Create File & Create Sub-Folder buttons on folder row -->
											<button
												type="button"
												title="Buat File Baru di folder {group.title}"
												onclick={(e) => {
													e.stopPropagation();
													openExplorerCreateFile({
														section: group.section,
														category: group.title
													});
												}}
												class="opacity-0 group-hover/folder:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-emerald-500 transition-opacity"
											>
												<FilePlus class="h-3 w-3" />
											</button>
											<button
												type="button"
												title="Buat Sub-Folder di dalam {group.title}"
												onclick={(e) => {
													e.stopPropagation();
													openExplorerCreateFolder({
														isFolder: true,
														section: group.section,
														category: group.title
													});
												}}
												class="opacity-0 group-hover/folder:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-amber-500 transition-opacity"
											>
												<FolderPlus class="h-3 w-3" />
											</button>

											{#if activeSection === 'ALL' && group.section}
												<span
													class="rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase {group.section === 'SAP'
														? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
														: group.section === 'SAC'
															? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
															: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}"
												>
													{group.section}
												</span>
											{/if}
											<span class="text-[10px] text-muted-foreground font-medium px-1.5 py-0.2 rounded-full bg-muted">
												{group.nodes.length}
											</span>
										</div>
									</div>

									{#if expanded}
										<div class="space-y-1 pl-2.5 ml-3 border-l-2 border-border my-1 animate-in fade-in duration-150">
											<!-- Sub-Categories (Nested Sub-Folders) -->
											{#each group.subcategories || [] as subGroup}
												{@const subExpanded = isSubcategoryExpanded(group.title, subGroup)}
												<div
													class="rounded-lg bg-muted/20"
													oncontextmenu={(e) =>
														openContextMenu(e, {
															isFolder: true,
															nodeCount: subGroup.nodes.length,
															section: group.section,
															category: group.title,
															subcategory: subGroup.title,
															title: `Sub-Folder: ${group.title} / ${subGroup.title}`
														})}
													role="group"
												>
													<div class="flex items-center justify-between pr-1">
														<button
															type="button"
															onclick={() => toggleSubcategory(group.title, subGroup)}
															class="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-muted/80 transition-colors truncate"
														>
															<ChevronDown
																class="h-3 w-3 transition-transform duration-150 shrink-0 {subExpanded
																	? 'rotate-0'
																	: '-rotate-90'}"
															/>
															<Folder class="h-3 w-3 shrink-0" />
															<span class="truncate">{subGroup.title}</span>
															<span class="ml-auto text-[9px] text-muted-foreground px-1 rounded bg-muted">
																{subGroup.nodes.length}
															</span>
														</button>
														<button
															type="button"
															title="Buat File Baru di Sub-Folder {subGroup.title}"
															onclick={() =>
																openExplorerCreateFile({
																	section: group.section,
																	category: group.title,
																	subcategory: subGroup.title
																})}
															class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-emerald-500"
														>
															<FilePlus class="h-3 w-3" />
														</button>
													</div>

													{#if subExpanded}
														<div class="space-y-0.5 pl-2.5 ml-2.5 border-l border-indigo-500/30 py-0.5">
															{#each subGroup.nodes as node}
																{@const isCurrent = node.path === data.slug || node.slug === data.slug}
																<a
																	href="/docs/{node.path}"
																	onclick={() => ensureTabOpen(node)}
																	oncontextmenu={(e) => openContextMenu(e, node)}
																	class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors {isCurrent
																		? 'bg-foreground text-background shadow-2xs font-semibold'
																		: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
																	title="{node.title} (Klik kanan untuk opsi)"
																>
																	<div class="flex items-center gap-2 truncate">
																		<FileText class="h-3.5 w-3.5 opacity-60 shrink-0" />
																		<span class="truncate">{node.title}</span>
																	</div>
																</a>
															{/each}
															{#if subGroup.nodes.length === 0}
																<button
																	type="button"
																	onclick={() =>
																		openExplorerCreateFile({
																			section: group.section,
																			category: group.title,
																			subcategory: subGroup.title
																		})}
																	class="w-full text-left px-2 py-1 text-[10px] italic text-muted-foreground hover:text-foreground"
																>
																	+ Buat file di sub-folder ini...
																</button>
															{/if}
														</div>
													{/if}
												</div>
											{/each}

											<!-- Direct Documents inside Category (without Sub-Category) -->
											{#each group.directNodes || group.nodes as node}
												{@const isCurrent = node.path === data.slug || node.slug === data.slug}
												<a
													href="/docs/{node.path}"
													onclick={() => ensureTabOpen(node)}
													oncontextmenu={(e) => openContextMenu(e, node)}
													class="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {isCurrent
														? 'bg-foreground text-background shadow-2xs font-semibold'
														: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
													title="{node.title} (Klik kanan untuk opsi)"
												>
													<div class="flex items-center gap-2 truncate">
														<FileText class="h-3.5 w-3.5 opacity-60 shrink-0" />
														<span class="truncate">{node.title}</span>
													</div>
												</a>
											{/each}

											{#if (group.directNodes || group.nodes).length === 0 && (group.subcategories || []).length === 0}
												<button
													type="button"
													onclick={() =>
														openExplorerCreateFile({
															section: group.section,
															category: group.title
														})}
													class="w-full text-left px-2.5 py-1.5 text-[11px] italic text-muted-foreground hover:text-foreground"
												>
													Folder kosong — klik untuk + Buat File
												</button>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</nav>
					</div>
				</div>
			</aside>
		{/if}

		<!-- CENTER AREA: DOCUMENT CONTENT OR OBSIDIAN IN-PAGE NOTE EDITOR -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="min-w-0 flex-1 {isFocusMode ? 'max-w-4xl mx-auto' : ''}"
			oncontextmenu={(e) => openContextMenu(e, currentDoc)}
			onclick={handleArticleClick}
			ondblclick={handleArticleDblClick}
			role="article"
		>
			{#if isInlineEditing}
				<!-- ============================================================ -->
				<!-- OBSIDIAN IN-PAGE NOTE EDITOR (Write Directly Inside Note!)   -->
				<!-- ============================================================ -->
				<div class="space-y-4 rounded-2xl border border-indigo-500/30 bg-card/60 p-5 shadow-sm animate-in fade-in duration-150">
					<!-- Top Automatic Folder Path & Action Buttons -->
					<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
						<div class="flex flex-wrap items-center gap-1.5 text-xs">
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

							<span class="text-muted-foreground">/</span>
							<Badge variant="outline" class="gap-1 text-[11px] font-semibold">
								<Folder class="h-3 w-3 text-amber-500" />
								<span>{currentDoc?.category || data.article.category}</span>
							</Badge>

							{#if currentDoc?.subcategory || data.article?.subcategory}
								<span class="text-muted-foreground">/</span>
								<Badge variant="secondary" class="gap-1 text-[11px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
									<FolderTree class="h-3 w-3" />
									<span>{currentDoc?.subcategory || data.article?.subcategory}</span>
								</Badge>
							{/if}

							{#if inlineStatusMsg}
								<span class="ml-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
									{inlineStatusMsg}
								</span>
							{/if}
						</div>

						<div class="flex items-center gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => (isInlineEditing = false)}
								class="h-8 gap-1 text-xs"
							>
								<Eye class="h-3.5 w-3.5" />
								<span>Mode Baca</span>
							</Button>
							<Button
								type="button"
								variant="default"
								size="sm"
								disabled={isSavingInline}
								onclick={() => saveInlineNote(true)}
								class="h-8 gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs shadow-xs"
							>
								{#if isSavingInline}
									<Loader2 class="h-3.5 w-3.5 animate-spin" />
									<span>Menyimpan...</span>
								{:else}
									<Save class="h-3.5 w-3.5" />
									<span>Simpan Catatan (Ctrl+S)</span>
								{/if}
							</Button>
						</div>
					</div>

					<!-- Note Title Input (Like Obsidian / Notion Note Heading) -->
					<div>
						<Input
							type="text"
							bind:value={inlineTitle}
							placeholder="Judul Catatan..."
							class="h-11 border-transparent bg-muted/40 px-3 text-xl font-extrabold tracking-tight text-foreground focus-visible:border-indigo-500 sm:text-2xl"
						/>
					</div>

					{#if inlineErrorMsg}
						<div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{inlineErrorMsg}
						</div>
					{/if}

					<!-- Formatting & Mode Toolbar -->
					<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-2">
						<Tabs bind:value={inlineMode} class="w-auto">
							<TabsList class="h-8 bg-background/80 p-0.5">
								<TabsTrigger value="edit" class="gap-1.5 px-2.5 py-1 text-xs">
									<Edit3 class="h-3 w-3" />
									<span>Tulis</span>
								</TabsTrigger>
								<TabsTrigger value="split" class="gap-1.5 px-2.5 py-1 text-xs">
									<Columns2 class="h-3 w-3" />
									<span>Split</span>
								</TabsTrigger>
								<TabsTrigger value="preview" class="gap-1.5 px-2.5 py-1 text-xs">
									<Eye class="h-3 w-3" />
									<span>Preview</span>
								</TabsTrigger>
							</TabsList>
						</Tabs>

						<div class="flex flex-wrap items-center gap-1">
							<button
								type="button"
								title="Heading 2"
								onclick={() => insertInlineSnippet('\n## ', '\n')}
								class="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<Heading2 class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								title="Heading 3"
								onclick={() => insertInlineSnippet('\n### ', '\n')}
								class="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<Heading3 class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								title="Bold"
								onclick={() => insertInlineSnippet('**', '**')}
								class="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<Bold class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								title="Italic"
								onclick={() => insertInlineSnippet('*', '*')}
								class="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<Italic class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								title="Bullet List"
								onclick={() => insertInlineSnippet('\n- ', '')}
								class="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<List class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								title="Sisipkan Checklist"
								onclick={() => insertInlineSnippet(MARKDOWN_CHECKLIST_SNIPPET, '')}
								class="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<CheckSquare class="h-3.5 w-3.5 text-emerald-500" />
								<span class="hidden sm:inline">Checklist</span>
							</button>
							<button
								type="button"
								title="Sisipkan Tabel Markdown"
								onclick={() => insertInlineSnippet(MARKDOWN_TABLE_SNIPPET, '')}
								class="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<Table class="h-3.5 w-3.5 text-indigo-500" />
								<span class="hidden sm:inline">Tabel</span>
							</button>
							<button
								type="button"
								title="Blok Kode"
								onclick={() => insertInlineSnippet('\n```javascript\n', '\n```\n')}
								class="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<Code class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								title="Unggah Gambar / Screenshot"
								onclick={() => inlineImageInputRef?.click()}
								disabled={isUploadingInlineImage}
								class="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
							>
								<ImageIcon class="h-3.5 w-3.5 text-indigo-500" />
								<span class="hidden sm:inline">{isUploadingInlineImage ? 'Unggah...' : '+ Gambar'}</span>
							</button>
							<button
								type="button"
								title="Tampilkan Template Cepat & AI Writer"
								onclick={() => (showTemplateBar = !showTemplateBar)}
								class="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400"
							>
								<Sparkles class="h-3 w-3" />
								<span>Template & AI</span>
							</button>
						</div>
					</div>

					<!-- Hidden File Inputs for Inline Editor -->
					<input
						type="file"
						bind:this={inlineImageInputRef}
						accept="image/*"
						class="hidden"
						onchange={handleInlineFileUpload}
					/>
					<input
						type="file"
						bind:this={inlineMdInputRef}
						accept=".md,.txt,text/markdown,text/plain"
						class="hidden"
						onchange={handleInlineMdImport}
					/>

					<!-- Optional Collapsible Template & AI Writer Bar -->
					{#if showTemplateBar}
						<div class="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-3 animate-in fade-in duration-100">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
									<LayoutTemplate class="h-3.5 w-3.5 text-indigo-500" />
									<span>Pilih Kerangka Template 1-Klik atau Bantuan AI:</span>
								</span>
								<button
									type="button"
									onclick={() => inlineMdInputRef?.click()}
									class="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
								>
									<FileUp class="h-3 w-3 text-indigo-500" />
									<span>Import File (.md / .txt)</span>
								</button>
							</div>

							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
								{#each DOC_TEMPLATES as tpl}
									<button
										type="button"
										onclick={() => applyInlineTemplate(tpl)}
										class="flex flex-col items-start rounded-lg border border-border bg-background p-2 text-left hover:border-indigo-500/60 transition-all"
									>
										<span class="text-[11px] font-bold text-foreground truncate">{tpl.name}</span>
										<span class="text-[10px] text-muted-foreground line-clamp-1">{tpl.description}</span>
									</button>
								{/each}
							</div>

							<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-border/60">
								<Input
									type="text"
									bind:value={inlineAiPrompt}
									placeholder="Ketik instruksi untuk dibuatkan AI (opsional)..."
									class="h-8 text-xs flex-1"
									disabled={isInlineAiLoading}
								/>
								<div class="flex items-center gap-1.5">
									<Button
										type="button"
										size="sm"
										disabled={isInlineAiLoading}
										onclick={() => runInlineAiAction('generate')}
										class="h-8 gap-1 bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
									>
										{#if isInlineAiLoading}
											<Loader2 class="h-3 w-3 animate-spin" />
										{:else}
											<Wand2 class="h-3 w-3" />
										{/if}
										<span>Tulis AI</span>
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={isInlineAiLoading || !inlineContent}
										onclick={() => runInlineAiAction('format')}
										class="h-8 gap-1 text-xs"
									>
										<Sparkles class="h-3 w-3" />
										<span>Rapikan Format</span>
									</Button>
								</div>
							</div>
						</div>
					{/if}

					<!-- Main Content Writing Area (Only fill the content!) -->
					{#if inlineMode === 'edit'}
						<Textarea
							id="inline-note-textarea"
							bind:value={inlineContent}
							onpaste={handleInlinePaste}
							ondrop={handleInlineDrop}
							ondragover={(e) => e.preventDefault()}
							rows={20}
							placeholder="Langsung ketik isi catatan dokumentasi di sini... (Mendukung Markdown, Paste Screenshot Ctrl+V, Tabel, dan Code Block)"
							class="min-h-[440px] rounded-xl p-4 font-mono text-xs leading-relaxed shadow-inner"
						/>
					{:else if inlineMode === 'split'}
						<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<Textarea
								id="inline-note-textarea"
								bind:value={inlineContent}
								onpaste={handleInlinePaste}
								ondrop={handleInlineDrop}
								ondragover={(e) => e.preventDefault()}
								rows={20}
								placeholder="Langsung ketik isi catatan dokumentasi di sini..."
								class="h-[460px] resize-none rounded-xl p-4 font-mono text-xs leading-relaxed shadow-inner"
							/>
							<div class="h-[460px] overflow-y-auto rounded-xl border border-border bg-background/60 p-5">
								<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
									{@html renderMarkdown(inlineContent || '*Pratinjau catatan akan tampil di sini...*')}
								</div>
							</div>
						</div>
					{:else}
						<div class="min-h-[400px] rounded-xl border border-border bg-background/60 p-6">
							<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
								{@html renderMarkdown(inlineContent || '*Catatan masih kosong.*')}
							</div>
						</div>
					{/if}

					<div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
						<span>
							💡 Lokasi otomatis di <strong class="text-foreground">{currentDoc?.section || data.article.section} / {currentDoc?.category || data.article.category}</strong>. Tekan <strong class="text-foreground">Ctrl + S</strong> untuk menyimpan atau <strong class="text-foreground">Ctrl + V</strong> untuk paste gambar.
						</span>
						<Button
							type="button"
							size="sm"
							disabled={isSavingInline}
							onclick={() => saveInlineNote(true)}
							class="h-8 gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
						>
							<Save class="h-3.5 w-3.5" />
							<span>Simpan & Selesai</span>
						</Button>
					</div>
				</div>
			{:else}
				<!-- ============================================================ -->
				<!-- READING VIEW (Standard Note View)                            -->
				<!-- ============================================================ -->
				<!-- Document Header & Meta -->
				<div class="mb-7">
					<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
						<div class="flex flex-wrap items-center gap-2">
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

							<Badge variant="outline" class="gap-1 text-[11px] font-semibold">
								<Folder class="h-3 w-3 text-amber-500" />
								<span>{currentDoc?.category || data.article.category}</span>
							</Badge>
							{#if currentDoc?.subcategory || data.article?.subcategory}
								<Badge variant="secondary" class="gap-1 text-[11px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
									<FolderTree class="h-3 w-3" />
									<span>{currentDoc?.subcategory || data.article?.subcategory}</span>
								</Badge>
							{/if}
							<span class="text-xs text-muted-foreground">•</span>
							<div class="flex items-center gap-1 text-xs text-muted-foreground">
								<Clock class="h-3.5 w-3.5" />
								<span>{readingTime} menit baca</span>
							</div>
							{#if currentDoc?.updatedAt}
								<span class="text-xs text-muted-foreground">•</span>
								<div class="flex items-center gap-1 text-xs text-muted-foreground">
									<Calendar class="h-3.5 w-3.5" />
									<span>
										{new Date(currentDoc.updatedAt).toLocaleDateString('id-ID', {
											day: 'numeric',
											month: 'short',
											year: 'numeric'
										})}
									</span>
								</div>
							{/if}
						</div>

						<Button
							variant="outline"
							size="sm"
							onclick={() => startInlineEdit(currentDoc)}
							class="h-8 gap-1.5 text-xs"
						>
							<Edit3 class="h-3.5 w-3.5 text-blue-500" />
							<span>Tulis / Edit Isi Catatan</span>
						</Button>
					</div>

					<h1 class="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
						{currentDoc?.title || data.article.title}
					</h1>

					{#if currentDoc?.description || data.article.snippet}
						<p class="mt-2.5 text-sm leading-relaxed text-muted-foreground">
							{currentDoc?.description || data.article.snippet}
						</p>
					{/if}

					{#if currentDoc?.tags && currentDoc.tags.length > 0}
						<div class="mt-3.5 flex flex-wrap items-center gap-1.5">
							{#each currentDoc.tags as tag}
								<Badge variant="outline" class="gap-1 px-2 py-0.5 text-[10px] text-muted-foreground">
									<Tag class="h-2.5 w-2.5 opacity-60" />
									<span>{tag}</span>
								</Badge>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Pinned Inline AI Summary Card (when user pins an analysis from DocAiAssistantModal) -->
				{#if pinnedAiSummary && pinnedAiSummary.slug === data.slug}
					<div class="mb-7 overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-background to-background p-4 shadow-sm ring-1 ring-indigo-500/15 animate-in fade-in duration-150">
						<div class="mb-2.5 flex items-center justify-between border-b border-border/70 pb-2">
							<div class="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
								<Sparkles class="h-3.5 w-3.5" />
								<span>{pinnedAiSummary.title}</span>
								<Badge variant="outline" class="text-[9px] px-1.5 py-0 border-indigo-500/30 text-indigo-500">
									Disematkan
								</Badge>
							</div>
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={askAiAboutDoc}
									class="rounded-md px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400 transition-colors"
								>
									Buka Modal AI
								</button>
								<button
									type="button"
									onclick={() => (pinnedAiSummary = null)}
									title="Tutup sematan AI"
									aria-label="Tutup sematan AI"
									class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/15 hover:text-red-500 transition-colors"
								>
									<X class="h-3.5 w-3.5 pointer-events-none" />
								</button>
							</div>
						</div>
						<div class="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
							{@html renderMarkdown(pinnedAiSummary.content)}
						</div>
					</div>
				{/if}

				<!-- Markdown Rendered Body -->
				<article class="prose prose-zinc dark:prose-invert max-w-none leading-relaxed">
					{@html renderedHtml}
				</article>

				<!-- Obsidian Quick Hint Banner -->
				<div class="mt-12 rounded-2xl border border-border bg-muted/30 p-4">
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<MousePointerClick class="h-4 w-4 text-indigo-500 shrink-0" />
							<span class="text-xs text-muted-foreground">
								Tip: Buat <strong class="text-foreground">+ Folder</strong> atau <strong class="text-foreground">+ File</strong> di File Explorer kiri, lalu tulis isinya langsung di halaman ini (<strong class="text-foreground">Double-Click</strong> teks atau tekan <kbd class="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">Ctrl+E</kbd>).
							</span>
						</div>

						<Button size="sm" onclick={copyPageUrl} variant="ghost" class="gap-1 text-xs shrink-0">
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

				<Separator class="my-8" />

				<!-- Pagination Footer -->
				<div class="flex items-center justify-between gap-4">
					{#if data.prevArticle}
						<a href="/docs/{data.prevArticle.path}" class="flex-1">
							<div class="group flex flex-col rounded-xl border border-border p-4 transition-all hover:bg-muted/50">
								<span class="flex items-center gap-1 text-[11px] text-muted-foreground">
									<ChevronLeft class="h-3.5 w-3.5" /> Sebelumnya
								</span>
								<span class="mt-1 text-sm font-semibold text-foreground">
									{data.prevArticle.title}
								</span>
							</div>
						</a>
					{:else}
						<div></div>
					{/if}

					{#if data.nextArticle}
						<a href="/docs/{data.nextArticle.path}" class="flex-1 text-right">
							<div class="group flex flex-col rounded-xl border border-border p-4 transition-all hover:bg-muted/50">
								<span class="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
									Selanjutnya <ChevronRight class="h-3.5 w-3.5" />
								</span>
								<span class="mt-1 text-sm font-semibold text-foreground">
									{data.nextArticle.title}
								</span>
							</div>
						</a>
					{/if}
				</div>
			{/if}
		</div>

		<!-- RIGHT SIDEBAR: DEDICATED OUTLINE ("Di Halaman Ini") on XL+ Screens -->
		{#if !isFocusMode}
			<aside class="hidden xl:block w-60 shrink-0">
				<div class="sticky top-20">
					<DocsRightOutline
						{outlineTree}
						{activeHeadingId}
						onSelectHeading={scrollToHeading}
						onContextMenu={(e) => openContextMenu(e, currentDoc)}
					/>
				</div>
			</aside>
		{/if}
	</div>
</div>

<!-- Obsidian / Notion Floating Context Menu -->
<DocsContextMenu
	open={contextMenu.open}
	x={contextMenu.x}
	y={contextMenu.y}
	targetDoc={contextMenu.targetDoc}
	onEdit={handleContextMenuEdit}
	onCreate={handleContextMenuCreate}
	onCreateFolder={openExplorerCreateFolder}
	onDuplicate={handleContextMenuDuplicate}
	onAskAi={handleContextMenuAi}
	onCopyLink={handleContextMenuCopyLink}
	onCopyMarkdown={handleContextMenuCopyMarkdown}
	onDownload={handleContextMenuDownload}
	onDelete={handleContextMenuDelete}
	onClose={closeContextMenu}
/>

<!-- Full-Screen Image Lightbox -->
<DocsLightbox
	src={lightboxSrc}
	alt={lightboxAlt}
	onClose={() => (lightboxSrc = null)}
/>

<!-- Modal Document Editor & AI Generator -->
<DocEditorModal
	bind:isOpen={isEditorOpen}
	mode={editorMode}
	initialDoc={editingDocTarget || (editorMode === 'edit' ? currentDoc : null)}
	categories={categoriesList}
	onSave={handleSaved}
/>

<!-- Dedicated Single-Document AI Assistant Modal -->
<DocAiAssistantModal
	bind:isOpen={isDocAiOpen}
	doc={docAiTarget || currentDoc}
	initialPrompt={docAiInitialPrompt}
	onPinToArticle={(content, title) => {
		pinnedAiSummary = {
			content,
			title,
			slug: data.slug
		};
	}}
/>
