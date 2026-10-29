<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import {
		AlertDialog,
		AlertDialogContent,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogAction,
		AlertDialogCancel
	} from '$lib/components/ui/alert-dialog';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import DocAiAssistantModal from '$lib/components/docs/DocAiAssistantModal.svelte';
	import DocsContextMenu from '$lib/components/docs/DocsContextMenu.svelte';
	import DocsLightbox from '$lib/components/docs/DocsLightbox.svelte';
	import DocsRightOutline from '$lib/components/docs/DocsRightOutline.svelte';
	import { updateTreeCache, updateDocCache, invalidateDocCache } from '$lib/stores/docsCache';
	import { renderMarkdown, extractOutlineTree, slugifyHeading, extractTitleFromMarkdown } from '$lib/utils/markdown';
	import {
		MARKDOWN_TABLE_SNIPPET,
		MARKDOWN_CHECKLIST_SNIPPET
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
		Plus,
		Search,
		ExternalLink,
		ChevronDown,
		ChevronUp,
		ArrowUp,
		ArrowDown,
		PenLine,
		GripVertical,
		X,
		MoreHorizontal,
		Edit3,
		Save,
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
		Wand2,
		RotateCcw,
		Eye,
		Copy,
		Columns2,
		Maximize2,
		Minimize2
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let activeSection = $state<'SAP' | 'SAC' | 'WEB' | 'ALL'>('ALL');

	// Local mutable document & tree state
	let editorDoc = $state<any>(null);
	let currentDoc = $derived(editorDoc ?? data.doc);
	let customTree = $state<any>(null);
	let currentTree = $derived(customTree ?? data.treeData);
	let sidebarFilter = $state('');
	let expandedCategories = $state<Record<string, boolean>>({});
	let expandedSubcategories = $state<Record<string, boolean>>({});

	// Focus mode, Mobile Explorer & Outline Scroll-spy
	let isFocusMode = $state(false);
	let isMobileExplorerOpen = $state(false);
	let copyToastMsg = $state('');
	let activeHeadingId = $state<string>('');

	function showCopyToast(msg: string) {
		copyToastMsg = msg;
		setTimeout(() => {
			if (copyToastMsg === msg) copyToastMsg = '';
		}, 2500);
	}

	// Lightbox state for zoomable images
	let lightboxSrc = $state<string | null>(null);
	let lightboxAlt = $state<string>('');

	// Obsidian Context Menu State
	let contextMenu = $state<{ open: boolean; x: number; y: number; targetDoc: any }>({
		open: false,
		x: 0,
		y: 0,
		targetDoc: null
	});
	let isEditorOpen = $state(false);

	// Dedicated Single-Document AI Assistant Modal & Pinned Summary State
	let isDocAiOpen = $state(false);
	let docAiTarget = $state<any>(null);
	let docAiInitialPrompt = $state('');
	let pinnedAiSummary = $state<{ title: string; content: string; slug: string } | null>(null);

	// Identify whether current document belongs to SAC section (FSD & Builder are SAC-only)
	const isSacDoc = $derived(
		(currentDoc?.section || data.article?.section || '').toUpperCase() === 'SAC' ||
		(data.slug || '').toLowerCase().startsWith('sac/')
	);

	// Tab switcher between FSD (Konsultan) and Story Builder Spec (Tim Internal) - SAC only
	let activeDocTab = $state<'fsd' | 'builder'>('fsd');

	$effect(() => {
		if (data.slug) {
			activeDocTab = 'fsd';
		}
	});

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

	// Shadcn Alert Dialog confirmation state
	let alertConfirm = $state<{
		open: boolean;
		title: string;
		description: string;
		variant?: 'default' | 'destructive';
		confirmLabel?: string;
		onConfirm: () => void;
	}>({
		open: false,
		title: '',
		description: '',
		onConfirm: () => {}
	});

	// Rename Modal state (for files and folders)
	let renameDialog = $state<{
		open: boolean;
		type: 'file' | 'folder';
		target: any;
		name: string;
		isSubmitting: boolean;
		error: string;
	}>({
		open: false,
		type: 'file',
		target: null,
		name: '',
		isSubmitting: false,
		error: ''
	});

	// Drag & Drop Folder Reordering state
	let draggedFolder = $state<{ section: string; category: string } | null>(null);
	let dragOverFolderCategory = $state<string | null>(null);

	// =========================================================================
	// OBSIDIAN IN-PAGE NOTE EDITOR STATE (Write Directly Inside the Note!)
	// =========================================================================
	let isInlineEditing = $state(false);
	let editorLayout = $state<'full' | 'split'>('full');
	let inlineTitle = $state('');
	let inlineContent = $state('');
	let inlineBuilderContent = $state('');
	let inlineEditTarget = $state<'fsd' | 'builder'>('fsd');
	let inlineSacUrl = $state('');
	let isSavingInline = $state(false);
	let inlineStatusMsg = $state('');
	let inlineErrorMsg = $state('');
	let showCustomAiPrompt = $state(false);
	let customAiPrompt = $state('');
	let isInlineAiLoading = $state(false);
	let inlineAiActionType = $state<'format' | 'custom' | null>(null);
	let inlineAiUndoContent = $state<{ target: 'fsd' | 'builder'; content: string } | null>(null);
	let inlineAvailableDraft = $state<{
		title: string;
		content: string;
		builderContent?: string;
		sacUrl?: string;
		savedAt: string;
	} | null>(null);
	let inlineLastAutoSavedAt = $state('');
	let inlineReadyForAutoSave = $state(false);
	let debouncedInlinePreview = $state('');
	let isUploadingInlineImage = $state(false);
	let isDraggingInlineImage = $state(false);
	let inlineImageInputRef = $state<HTMLInputElement | null>(null);
	let inlineMdInputRef = $state<HTMLInputElement | null>(null);

	let activeInlineBody = $derived(
		isSacDoc && inlineEditTarget === 'builder' ? inlineBuilderContent : inlineContent
	);

	let inlineWordCount = $derived(
		activeInlineBody
			? activeInlineBody
					.trim()
					.split(/\s+/)
					.filter(Boolean).length
			: 0
	);

	function setActiveInlineBody(val: string) {
		if (isSacDoc && inlineEditTarget === 'builder') {
			inlineBuilderContent = val;
		} else {
			inlineContent = val;
		}
	}

	let inlineDraftKey = $derived(`portal_inline_draft_${currentDoc?.slug || data.slug}`);

	$effect(() => {
		if (!isInlineEditing) return;
		const rawToRender = activeInlineBody;
		const timer = setTimeout(() => {
			debouncedInlinePreview = renderMarkdown(
				rawToRender || '*Pratinjau catatan...*'
			);
		}, 160);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (!isInlineEditing || !inlineReadyForAutoSave || typeof window === 'undefined') return;
		const t = inlineTitle;
		const c = inlineContent;
		const b = inlineBuilderContent;
		const s = inlineSacUrl;
		const origTitle = currentDoc?.title || '';
		const origContent = currentDoc?.content || '';
		const origBuilder = currentDoc?.builderContent || '';
		const origSac = currentDoc?.sacUrl || '';

		if (
			t.trim() === origTitle.trim() &&
			c.trim() === origContent.trim() &&
			b.trim() === origBuilder.trim() &&
			s.trim() === origSac.trim()
		) {
			return;
		}

		const timer = setTimeout(() => {
			try {
				const savedAt = new Date().toLocaleTimeString('id-ID', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				localStorage.setItem(
					inlineDraftKey,
					JSON.stringify({
						title: t,
						content: c,
						builderContent: b,
						sacUrl: s,
						savedAt
					})
				);
				inlineLastAutoSavedAt = savedAt;
			} catch (_) {}
		}, 700);

		return () => clearTimeout(timer);
	});

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

	let lastLoadedSlug = $state('');

	$effect(() => {
		const targetSlug = data.slug;
		if (targetSlug && targetSlug !== lastLoadedSlug) {
			lastLoadedSlug = targetSlug;
			editorDoc = null;
			customTree = null;
			const sec = (data.article?.section || data.doc?.section) as 'SAP' | 'SAC' | 'WEB';
			if (['SAP', 'SAC', 'WEB'].includes(sec)) {
				activeSection = sec;
			}
			const cat = data.doc?.category || data.article?.category;
			if (cat) expandedCategories[cat] = true;

			// Automatically enter Obsidian In-Page Note Writing Mode if file was just created or is empty
			const isNewlyCreated = pendingAutoEditSlug === targetSlug;
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
		isFocusMode = false;
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
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				el.focus();
				el.select();
			}
		}, 40);
	}

	function openExplorerCreateFolder(target?: any) {
		closeContextMenu();
		isFocusMode = false;
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
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				el.focus();
				el.select();
			}
		}, 40);
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

				if (json.treeData) {
					customTree = json.treeData;
					updateTreeCache(json.treeData);
				}
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

				if (json.treeData) {
					customTree = json.treeData;
					updateTreeCache(json.treeData);
				}
				if (json.document) {
					updateDocCache(json.document);
				}
				expandedCategories[explorerCreator.category] = true;
				explorerCreator.open = false;

				if (json.document?.slug) {
					if (json.document) {
					updateDocCache(json.document);
				}
				pendingAutoEditSlug = json.document.slug;
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
	// RENAME (FILE & FOLDER) ACTIONS
	// =========================================================================
	function openRename(target?: any) {
		closeContextMenu();
		const t = target || currentDoc;
		if (!t) return;
		const isFolder = Boolean(t.isFolder);
		const currentName = isFolder
			? t.subcategory || t.category || t.title
			: t.title || 'Catatan';

		renameDialog = {
			open: true,
			type: isFolder ? 'folder' : 'file',
			target: t,
			name: currentName,
			isSubmitting: false,
			error: ''
		};

		setTimeout(() => {
			const el = document.getElementById('rename-dialog-input') as HTMLInputElement | null;
			if (el) {
				el.focus();
				el.select();
			}
		}, 50);
	}

	async function submitRename(e?: Event) {
		if (e) e.preventDefault();
		const cleanName = renameDialog.name.trim();
		if (!cleanName) return;

		renameDialog.isSubmitting = true;
		renameDialog.error = '';

		try {
			if (renameDialog.type === 'folder') {
				const isSub = Boolean(renameDialog.target?.subcategory);
				const res = await fetch('/api/docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						type: 'rename-folder',
						section: renameDialog.target?.section || 'SAP',
						oldCategory: renameDialog.target?.category,
						newCategory: isSub ? renameDialog.target?.category : cleanName,
						oldSubcategory: renameDialog.target?.subcategory,
						newSubcategory: isSub ? cleanName : undefined
					})
				});
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || 'Gagal mengubah nama folder');

				if (json.treeData) {
					customTree = json.treeData;
					updateTreeCache(json.treeData);
				}
				const targetCat = isSub ? renameDialog.target?.category : cleanName;
				expandedCategories[targetCat] = true;
				if (isSub) {
					expandedSubcategories[`${targetCat}::${cleanName}`] = true;
				}

				if (currentDoc) {
					if (!isSub && currentDoc.category?.toLowerCase() === renameDialog.target?.category?.toLowerCase()) {
						if (editorDoc) {
							editorDoc.category = cleanName;
						} else if (data.doc) {
							data.doc.category = cleanName;
						}
					}
					if (isSub && currentDoc.subcategory?.toLowerCase() === renameDialog.target?.subcategory?.toLowerCase()) {
						if (editorDoc) {
							editorDoc.subcategory = cleanName;
						} else if (data.doc) {
							data.doc.subcategory = cleanName;
						}
					}
				}

				renameDialog.open = false;
				showCopyToast('✓ Nama folder berhasil diubah');
			} else {
				const slug = renameDialog.target?.slug || renameDialog.target?.path || renameDialog.target?.id;
				const res = await fetch('/api/docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						type: 'rename-file',
						id: slug,
						newTitle: cleanName
					})
				});
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || 'Gagal mengubah nama file');

				if (json.treeData) {
					customTree = json.treeData;
					updateTreeCache(json.treeData);
				}

				if (json.document) {
					updateDocCache(json.document);
				}
				if (slug === data.slug || slug === currentDoc?.slug) {
					if (json.document) {
						editorDoc = json.document;
			if (json.document) {
				updateDocCache(json.document);
			}
					}
					if (isInlineEditing) {
						inlineTitle = cleanName;
					}
				}

				renameDialog.open = false;
				showCopyToast('✓ Nama file berhasil diubah');
			}
		} catch (err: any) {
			renameDialog.error = err.message || 'Gagal mengubah nama';
		} finally {
			renameDialog.isSubmitting = false;
		}
	}

	// =========================================================================
	// REORDER FOLDER ACTIONS (UP / DOWN & DRAG-AND-DROP)
	// =========================================================================
	async function moveFolderOrder(group: any, direction: 'up' | 'down') {
		const sec = group.section || 'SAP';
		const sectionFolders = (currentTree || [])
			.filter((g: any) => (g.section || 'SAP') === sec)
			.map((g: any) => g.title);

		const idx = sectionFolders.indexOf(group.title || group.category);
		if (idx === -1) return;
		if (direction === 'up' && idx === 0) return;
		if (direction === 'down' && idx === sectionFolders.length - 1) return;

		const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
		const reordered = [...sectionFolders];
		const [moved] = reordered.splice(idx, 1);
		reordered.splice(targetIdx, 0, moved);

		try {
			const res = await fetch('/api/docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'reorder-folders',
					section: sec,
					categories: reordered
				})
			});
			const d = await res.json();
			if (res.ok && d.treeData) {
				customTree = d.treeData;
				updateTreeCache(d.treeData);
				showCopyToast('✓ Urutan folder berhasil diperbarui');
			}
		} catch (_) {}
	}

	async function moveSubfolderOrder(group: any, subGroup: any, direction: 'up' | 'down') {
		const sec = group.section || 'SAP';
		const cat = group.title || group.category;
		const subName = subGroup.title || subGroup.subcategory;
		const subList = (group.subcategories || []).map((s: any) => s.title);

		const idx = subList.indexOf(subName);
		if (idx === -1) return;
		if (direction === 'up' && idx === 0) return;
		if (direction === 'down' && idx === subList.length - 1) return;

		const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
		const reordered = [...subList];
		const [moved] = reordered.splice(idx, 1);
		reordered.splice(targetIdx, 0, moved);

		try {
			const res = await fetch('/api/docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'reorder-subfolders',
					section: sec,
					category: cat,
					subcategories: reordered
				})
			});
			const d = await res.json();
			if (res.ok && d.treeData) {
				customTree = d.treeData;
				updateTreeCache(d.treeData);
				showCopyToast('✓ Urutan sub-folder berhasil diperbarui');
			}
		} catch (_) {}
	}

	function handleFolderDragStart(e: DragEvent, group: any) {
		draggedFolder = { section: group.section || 'SAP', category: group.title };
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', group.title);
		}
	}

	function handleFolderDragOver(e: DragEvent, group: any) {
		if (!draggedFolder || draggedFolder.section !== (group.section || 'SAP')) return;
		if (draggedFolder.category === group.title) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverFolderCategory = group.title;
	}

	async function handleFolderDrop(e: DragEvent, targetGroup: any) {
		e.preventDefault();
		dragOverFolderCategory = null;
		if (!draggedFolder || draggedFolder.section !== (targetGroup.section || 'SAP')) return;
		const sourceCat = draggedFolder.category;
		const targetCat = targetGroup.title;
		draggedFolder = null;
		if (sourceCat === targetCat) return;

		const sectionFolders = (currentTree || [])
			.filter((g: any) => (g.section || 'SAP') === targetGroup.section)
			.map((g: any) => g.title);

		const fromIdx = sectionFolders.indexOf(sourceCat);
		const toIdx = sectionFolders.indexOf(targetCat);
		if (fromIdx === -1 || toIdx === -1) return;

		const reordered = [...sectionFolders];
		reordered.splice(fromIdx, 1);
		reordered.splice(toIdx, 0, sourceCat);

		try {
			const res = await fetch('/api/docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'reorder-folders',
					section: targetGroup.section,
					categories: reordered
				})
			});
			const d = await res.json();
			if (res.ok && d.treeData) {
				customTree = d.treeData;
				updateTreeCache(d.treeData);
				showCopyToast('✓ Urutan folder berhasil dipindahkan');
			}
		} catch (_) {}
	}

	// =========================================================================
	// OBSIDIAN IN-PAGE NOTE WRITING & EDITING FUNCTIONS
	// =========================================================================
	function isInlineDirty(): boolean {
		const d = currentDoc;
		return (
			inlineTitle.trim() !== (d?.title || '').trim() ||
			inlineContent.trim() !== (d?.content || '').trim() ||
			inlineBuilderContent.trim() !== (d?.builderContent || '').trim() ||
			inlineSacUrl.trim() !== (d?.sacUrl || '').trim()
		);
	}

	function cancelInlineEdit() {
		if (isInlineDirty()) {
			alertConfirm = {
				open: true,
				title: 'Buang Perubahan Catatan?',
				description:
					'Ada perubahan catatan yang belum disimpan. Yakin ingin menutup editor dan membuang perubahan?',
				variant: 'destructive',
				confirmLabel: 'Buang Perubahan',
				onConfirm: () => {
					alertConfirm.open = false;
					discardInlineDraft();
					inlineTitle = currentDoc?.title || data.article?.title || '';
					inlineContent = currentDoc?.content || data.article?.content || '';
					inlineBuilderContent = currentDoc?.builderContent || data.article?.builderContent || '';
					inlineSacUrl = currentDoc?.sacUrl || data.article?.sacUrl || '';
					isInlineEditing = false;
					inlineReadyForAutoSave = false;
				}
			};
			return;
		}
		isInlineEditing = false;
		inlineReadyForAutoSave = false;
	}

	function restoreInlineDraft() {
		if (!inlineAvailableDraft) return;
		inlineTitle = inlineAvailableDraft.title || inlineTitle;
		inlineContent = inlineAvailableDraft.content ?? inlineContent;
		if (inlineAvailableDraft.builderContent !== undefined) {
			inlineBuilderContent = inlineAvailableDraft.builderContent;
		}
		if (inlineAvailableDraft.sacUrl !== undefined) {
			inlineSacUrl = inlineAvailableDraft.sacUrl;
		}
		inlineStatusMsg = `Draft dari pukul ${inlineAvailableDraft.savedAt} berhasil dipulihkan`;
		inlineAvailableDraft = null;
	}

	function discardInlineDraft() {
		inlineAvailableDraft = null;
		if (typeof window !== 'undefined') {
			try {
				localStorage.removeItem(inlineDraftKey);
			} catch (_) {}
		}
	}

	function undoInlineAiChanges() {
		if (!inlineAiUndoContent) return;
		if (inlineAiUndoContent.target === 'builder') {
			inlineBuilderContent = inlineAiUndoContent.content;
		} else {
			inlineContent = inlineAiUndoContent.content;
		}
		inlineAiUndoContent = null;
		inlineStatusMsg = 'Perubahan AI berhasil diurungkan (dikembalikan ke teks sebelumnya)';
	}

	function startInlineEdit(docToEdit?: any) {
		const d = docToEdit || currentDoc;
		const docIsSac =
			(d?.section || currentDoc?.section || data.article?.section || '').toUpperCase() === 'SAC' ||
			(d?.slug || data.slug || '').toLowerCase().startsWith('sac/');
		inlineReadyForAutoSave = false;
		inlineTitle = d?.title || '';
		inlineContent = d?.content || '';
		inlineBuilderContent = d?.builderContent || '';
		inlineSacUrl = d?.sacUrl || '';
		inlineEditTarget = docIsSac && activeDocTab === 'builder' ? 'builder' : 'fsd';
		inlineStatusMsg = '';
		inlineErrorMsg = '';
		inlineAiUndoContent = null;
		inlineLastAutoSavedAt = '';
		inlineAvailableDraft = null;
		showCustomAiPrompt = false;
		customAiPrompt = '';
		isInlineEditing = true;

		if (typeof window !== 'undefined') {
			try {
				const slugKey = `portal_inline_draft_${d?.slug || data.slug}`;
				const rawDraft = localStorage.getItem(slugKey);
				if (rawDraft) {
					const parsed = JSON.parse(rawDraft);
					const hasDiff =
						parsed &&
						((parsed.content !== undefined && parsed.content.trim() !== (d?.content || '').trim()) ||
							(parsed.builderContent !== undefined &&
								parsed.builderContent.trim() !== (d?.builderContent || '').trim()));
					if (hasDiff) {
						inlineAvailableDraft = parsed;
					}
				}
			} catch (_) {}
		}

		setTimeout(() => {
			inlineReadyForAutoSave = true;
			const textarea = document.getElementById('inline-note-textarea') as HTMLTextAreaElement | null;
			textarea?.focus();
		}, 120);
	}

	async function saveInlineNote(closeAfterSave = true) {
		const targetBody = isSacDoc && inlineEditTarget === 'builder' ? inlineBuilderContent : inlineContent;
		const existingTitle = (inlineTitle || currentDoc?.title || data.article.title || '').trim();
		const isGenericTitle = !existingTitle || ['Catatan', 'Catatan Baru', 'Untitled Note', 'Dokumen Baru'].includes(existingTitle);
		const derivedTitle = isGenericTitle
			? extractTitleFromMarkdown(targetBody, existingTitle || 'Catatan')
			: existingTitle;
		inlineTitle = derivedTitle;
		isSavingInline = true;
		inlineErrorMsg = '';
		inlineStatusMsg = '';

		try {
			const slug = currentDoc?.slug || data.slug;
			const res = await fetch(`/api/docs/${slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: derivedTitle,
					content: inlineContent,
					builderContent: inlineBuilderContent,
					sacUrl: inlineSacUrl.trim() || undefined,
					section: currentDoc?.section || data.article.section,
					category: currentDoc?.category || data.article.category,
					subcategory: currentDoc?.subcategory || data.article.subcategory
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan catatan');

			editorDoc = json.document;
			if (json.document) {
				updateDocCache(json.document);
			}
			if (data.doc) {
				data.doc.content = json.document.content;
				data.doc.title = json.document.title;
				data.doc.category = json.document.category;
				data.doc.subcategory = json.document.subcategory;
				data.doc.builderContent = json.document.builderContent;
				data.doc.sacUrl = json.document.sacUrl;
			}
			if (data.article) {
				data.article.title = json.document.title;
				data.article.category = json.document.category;
				data.article.subcategory = json.document.subcategory;
			}

			if (typeof window !== 'undefined') {
				try {
					localStorage.removeItem(inlineDraftKey);
				} catch (_) {}
			}
			inlineAvailableDraft = null;
			inlineLastAutoSavedAt = '';

			fetch('/api/docs')
				.then((r) => r.json())
				.then((d) => {
					if (d.treeData) {
						customTree = d.treeData;
						updateTreeCache(d.treeData, d.sectionTree, d.sectionStats);
					}
				})
				.catch(() => {});

			if (closeAfterSave) {
				isInlineEditing = false;
				inlineReadyForAutoSave = false;
			} else {
				inlineStatusMsg = `✓ Tersimpan (${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`;
			}
		} catch (err: any) {
			inlineErrorMsg = err.message || 'Gagal menyimpan catatan';
		} finally {
			isSavingInline = false;
		}
	}

	function insertInlineSnippet(before: string, after: string = '', defaultPlaceholder: string = '') {
		const textarea = document.getElementById('inline-note-textarea') as HTMLTextAreaElement | null;
		const currentBody = activeInlineBody;
		const start = textarea ? textarea.selectionStart : currentBody.length;
		const end = textarea ? textarea.selectionEnd : currentBody.length;
		const selected = textarea ? currentBody.substring(start, end) : '';
		const contentToWrap = selected || defaultPlaceholder;
		const replacement = before + contentToWrap + after;

		setActiveInlineBody(currentBody.substring(0, start) + replacement + currentBody.substring(end));
		if (textarea) {
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + before.length, start + before.length + contentToWrap.length);
			}, 10);
		}
	}

	async function runInlineAiFormat() {
		if (!activeInlineBody.trim()) {
			inlineErrorMsg = 'Catatan masih kosong untuk dirapikan';
			return;
		}

		isInlineAiLoading = true;
		inlineAiActionType = 'format';
		inlineErrorMsg = '';
		inlineStatusMsg = '';
		const previousBody = activeInlineBody;
		const currentTarget = inlineEditTarget;

		try {
			const sec = currentDoc?.section || data.article?.section || 'SAP';
			const cat = currentDoc?.category || data.article?.category || 'General';
			const derivedTitle = extractTitleFromMarkdown(previousBody, inlineTitle.trim() || currentDoc?.title || 'Dokumentasi');

			const res = await fetch('/api/ai/doc-assist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'format',
					prompt: 'Rapikan format catatan mentah ini menjadi Markdown yang rapi dan terstruktur tanpa mengubah isi fakta',
					section: sec,
					currentDoc: {
						title: derivedTitle,
						section: sec,
						category: cat,
						content: previousBody
					}
				})
			});
			const d = await res.json();
			if (!res.ok || !d.success) throw new Error(d.error || 'Gagal memproses AI');

			inlineAiUndoContent = { target: currentTarget, content: previousBody };
			const aiText = typeof d.result === 'string' ? d.result : d.result?.content || previousBody;
			setActiveInlineBody(aiText);
			inlineStatusMsg = '✓ Catatan berhasil dirapikan ke format Markdown';
		} catch (err: any) {
			inlineErrorMsg = err.message || 'Gagal merapikan catatan';
		} finally {
			isInlineAiLoading = false;
			inlineAiActionType = null;
		}
	}

	async function runInlineCustomAi() {
		const instruction = customAiPrompt.trim();
		if (!instruction) {
			inlineErrorMsg = 'Silakan masukkan instruksi untuk AI terlebih dahulu';
			return;
		}

		isInlineAiLoading = true;
		inlineAiActionType = 'custom';
		inlineErrorMsg = '';
		inlineStatusMsg = '';
		const previousBody = activeInlineBody;
		const currentTarget = inlineEditTarget;

		try {
			const sec = currentDoc?.section || data.article?.section || 'SAP';
			const cat = currentDoc?.category || data.article?.category || 'General';
			const derivedTitle = extractTitleFromMarkdown(previousBody, inlineTitle.trim() || currentDoc?.title || 'Dokumentasi');

			const res = await fetch('/api/ai/doc-assist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'custom',
					prompt: instruction,
					section: sec,
					currentDoc: {
						title: derivedTitle,
						section: sec,
						category: cat,
						content: previousBody
					}
				})
			});
			const d = await res.json();
			if (!res.ok || !d.success) throw new Error(d.error || 'Gagal memproses AI');

			inlineAiUndoContent = { target: currentTarget, content: previousBody };
			const aiText = typeof d.result === 'string' ? d.result : d.result?.content || previousBody;
			setActiveInlineBody(aiText);
			inlineStatusMsg = '✓ Modifikasi AI berhasil diterapkan';
			showCustomAiPrompt = false;
			customAiPrompt = '';
		} catch (err: any) {
			inlineErrorMsg = err.message || 'Gagal menjalankan instruksi AI';
		} finally {
			isInlineAiLoading = false;
			inlineAiActionType = null;
		}
	}

	async function uploadInlineImage(file: File) {
		isUploadingInlineImage = true;
		const cleanFileName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'gambar';
		const placeholder = `\n![Mengunggah ${cleanFileName}...]()\n`;
		insertInlineSnippet(placeholder, '', '');

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

			setActiveInlineBody(
				activeInlineBody.replace(placeholder.trim(), `![${cleanFileName}](${json.url})`)
			);
			inlineStatusMsg = '✓ Gambar berhasil disisipkan & dipratinjau';
		} catch (err: any) {
			setActiveInlineBody(activeInlineBody.replace(placeholder, ''));
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

	// Attached images for instant visual thumbnails in editor
	let insertedInlineImages = $derived.by(() => {
		const matches = [...(activeInlineBody || '').matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
		return matches.map((m) => ({ alt: m[1] || 'Gambar', url: m[2] }));
	});

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
			const cur = activeInlineBody.trim();
			setActiveInlineBody(cur ? `${cur}\n\n${text}` : text);
			inlineStatusMsg = `File "${file.name}" berhasil diimpor!`;
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

	// Outline & Markdown Rendering (reactively adapts to active tab: FSD vs Story Builder Spec for SAC only)
	const activeMarkdownContent = $derived(
		isSacDoc && activeDocTab === 'builder' && currentDoc?.builderContent
			? currentDoc.builderContent
			: currentDoc?.content || ''
	);
	const outlineTree = $derived(extractOutlineTree(activeMarkdownContent));
	const renderedHtml = $derived(renderMarkdown(activeMarkdownContent));

	let isManualOutlineScroll = false;
	let manualScrollTimer: ReturnType<typeof setTimeout> | null = null;

	function scrollToHeading(id: string) {
		if (!id) return;
		activeHeadingId = id;
		isManualOutlineScroll = true;
		if (manualScrollTimer) clearTimeout(manualScrollTimer);
		manualScrollTimer = setTimeout(() => {
			isManualOutlineScroll = false;
		}, 750);

		const el =
			document.getElementById(id) ||
			(Array.from(document.querySelectorAll('article h1, article h2, article h3, article h4')).find(
				(h) => slugifyHeading(h.textContent || '') === id
			) as HTMLElement | undefined);

		if (el) {
			const headerOffset = 88;
			const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset;
			window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });

			el.classList.remove('outline-anchor-target');
			void el.offsetWidth;
			el.classList.add('outline-anchor-target');
			setTimeout(() => el.classList.remove('outline-anchor-target'), 2000);
		}
	}

	// Scroll-spy for active heading
	$effect(() => {
		if (typeof window === 'undefined' || !renderedHtml) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (isManualOutlineScroll) return;
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target.id) {
						activeHeadingId = entry.target.id;
						break;
					}
				}
			},
			{ rootMargin: '-80px 0px -65% 0px', threshold: 0.1 }
		);

		const headings = document.querySelectorAll('article h1[id], article h2[id], article h3[id], article h4[id]');
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

	function copyRawMarkdown() {
		if (typeof window !== 'undefined' && currentDoc?.content) {
			navigator.clipboard.writeText(currentDoc.content);
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

	function isTypingInField(target: EventTarget | null): boolean {
		if (!target || !(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		return (
			tag === 'input' ||
			tag === 'textarea' ||
			tag === 'select' ||
			target.isContentEditable
		);
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const shortcutAction = params.get('shortcut');
			if (shortcutAction) {
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);
				setTimeout(() => {
					if (shortcutAction === 'edit') startInlineEdit(currentDoc);
					else if (shortcutAction === 'ai') askAiAboutDoc();
					else if (shortcutAction === 'new') openExplorerCreateFile(currentDoc);
					else if (shortcutAction === 'folder') openExplorerCreateFolder(currentDoc);
				}, 80);
			}

			window.addEventListener('click', closeContextMenu);
			const handleKey = (e: KeyboardEvent) => {
				const key = e.key.toLowerCase();
				const code = e.code;
				const hasCmdOrCtrl = e.ctrlKey || e.metaKey;
				const hasAlt = e.altKey;
				const typing = isTypingInField(e.target);

				if (e.key === 'Escape') {
					closeContextMenu();
					if (lightboxSrc) lightboxSrc = null;
					if (explorerCreator.open) explorerCreator.open = false;
					if (isDocAiOpen) isDocAiOpen = false;
					if (isInlineEditing && !typing) cancelInlineEdit();
					return;
				}

				// Ctrl+S: Save active inline note
				if (hasCmdOrCtrl && (key === 's' || code === 'KeyS') && isInlineEditing) {
					e.preventDefault();
					e.stopPropagation();
					saveInlineNote(false);
					return;
				}

				// Ctrl+E / Alt+E: Toggle Mode Edit ⟷ Mode Baca
				if ((hasCmdOrCtrl || hasAlt) && !e.shiftKey && (key === 'e' || code === 'KeyE')) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						if (isInlineEditing) {
							cancelInlineEdit();
						} else {
							startInlineEdit(currentDoc);
						}
					}
					return;
				}

				// Alt+N / Ctrl+M: Create New Note File (does not hijack browser Ctrl+N)
				if (
					(hasAlt && !e.shiftKey && (key === 'n' || code === 'KeyN')) ||
					(hasCmdOrCtrl && !e.shiftKey && (key === 'm' || code === 'KeyM'))
				) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						openExplorerCreateFile(currentDoc);
					}
					return;
				}

				// F2: Rename current file or folder
				if (e.key === 'F2') {
					if (!isInlineEditing && !isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						openRename(currentDoc);
					}
					return;
				}

				// Alt+Shift+F: Create New Folder (does not hijack browser Alt+F)
				if (hasAlt && e.shiftKey && (key === 'f' || code === 'KeyF')) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						openExplorerCreateFolder(currentDoc);
					}
					return;
				}

				// Ctrl+I / Alt+I: Open/Toggle Document AI Assistant Modal
				if ((hasCmdOrCtrl || hasAlt) && !e.shiftKey && (key === 'i' || code === 'KeyI')) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						if (isDocAiOpen) {
							isDocAiOpen = false;
						} else {
							askAiAboutDoc();
						}
					}
					return;
				}
			};
			window.addEventListener('keydown', handleKey, { capture: true });
			return () => {
				window.removeEventListener('click', closeContextMenu);
				window.removeEventListener('keydown', handleKey, { capture: true });
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
				if (json.treeData) {
					customTree = json.treeData;
					updateTreeCache(json.treeData);
				}
				if (json.document) {
					updateDocCache(json.document);
				}
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
			showCopyToast('✓ Tautan dokumen berhasil disalin');
		}
	}

	function handleContextMenuCopyMarkdown(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		if (t.content && typeof window !== 'undefined') {
			navigator.clipboard.writeText(t.content);
			showCopyToast('✓ Konten Markdown berhasil disalin');
		} else {
			copyRawMarkdown();
			showCopyToast('✓ Konten Markdown berhasil disalin');
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

	function handleContextMenuMoveUp(target: any) {
		closeContextMenu();
		if (!target) return;
		if (target.isFolder) {
			if (target.subcategory) {
				const parentGroup = currentTree.find((g: any) => g.title === target.category);
				if (parentGroup) moveSubfolderOrder(parentGroup, target, 'up');
			} else {
				moveFolderOrder(target, 'up');
			}
		}
	}

	function handleContextMenuMoveDown(target: any) {
		closeContextMenu();
		if (!target) return;
		if (target.isFolder) {
			if (target.subcategory) {
				const parentGroup = currentTree.find((g: any) => g.title === target.category);
				if (parentGroup) moveSubfolderOrder(parentGroup, target, 'down');
			} else {
				moveFolderOrder(target, 'down');
			}
		}
	}

	async function handleContextMenuDelete(target: any) {
		closeContextMenu();
		if (target?.isFolder) {
			if ((target.nodeCount || 0) > 0) {
				alertConfirm = {
					open: true,
					title: 'Folder Tidak Kosong',
					description:
						'Folder ini masih berisi file catatan. Hapus atau pindahkan file di dalamnya terlebih dahulu sebelum menghapus folder.',
					variant: 'default',
					confirmLabel: 'Mengerti',
					onConfirm: () => {
						alertConfirm.open = false;
					}
				};
				return;
			}
			const folderName = target.subcategory || target.category;
			alertConfirm = {
				open: true,
				title: 'Hapus Folder?',
				description: `Apakah Anda yakin ingin menghapus folder "${folderName}"? Tindakan ini bersifat permanen.`,
				variant: 'destructive',
				confirmLabel: 'Hapus Folder',
				onConfirm: async () => {
					alertConfirm.open = false;
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
						if (res.ok && d.treeData) {
							customTree = d.treeData;
							updateTreeCache(d.treeData);
						}
					} catch (_) {}
				}
			};
			return;
		}

		const docToDelete = target || currentDoc;
		const slug = docToDelete.slug || docToDelete.path || docToDelete.id;
		const title = docToDelete.title || 'dokumen ini';

		alertConfirm = {
			open: true,
			title: 'Hapus File Catatan?',
			description: `Apakah Anda yakin ingin menghapus file catatan "${title}"? Tindakan ini bersifat permanen.`,
			variant: 'destructive',
			confirmLabel: 'Hapus Catatan',
			onConfirm: async () => {
				alertConfirm.open = false;
				try {
					const res = await fetch(`/api/docs/${slug}`, { method: 'DELETE' });
					if (res.ok) {
						invalidateDocCache(slug);
						if (slug === data.slug) {
							goto('/docs/sap/overview');
						} else {
							fetch('/api/docs')
								.then((r) => r.json())
								.then((d) => {
									if (d.treeData) {
										customTree = d.treeData;
										updateTreeCache(d.treeData);
									}
								})
								.catch(() => {});
						}
					} else {
						inlineStatusMsg = 'Gagal menghapus dokumen';
					}
				} catch (err: any) {
					inlineStatusMsg = 'Terjadi kesalahan saat menghapus: ' + err.message;
				}
			}
		};
	}
</script>

<svelte:head>
	<title>{currentDoc?.title || data.article.title} - Portal Dokumentasi</title>
</svelte:head>

<div
	class={cn(
		"mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-200",
		(isInlineEditing || isFocusMode) ? "max-w-[1600px] w-full" : "max-w-7xl"
	)}
	oncontextmenu={(e) => openContextMenu(e, currentDoc)}
	role="region"
	aria-label="Dokumentasi Workspace"
>
	<!-- ======================================================== -->
	<!-- CLEAN WORKSPACE: SIDEBAR EXPLORER + NOTE CANVAS + OUTLINE -->
	<!-- ======================================================== -->
	<div class="flex flex-col lg:flex-row gap-6 lg:gap-10 py-6 lg:py-8">
		<!-- LEFT SIDEBAR: MINIMAL FILE EXPLORER (Desktop + Mobile Collapsible Drawer) -->
		{#if !isFocusMode}
			<aside
				class="{isMobileExplorerOpen
					? 'block rounded-xl border border-border bg-card p-4 shadow-sm lg:rounded-none lg:border-0 lg:border-r lg:bg-transparent lg:p-0 lg:shadow-none'
					: 'hidden'} lg:block lg:w-64 shrink-0 lg:border-r border-border/60 lg:pr-5"
			>
				<div
					class="lg:sticky lg:top-20 space-y-3"
					oncontextmenu={(e) => openContextMenu(e, null)}
					role="region"
					aria-label="File Explorer"
				>
					<!-- Pillar / Module Switcher (SAP, SAC, WEB, Semua) -->
					<div class="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Filter modul dokumentasi">
						{#each (['ALL', 'SAP', 'SAC', 'WEB'] as const) as secTab}
							<button
								type="button"
								role="tab"
								aria-selected={activeSection === secTab}
								onclick={() => (activeSection = secTab)}
								class="rounded-md px-2 py-1 text-[11px] font-semibold transition-colors {activeSection === secTab
									? 'bg-background text-foreground shadow-2xs'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								{secTab === 'ALL' ? 'Semua' : secTab}
							</button>
						{/each}
					</div>

					<!-- Explorer Top Header: Section Title (Clean & Uniform) -->
					<div class="flex items-center justify-between pb-1">
						<span class="text-xs font-semibold text-foreground">
							Folder {activeSection === 'ALL' ? 'Semua Modul' : activeSection}
						</span>
					</div>

					<!-- Inline Create File / Folder Box (Shadcn Card) -->
					{#if explorerCreator.open}
						<Card class="p-2.5 shadow-xs">
							<form onsubmit={submitExplorerCreator} class="space-y-2">
								<div class="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
									<span class="truncate">
										{explorerCreator.type === 'folder'
											? explorerCreator.isRootFolder
												? `Folder baru di ${explorerCreator.section}`
												: `Sub-folder di ${explorerCreator.category}`
											: `File baru di ${explorerCreator.subcategory || explorerCreator.category}`}
									</span>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onclick={() => (explorerCreator.open = false)}
										class="h-5 w-5"
									>
										<X class="h-3 w-3" />
									</Button>
								</div>

								<div class="flex items-center gap-1.5">
									<Input
										id="explorer-creator-input"
										type="text"
										bind:value={explorerCreator.name}
										placeholder={explorerCreator.type === 'folder'
											? 'Nama folder...'
											: 'Nama file catatan...'}
										class="h-7 text-xs flex-1"
									/>
									<Button
										type="submit"
										size="sm"
										disabled={explorerCreator.isSubmitting || !explorerCreator.name.trim()}
										class="h-7 px-2.5 text-xs"
									>
										Buat
									</Button>
								</div>

								{#if explorerCreator.error}
									<p class="text-[10px] text-destructive">{explorerCreator.error}</p>
								{/if}
							</form>
						</Card>
					{/if}

					<!-- Quiet Filter Input -->
					<div class="relative">
						<Search class="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
						<Input
							type="text"
							bind:value={sidebarFilter}
							onkeydown={(e) => {
								if (e.key === 'Escape') sidebarFilter = '';
							}}
							placeholder="Cari catatan..."
							class="h-7 pl-8 pr-6 text-xs"
						/>
						{#if sidebarFilter}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onclick={() => (sidebarFilter = '')}
								class="absolute right-1 top-1 h-5 w-5 text-muted-foreground hover:text-foreground"
							>
								<X class="h-3 w-3" />
							</Button>
						{/if}
					</div>

					<!-- Clean Folder & File Tree (Uniform Shadcn Styling & Lucide Icons) -->
					<nav class="space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
						{#each filteredTree as group}
							{@const expanded = isCategoryExpanded(group)}
							<div
								class="group/folder transition-all rounded-md {dragOverFolderCategory === group.title ? 'border-t-2 border-primary bg-primary/5' : ''}"
								draggable="true"
								ondragstart={(e) => handleFolderDragStart(e, group)}
								ondragover={(e) => handleFolderDragOver(e, group)}
								ondragleave={() => (dragOverFolderCategory = null)}
								ondrop={(e) => handleFolderDrop(e, group)}
								oncontextmenu={(e) =>
									openContextMenu(e, {
										isFolder: true,
										nodeCount: group.nodes.length,
										section: group.section,
										category: group.title,
										title: group.title
									})}
								role="group"
							>
								<div class="flex items-center justify-between rounded-md pr-1 hover:bg-accent/60 transition-colors">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => toggleCategory(group.title, group)}
										class="h-7 flex-1 justify-start gap-1.5 px-2 text-xs font-medium text-foreground truncate"
									>
										<ChevronDown
											class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0 {expanded
												? 'rotate-0'
												: '-rotate-90'}"
										/>
										{#if expanded}
											<FolderOpen class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
										{:else}
											<Folder class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
										{/if}
										<span class="truncate">{group.title}</span>
									</Button>

									<div class="flex items-center gap-0.5">
										<!-- Reorder & Rename buttons on hover -->
										<div class="hidden group-hover/folder:flex items-center gap-0.5 mr-0.5">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												title="Pindahkan urutan folder ke atas"
												onclick={(e) => {
													e.stopPropagation();
													moveFolderOrder(group, 'up');
												}}
												class="h-5 w-5 text-muted-foreground hover:text-foreground"
											>
												<ChevronUp class="h-3 w-3" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												title="Pindahkan urutan folder ke bawah"
												onclick={(e) => {
													e.stopPropagation();
													moveFolderOrder(group, 'down');
												}}
												class="h-5 w-5 text-muted-foreground hover:text-foreground"
											>
												<ChevronDown class="h-3 w-3" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												title="Ubah nama folder (Rename)"
												onclick={(e) => {
													e.stopPropagation();
													openRename({
														isFolder: true,
														section: group.section,
														category: group.title,
														title: group.title
													});
												}}
												class="h-5 w-5 text-muted-foreground hover:text-foreground"
											>
												<PenLine class="h-3 w-3" />
											</Button>
										</div>

										<span class="text-[10px] text-muted-foreground/60 font-mono pr-2 shrink-0">
											{(group.directNodes ? group.directNodes.length : (group.nodes?.length ?? 0)) + (group.subcategories?.length ?? 0)}
										</span>
									</div>
								</div>

								{#if expanded}
									<div class="space-y-0.5 pl-3 ml-2.5 border-l border-border/60 my-0.5">
										<!-- Sub-Folders -->
										{#each group.subcategories || [] as subGroup}
											{@const subExpanded = isSubcategoryExpanded(group.title, subGroup)}
											<div
												oncontextmenu={(e) =>
													openContextMenu(e, {
														isFolder: true,
														nodeCount: subGroup.nodes.length,
														section: group.section,
														category: group.title,
														subcategory: subGroup.title,
														title: `${group.title} / ${subGroup.title}`
													})}
												role="group"
											>
												<div class="group/sub flex items-center justify-between rounded-md pr-1 hover:bg-accent/50">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onclick={() => toggleSubcategory(group.title, subGroup)}
														class="h-7 flex-1 justify-start gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground truncate"
													>
														<ChevronDown
															class="h-3 w-3 transition-transform duration-150 shrink-0 {subExpanded
																? 'rotate-0'
																: '-rotate-90'}"
														/>
														<Folder class="h-3 w-3 text-muted-foreground shrink-0" />
														<span class="truncate">{subGroup.title}</span>
													</Button>
													<div class="flex items-center gap-0.5">
														<div class="hidden group-hover/sub:flex items-center gap-0.5 mr-0.5">
															<Button
																type="button"
																variant="ghost"
																size="icon"
																title="Pindahkan sub-folder ke atas"
																onclick={(e) => {
																	e.stopPropagation();
																	moveSubfolderOrder(group, subGroup, 'up');
																}}
																class="h-5 w-5 text-muted-foreground hover:text-foreground"
															>
																<ChevronUp class="h-3 w-3" />
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																title="Pindahkan sub-folder ke bawah"
																onclick={(e) => {
																	e.stopPropagation();
																	moveSubfolderOrder(group, subGroup, 'down');
																}}
																class="h-5 w-5 text-muted-foreground hover:text-foreground"
															>
																<ChevronDown class="h-3 w-3" />
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																title="Ubah nama sub-folder (Rename)"
																onclick={(e) => {
																	e.stopPropagation();
																	openRename({
																		isFolder: true,
																		section: group.section,
																		category: group.title,
																		subcategory: subGroup.title,
																		title: `${group.title} / ${subGroup.title}`
																	});
																}}
																class="h-5 w-5 text-muted-foreground hover:text-foreground"
															>
																<PenLine class="h-3 w-3" />
															</Button>
														</div>
														<span class="text-[10px] text-muted-foreground/60 font-mono pr-2 shrink-0">
															{subGroup.nodes.length}
														</span>
													</div>
												</div>

												{#if subExpanded}
													<div class="space-y-0.5 pl-3 ml-2 border-l border-border/50 py-0.5">
														{#each subGroup.nodes as node}
															{@const isCurrent = node.path === data.slug || node.slug === data.slug}
															<div class="group/file flex items-center justify-between rounded-md pr-1 transition-colors {isCurrent
																? 'bg-secondary font-semibold text-secondary-foreground'
																: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}">
																<a
																	href="/docs/{node.path}"
																	oncontextmenu={(e) => openContextMenu(e, node)}
																	class="flex items-center gap-2 flex-1 px-2 py-1 text-xs truncate min-w-0"
																>
																	<FileText class="h-3 w-3 opacity-60 shrink-0" />
																	<span class="truncate">{node.title}</span>
																</a>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	title="Ubah nama file (Rename)"
																	onclick={(e) => {
																		e.stopPropagation();
																		openRename(node);
																	}}
																	class="hidden group-hover/file:flex h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
																>
																	<PenLine class="h-3 w-3" />
																</Button>
															</div>
														{/each}
														{#if subGroup.nodes.length === 0}
															<div class="px-2 py-1 text-[11px] text-muted-foreground/60 italic">
																(Kosong)
															</div>
														{/if}
													</div>
												{/if}
											</div>
										{/each}

										<!-- Direct Files in Folder -->
										{#each group.directNodes || group.nodes as node}
											{@const isCurrent = node.path === data.slug || node.slug === data.slug}
											<div class="group/file flex items-center justify-between rounded-md pr-1 transition-colors {isCurrent
												? 'bg-secondary font-semibold text-secondary-foreground'
												: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}">
												<a
													href="/docs/{node.path}"
													oncontextmenu={(e) => openContextMenu(e, node)}
													class="flex items-center gap-2 flex-1 px-2 py-1.5 text-xs truncate min-w-0"
												>
													<FileText class="h-3.5 w-3.5 opacity-60 shrink-0" />
													<span class="truncate">{node.title}</span>
												</a>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													title="Ubah nama file (Rename)"
													onclick={(e) => {
														e.stopPropagation();
														openRename(node);
													}}
													class="hidden group-hover/file:flex h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
												>
													<PenLine class="h-3 w-3" />
												</Button>
											</div>
										{/each}

										{#if (group.directNodes || group.nodes).length === 0 && (group.subcategories || []).length === 0}
											<div class="px-2 py-1 text-[11px] text-muted-foreground/60 italic">
												(Kosong)
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</nav>
				</div>
			</aside>
		{/if}

		<!-- CENTER AREA: CLEAN NOTE CANVAS (READING OR WRITING) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class={cn(
				"min-w-0 flex-1 transition-all duration-200",
				isInlineEditing ? "max-w-none w-full" : "max-w-3xl"
			)}
			oncontextmenu={(e) => openContextMenu(e, currentDoc)}
			onclick={handleArticleClick}
			ondblclick={handleArticleDblClick}
			role="article"
		>
			<!-- Single Quiet Top Bar: Folder Path on Left, Clean Shadcn Buttons on Right -->
			<div class="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
				<div class="flex items-center gap-1.5 truncate">
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-expanded={isMobileExplorerOpen}
						onclick={() => (isMobileExplorerOpen = !isMobileExplorerOpen)}
						class="lg:hidden h-7 gap-1.5 px-2 text-xs mr-1"
					>
						<Folder class="h-3.5 w-3.5" />
						<span>{isMobileExplorerOpen ? 'Tutup Explorer' : 'Explorer'}</span>
					</Button>
					<Folder class="hidden lg:inline-block h-3.5 w-3.5 shrink-0" />
					<span>{currentDoc?.section || data.article.section || 'SAP'}</span>
					<span>/</span>
					<span class="truncate">{currentDoc?.category || data.article.category}</span>
					{#if currentDoc?.subcategory || data.article?.subcategory}
						<span>/</span>
						<span class="truncate text-foreground font-medium">
							{currentDoc?.subcategory || data.article?.subcategory}
						</span>
					{/if}
					{#if inlineStatusMsg}
						<Badge variant="secondary" class="ml-2 text-[10px]">{inlineStatusMsg}</Badge>
					{/if}
					{#if copyToastMsg}
						<Badge variant="secondary" class="ml-2 text-[10px] animate-in fade-in">{copyToastMsg}</Badge>
					{/if}
				</div>

				<div class="flex items-center gap-1.5 shrink-0">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						title={isFocusMode ? 'Tampilkan kembali panel samping' : 'Sembunyikan panel samping untuk fokus membaca'}
						onclick={() => (isFocusMode = !isFocusMode)}
						class="hidden lg:inline-flex h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
					>
						{#if isFocusMode}
							<Minimize2 class="size-3.5" />
							<span>Tampilkan Panel</span>
						{:else}
							<Maximize2 class="size-3.5" />
							<span>Mode Fokus</span>
						{/if}
					</Button>
					{#if isSacDoc && currentDoc?.sacUrl}
						<Button
							href={currentDoc.sacUrl}
							target="_blank"
							rel="noopener noreferrer"
							variant="outline"
							size="sm"
							class="h-8 gap-1.5 px-2.5 text-xs"
						>
							<ExternalLink class="size-3.5" />
							<span>Story SAC</span>
						</Button>
					{/if}

					{#if isInlineEditing}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={cancelInlineEdit}
							class="h-8 gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
							title="Beralih ke tampilan membaca layar penuh (Ctrl+E)"
						>
							<Eye class="size-3.5" />
							<span class="hidden sm:inline">Mode Baca</span>
						</Button>
						<Button
							type="button"
							variant="default"
							size="sm"
							disabled={isSavingInline}
							onclick={() => saveInlineNote(true)}
							class="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs"
							title="Simpan perubahan dokumen (Ctrl+S)"
						>
							{#if isSavingInline}
								<Loader2 class="size-3.5 animate-spin" />
								<span>Menyimpan...</span>
							{:else}
								<Save class="size-3.5" />
								<span>Simpan</span>
							{/if}
						</Button>
					{:else}
						<Button
							type="button"
							variant="default"
							size="sm"
							onclick={() => startInlineEdit(currentDoc)}
							class="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs"
							title="Beralih ke mode editor dokumen (Ctrl+E)"
						>
							<Edit3 class="size-3.5" />
							<span>Edit Dokumen</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={askAiAboutDoc}
							class="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
							title="Tanya AI Copilot khusus dokumen ini (Ctrl+I)"
						>
							<Sparkles class="size-3.5 text-primary" />
							<span class="hidden sm:inline">AI Dokumen</span>
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							title="Salin isi Markdown"
							onclick={() => handleContextMenuCopyMarkdown(currentDoc)}
							class="size-8 p-0 text-muted-foreground hover:text-foreground"
						>
							<Copy class="size-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							title="Opsi dokumen lengkap (Klik Kanan)"
							onclick={(e) => openContextMenu(e, currentDoc)}
							class="size-8 p-0 text-muted-foreground hover:text-foreground"
						>
							<MoreHorizontal class="size-4" />
						</Button>
					{/if}
				</div>
			</div>

			{#if isInlineEditing}
				<!-- ============================================================ -->
				<!-- CLEAN OBSIDIAN NOTE EDITOR (100% Shadcn Components)          -->
				<!-- ============================================================ -->
				<div class="space-y-3 animate-in fade-in duration-100">
					{#if inlineAvailableDraft}
						<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-foreground">
							<span>
								Ditemukan <strong>draft otomatis yang belum disimpan</strong> dari pukul {inlineAvailableDraft.savedAt}.
							</span>
							<div class="flex items-center gap-1.5">
								<Button
									type="button"
									size="sm"
									onclick={restoreInlineDraft}
									class="h-7 px-2.5 text-xs"
								>
									Pulihkan Draft
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onclick={discardInlineDraft}
									class="h-7 px-2 text-xs"
								>
									Abaikan
								</Button>
							</div>
						</div>
					{/if}

					{#if isSacDoc}
						<div class="flex items-center gap-2">
							<Input
								type="url"
								aria-label="URL Story SAC"
								bind:value={inlineSacUrl}
								placeholder="URL Story SAC (opsional)..."
								class="h-8 text-xs max-w-sm"
							/>
						</div>

						<!-- Spec Target Switcher (FSD vs Story Builder Spec) & Status Bar - SAC only -->
						<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
							<div class="flex items-center gap-2">
								<span class="text-muted-foreground font-medium">Bagian Dokumen:</span>
								<Tabs bind:value={inlineEditTarget} class="w-auto">
									<TabsList class="h-7 p-0.5">
										<TabsTrigger value="fsd" class="px-2.5 py-0.5 text-xs">
											Dokumen Utama (FSD)
										</TabsTrigger>
										<TabsTrigger value="builder" class="px-2.5 py-0.5 text-xs">
											Story Builder Spec
										</TabsTrigger>
									</TabsList>
								</Tabs>
							</div>

							<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								{#if inlineStatusMsg}
									<span class="font-medium text-foreground">{inlineStatusMsg}</span>
								{/if}
								{#if inlineLastAutoSavedAt}
									<span class="text-[11px]">Draft tersimpan {inlineLastAutoSavedAt}</span>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Status Bar for Non-SAC (Clean & simple, zero FSD/Builder clutter) -->
						{#if inlineStatusMsg || inlineLastAutoSavedAt}
							<div class="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
								{#if inlineStatusMsg}
									<span class="font-medium text-foreground">{inlineStatusMsg}</span>
								{/if}
								{#if inlineLastAutoSavedAt}
									<span class="text-[11px]">Draft tersimpan {inlineLastAutoSavedAt}</span>
								{/if}
							</div>
						{/if}
					{/if}

					{#if inlineErrorMsg}
						<div role="alert" class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{inlineErrorMsg}
						</div>
					{/if}

					<!-- Formatting Toolbar: Sleek Semantic Grouping & Pixel-Perfect Alignment -->
					<div class="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-border/80 bg-card p-1.5 shadow-2xs">
						<div class="flex flex-wrap items-center gap-1.5">
							<!-- Group 1: Text Formatting -->
							<div class="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-2xs">
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('## ', '', 'Heading 2')} class="size-7 p-0 rounded-md" title="Heading 2">
									<Heading2 class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('### ', '', 'Heading 3')} class="size-7 p-0 rounded-md" title="Heading 3">
									<Heading3 class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('**', '**', 'teks tebal')} class="size-7 p-0 rounded-md" title="Tebal (Bold)">
									<Bold class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('*', '*', 'teks miring')} class="size-7 p-0 rounded-md" title="Miring (Italic)">
									<Italic class="size-3.5" />
								</Button>
							</div>

							<!-- Group 2: Insert Elements -->
							<div class="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-2xs">
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('- ', '', 'poin')} class="size-7 p-0 rounded-md" title="Daftar Poin">
									<List class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('- [ ] ', '', 'tugas')} class="size-7 p-0 rounded-md" title="Daftar Checklist">
									<CheckSquare class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('```typescript\n', '\n```', '// kode di sini')} class="size-7 p-0 rounded-md" title="Blok Kode">
									<Code class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertInlineSnippet('| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Baris 1 | Baris 2 |')} class="size-7 p-0 rounded-md" title="Tabel">
									<Table class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => inlineImageInputRef?.click()} class="size-7 p-0 rounded-md" title="Sisipkan Gambar (atau tekan Ctrl+V)">
									<ImageIcon class="size-3.5" />
								</Button>
							</div>

							<!-- Group 3: AI Actions -->
							<div class="flex items-center gap-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isInlineAiLoading || !activeInlineBody.trim()}
									onclick={runInlineAiFormat}
									class="h-7 gap-1.5 px-2.5 text-xs font-medium"
									title="Rapikan catatan mentah menjadi Markdown yang rapi dan terstruktur secara otomatis"
								>
									{#if isInlineAiLoading && inlineAiActionType === 'format'}
										<Loader2 class="size-3.5 animate-spin" />
										<span>Merapikan...</span>
									{:else}
										<Sparkles class="size-3.5 text-primary" />
										<span>Rapikan</span>
									{/if}
								</Button>
								<Button
									type="button"
									variant={showCustomAiPrompt ? 'secondary' : 'outline'}
									size="sm"
									disabled={isInlineAiLoading}
									onclick={() => (showCustomAiPrompt = !showCustomAiPrompt)}
									class="h-7 gap-1.5 px-2.5 text-xs font-medium"
									title="Beri instruksi manual untuk memodifikasi atau menambah isi dokumen"
								>
									<Wand2 class="size-3.5 text-primary" />
									<span>Instruksi AI</span>
								</Button>
								{#if inlineAiUndoContent !== null}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={undoInlineAiChanges}
										class="h-7 gap-1 px-2 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
										title="Batalkan perubahan AI terakhir"
									>
										<RotateCcw class="size-3" />
										<span>Undo</span>
									</Button>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-2">
							<!-- Group 4: Segmented Editor Layout Switcher -->
							<div class="flex items-center rounded-lg border border-border/70 bg-muted/50 p-0.5">
								<button
									type="button"
									onclick={() => (editorLayout = 'full')}
									class={cn(
										"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
										editorLayout === 'full'
											? "bg-background text-foreground shadow-2xs"
											: "text-muted-foreground hover:text-foreground"
									)}
									title="Tulis Penuh: Area tulis 100% lebar layar, sangat lega dan leluasa"
								>
									<Maximize2 class="size-3" />
									<span class="hidden sm:inline">Tulis Penuh</span>
									<span class="sm:hidden">Penuh</span>
								</button>
								<button
									type="button"
									onclick={() => (editorLayout = 'split')}
									class={cn(
										"flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
										editorLayout === 'split'
											? "bg-background text-foreground shadow-2xs"
											: "text-muted-foreground hover:text-foreground"
									)}
									title="Split View: Tampilkan pratinjau langsung di samping kanan (50:50)"
								>
									<Columns2 class="size-3" />
									<span class="hidden sm:inline">Split Pratinjau</span>
									<span class="sm:hidden">Split</span>
								</button>
							</div>

							<div class="hidden md:flex items-center gap-1.5 pr-1 text-[10px] text-muted-foreground">
								<span>{inlineWordCount} kata</span>
								<span>•</span>
								<span>Tempel screenshot (Ctrl+V) langsung</span>
							</div>
						</div>
					</div>

					<!-- Single-line Manual AI Instruction Bar (Compact & Minimalist) -->
					{#if showCustomAiPrompt}
						<div class="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-1.5 shadow-2xs animate-in fade-in slide-in-from-top-1">
							<Wand2 class="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />
							<Input
								type="text"
								bind:value={customAiPrompt}
								placeholder="Ketik instruksi manual untuk AI (mis: Buat tabel, tambahkan kesimpulan, perbaiki penjelasan teknis...)"
								class="h-7 text-xs bg-background flex-1 border-primary/20 focus-visible:ring-primary/40"
								disabled={isInlineAiLoading}
								onkeydown={(e) => {
									if (e.key === 'Enter' && !isInlineAiLoading && customAiPrompt.trim()) {
										e.preventDefault();
										runInlineCustomAi();
									}
								}}
							/>
							<Button
								type="button"
								size="sm"
								disabled={isInlineAiLoading || !customAiPrompt.trim()}
								onclick={runInlineCustomAi}
								class="h-7 text-xs gap-1.5 px-3"
							>
								{#if isInlineAiLoading && inlineAiActionType === 'custom'}
									<Loader2 class="h-3 w-3 animate-spin" />
									<span>Memproses...</span>
								{:else}
									<span>Jalankan</span>
								{/if}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onclick={() => (showCustomAiPrompt = false)}
								class="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
								title="Tutup bar instruksi"
							>
								<X class="h-3.5 w-3.5" />
							</Button>
						</div>
					{/if}

					<!-- Attached Images Live Thumbnail Strip -->
					{#if insertedInlineImages.length > 0}
						<div class="flex items-center gap-2 overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-2 shadow-2xs">
							<span class="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider pl-1">
								Gambar Terlampir ({insertedInlineImages.length}):
							</span>
							<div class="flex items-center gap-2 overflow-x-auto py-0.5">
								{#each insertedInlineImages as img}
									<button
										type="button"
										onclick={() => {
											lightboxSrc = img.url;
											lightboxAlt = img.alt;
										}}
										class="group relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-background shadow-xs hover:ring-2 hover:ring-primary/60 transition-all cursor-zoom-in"
										title="Klik untuk zoom pratinjau {img.alt}"
									>
										<img src={img.url} alt={img.alt} class="h-full w-full object-cover" loading="lazy" />
										<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-medium transition-opacity">
											Zoom
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}

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

					<!-- Flexible Editor Canvas: Tulis Penuh (100%) vs Split View (50:50) -->
					{#if editorLayout === 'full'}
						<!-- Mode Tulis Penuh: 100% Lebar Layar, Sangat Lega & Leluasa -->
						<div class="relative">
							<Textarea
								id="inline-note-textarea"
								aria-label="Editor konten catatan"
								value={activeInlineBody}
								oninput={(e) => setActiveInlineBody(e.currentTarget.value)}
								onpaste={handleInlinePaste}
								ondrop={handleInlineDrop}
								ondragover={(e) => { e.preventDefault(); isDraggingInlineImage = true; }}
								ondragleave={() => (isDraggingInlineImage = false)}
								rows={26}
								placeholder={isSacDoc && inlineEditTarget === 'builder' ? 'Mulai tulis spesifikasi Story Builder di sini...' : 'Tulis dokumen Anda dengan Markdown di sini...'}
								class="min-h-[580px] w-full resize-y rounded-xl p-5 font-mono text-sm leading-relaxed border-border/80 bg-background shadow-xs focus-visible:ring-2 focus-visible:ring-primary/40"
							/>
							{#if isDraggingInlineImage}
								<div class="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-xs text-xs font-semibold text-primary">
									Lepaskan berkas gambar untuk mengunggah otomatis
								</div>
							{/if}
						</div>
					{:else}
						<!-- Mode Split View: Editor di Kiri, Live Preview di Kanan -->
						<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 relative">
							<div class="relative">
								<Textarea
									id="inline-note-textarea"
									aria-label="Editor konten catatan"
									value={activeInlineBody}
									oninput={(e) => setActiveInlineBody(e.currentTarget.value)}
									onpaste={handleInlinePaste}
									ondrop={handleInlineDrop}
									ondragover={(e) => { e.preventDefault(); isDraggingInlineImage = true; }}
									ondragleave={() => (isDraggingInlineImage = false)}
									rows={26}
									placeholder={isSacDoc && inlineEditTarget === 'builder' ? 'Mulai tulis spesifikasi Story Builder di sini...' : 'Tulis dokumen Anda dengan Markdown di sini...'}
									class="min-h-[580px] w-full resize-none rounded-xl p-5 font-mono text-sm leading-relaxed border-border/80 bg-background shadow-xs"
								/>
								{#if isDraggingInlineImage}
									<div class="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-xs text-xs font-semibold text-primary">
										Lepaskan berkas gambar untuk mengunggah otomatis
									</div>
								{/if}
							</div>

							<Card class="min-h-[580px] max-h-[580px] overflow-y-auto p-5 shadow-none border-border/80 bg-card/60">
								<div class="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-1 flex items-center justify-between">
									<span>Live Preview</span>
									<span class="text-[9px] font-normal lowercase text-muted-foreground/70">diperbarui langsung</span>
								</div>
								<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
									{@html debouncedInlinePreview}
								</div>
							</Card>
						</div>
					{/if}
				</div>
			{:else}
				<!-- ============================================================ -->
				<!-- CLEAN READING VIEW (Just Title + Content, Zero Visual Noise) -->
				<!-- ============================================================ -->
				<h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
					{currentDoc?.title || data.article.title}
				</h1>

				{#if isSacDoc && currentDoc?.builderContent}
					<div class="mb-6 flex items-center">
						<Tabs bind:value={activeDocTab} class="w-full sm:w-auto">
							<TabsList class="inline-flex h-9 w-full sm:w-auto items-center justify-start rounded-lg bg-muted/60 p-1 text-muted-foreground shadow-xs">
								<TabsTrigger
									value="fsd"
									class="inline-flex items-center gap-2 px-3.5 py-1 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs"
								>
									<FileText class="h-3.5 w-3.5" />
									<span>FSD</span>
								</TabsTrigger>
								<TabsTrigger
									value="builder"
									class="inline-flex items-center gap-2 px-3.5 py-1 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs"
								>
									<Table class="h-3.5 w-3.5" />
									<span>Builder</span>
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				{/if}

				{#if pinnedAiSummary && pinnedAiSummary.slug === data.slug}
					<Card class="mb-6 p-4 shadow-2xs">
						<div class="mb-2 flex items-center justify-between text-xs font-semibold text-foreground">
							<span class="flex items-center gap-1.5">
								<Sparkles class="h-3.5 w-3.5 text-muted-foreground" />
								<span>{pinnedAiSummary.title}</span>
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onclick={() => (pinnedAiSummary = null)}
								class="h-6 w-6"
							>
								<X class="h-3.5 w-3.5" />
							</Button>
						</div>
						<div class="prose prose-xs dark:prose-invert max-w-none leading-relaxed">
							{@html renderMarkdown(pinnedAiSummary.content)}
						</div>
					</Card>
				{/if}

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<article
					class="prose prose-zinc dark:prose-invert max-w-none leading-relaxed [&_img]:cursor-zoom-in [&_img]:rounded-xl [&_img]:border [&_img]:border-border [&_img]:shadow-xs"
					onclick={handleArticleClick}
					ondblclick={() => {
						if (!isInlineEditing) startInlineEdit(currentDoc);
					}}
					oncontextmenu={(e) => openContextMenu(e, currentDoc)}
				>
					{@html renderedHtml}
				</article>

				{#if data.prevArticle || data.nextArticle}
					<Separator class="my-10" />
					<div class="flex items-center justify-between gap-4">
						{#if data.prevArticle}
							<Button variant="ghost" size="sm" href="/docs/{data.prevArticle.path}" class="gap-1.5 text-xs">
								<ChevronLeft class="h-3.5 w-3.5" />
								<span>{data.prevArticle.title}</span>
							</Button>
						{:else}
							<div></div>
						{/if}

						{#if data.nextArticle}
							<Button variant="ghost" size="sm" href="/docs/{data.nextArticle.path}" class="gap-1.5 text-xs">
								<span>{data.nextArticle.title}</span>
								<ChevronRight class="h-3.5 w-3.5" />
							</Button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<!-- RIGHT SIDEBAR: MINIMAL OUTLINE -->
		{#if !isFocusMode && !isInlineEditing}
			<aside class="hidden xl:block w-52 shrink-0">
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
	onRename={openRename}
	onMoveUp={handleContextMenuMoveUp}
	onMoveDown={handleContextMenuMoveDown}
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

<!-- SHADCN ALERT DIALOG: Unified confirmation & warnings -->
<AlertDialog bind:open={alertConfirm.open}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>{alertConfirm.title}</AlertDialogTitle>
			<AlertDialogDescription>
				{alertConfirm.description}
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			{#if alertConfirm.confirmLabel !== 'Mengerti'}
				<AlertDialogCancel onclick={() => (alertConfirm.open = false)}>Batal</AlertDialogCancel>
			{/if}
			<AlertDialogAction
				variant={alertConfirm.variant || 'default'}
				onclick={alertConfirm.onConfirm}
			>
				{alertConfirm.confirmLabel || 'Lanjutkan'}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- SHADCN DIALOG: Rename File or Folder -->
<Dialog bind:open={renameDialog.open}>
	<DialogContent class="sm:max-w-md">
		<form onsubmit={submitRename} class="space-y-4">
			<DialogHeader>
				<DialogTitle>
					{renameDialog.type === 'folder'
						? (renameDialog.target?.subcategory ? 'Ubah Nama Sub-Folder' : 'Ubah Nama Folder')
						: 'Ubah Nama File Catatan'}
				</DialogTitle>
				<DialogDescription>
					{renameDialog.type === 'folder'
						? 'Masukkan nama baru untuk folder ini. Semua dokumen di dalamnya akan disinkronkan secara otomatis.'
						: 'Masukkan nama baru untuk file catatan ini.'}
				</DialogDescription>
			</DialogHeader>

			<div class="space-y-1.5 py-1">
				<Input
					id="rename-dialog-input"
					type="text"
					bind:value={renameDialog.name}
					placeholder={renameDialog.type === 'folder' ? 'Nama folder baru...' : 'Nama file catatan baru...'}
					class="h-9 text-sm"
				/>
				{#if renameDialog.error}
					<p class="text-xs text-destructive">{renameDialog.error}</p>
				{/if}
			</div>

			<DialogFooter>
				<Button
					type="button"
					variant="outline"
					onclick={() => (renameDialog.open = false)}
				>
					Batal
				</Button>
				<Button
					type="submit"
					disabled={renameDialog.isSubmitting || !renameDialog.name.trim()}
				>
					{renameDialog.isSubmitting ? 'Menyimpan...' : 'Simpan Nama Baru'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
