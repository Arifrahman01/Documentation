<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Label } from '$lib/components/ui/label';
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
	import { cn } from '$lib/utils.js';
	import DocsLightbox from '$lib/components/docs/DocsLightbox.svelte';
	import DocsRightOutline from '$lib/components/docs/DocsRightOutline.svelte';
	import DocsContextMenu from '$lib/components/docs/DocsContextMenu.svelte';
	import DocAiAssistantModal from '$lib/components/docs/DocAiAssistantModal.svelte';
	import { renderMarkdown, extractOutlineTree, extractTitleFromMarkdown } from '$lib/utils/markdown';
	import {
		BookUser,
		Folder,
		FolderOpen,
		FolderPlus,
		FolderInput,
		FilePlus,
		FileText,
		Sparkles,
		Wand2,
		Save,
		Edit3,
		Trash2,
		AlertCircle,
		Copy,
		CopyPlus,
		Check,
		Search,
		ChevronRight,
		ChevronDown,
		Plus,
		X,
		Bold,
		Italic,
		List,
		Heading2,
		Heading3,
		Code,
		Table,
		CheckSquare,
		Image as ImageIcon,
		Eye,
		Columns2,
		Loader2,
		RotateCcw,
		ArrowLeft,
		ArrowRight,
		Clock,
		Maximize2,
		Minimize2,
		Layers,
		MoreHorizontal,
		PenLine,
		RefreshCw
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local mutable document & tree state
	let editorDoc = $state<any>(null);
	let currentDoc = $derived(editorDoc ?? data.doc);
	let customTree = $state<any>(null);
	let treeData = $derived(customTree ?? data.treeData);

	// Editor state: Default to 'view' (Mode Baca) for a clean documentation reading experience
	let viewMode = $state<'view' | 'split'>('view');
	let editorLayout = $state<'full' | 'split'>('full');
	let isFocusMode = $state(false);
	let isMobileSidebarOpen = $state(false);
	let editorTitle = $state('');
	let editorCategory = $state('Catatan Harian');
	let editorSubcategory = $state('');
	let editorTags = $state('');
	let editorContent = $state('');
	let isSaving = $state(false);
	let saveSuccessToast = $state(false);
	let isDraggingFile = $state(false);

	// Sync local editor fields and view mode when document changes
	$effect(() => {
		const _activeDocSlug = data.doc?.slug; // Reactively track active doc changes
		editorDoc = null;
		customTree = data.treeData;
		editorContent = data.doc.content || '';
		editorTitle = data.doc.title || '';
		editorCategory = data.doc.category || 'Catatan Harian';
		editorSubcategory = data.doc.subcategory || '';
		editorTags = (data.doc.tags || []).join(', ');

		// Set default mode: Mode Baca ('view') unless URL explicitly specifies ?mode=edit or ?mode=split
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			if (params.get('mode') === 'edit' || params.get('mode') === 'split') {
				viewMode = 'split';
			} else {
				viewMode = 'view';
			}
		}

		// Auto-expand folder & all nested parent subfolders of current document
		if (data.doc?.category) {
			expandFolderHierarchy(data.doc.category, data.doc.subcategory);
		}
	});

	function expandFolderHierarchy(category: string, subcategory?: string) {
		if (!category) return;
		const catSlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		expandedFolders[`folder-${catSlug}`] = true;
		if (subcategory) {
			const parts = String(subcategory)
				.split('/')
				.map((s) => s.trim())
				.filter(Boolean);
			let acc = '';
			for (const part of parts) {
				acc = acc ? `${acc}/${part}` : part;
				const subSlug = acc.toLowerCase().replace(/[^a-z0-9]+/g, '-');
				expandedFolders[`subfolder-${catSlug}-${subSlug}`] = true;
			}
		}
	}

	$effect(() => {
		ui.currentContext = {
			type: 'my-docs',
			title: `Note: ${editorTitle || currentDoc?.title || 'Catatan Pribadi'}`,
			key: currentDoc?.slug || data.doc?.slug,
			snippet: editorContent || currentDoc?.content || ''
		};
	});

	$effect(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('click', closeContextMenu);
			return () => {
				window.removeEventListener('click', closeContextMenu);
			};
		}
	});

	// Sidebar filter & expansion state
	let filterQuery = $state('');
	let expandedFolders = $state<Record<string, boolean>>({
		'folder-catatan-harian': true,
		'folder-dokumentasi-modul': true,
		'folder-referensi-panduan': true
	});

	// Lightbox state
	let lightboxSrc = $state<string | null>(null);
	let lightboxAlt = $state('');

	// Active heading for outline scroll-spy
	let activeHeadingId = $state('');

	// Modals
	let showNewDocModal = $state(false);
	let showNewFolderModal = $state(false);
	let deleteTarget = $state<{
		open: boolean;
		isFolder?: boolean;
		title: string;
		category?: string;
		subcategory?: string;
		docId?: string;
		slug?: string;
		isDeleting?: boolean;
	}>({
		open: false,
		title: ''
	});

	// Dedicated Single-Document AI Assistant Modal State
	let isDocAiOpen = $state(false);
	let docAiTarget = $state<any>(null);
	let docAiInitialPrompt = $state('');

	function askAiAboutDoc(prompt = '', target: any = null) {
		const baseDoc = target || currentDoc;
		docAiTarget = {
			...baseDoc,
			section: 'My Docs',
			category: baseDoc.category || 'Catatan Pribadi',
			content: (baseDoc.id === currentDoc.id ? (editorContent || baseDoc.content) : baseDoc.content) || ''
		};
		docAiInitialPrompt = prompt;
		isDocAiOpen = true;
	}

	// =========================================================================
	// AI NOTE ASSISTANT (Rapikan Otomatis & Instruksi Manual dengan AI)
	// =========================================================================
	let isAiAssistLoading = $state(false);
	let aiActionType = $state<'format' | 'custom' | null>(null);
	let aiUndoContent = $state<string | null>(null);
	let showCustomAiPrompt = $state(false);
	let customAiPrompt = $state('');

	async function runAiFormatNote() {
		auth.refresh();
		if (!auth.isAuthenticated) {
			showToast(
				'Sesi login tidak ditemukan. Silakan login terlebih dahulu di aplikasi Helpdesk untuk menggunakan fitur AI.',
				true
			);
			return;
		}
		if (!editorContent.trim()) {
			showToast('Catatan masih kosong untuk dirapikan', true);
			return;
		}

		isAiAssistLoading = true;
		aiActionType = 'format';
		const previousBody = editorContent;

		try {
			const derivedTitle = extractTitleFromMarkdown(previousBody, currentDoc.title || 'Catatan');
			const res = await fetch('/api/ai/doc-assist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'format',
					prompt: 'Rapikan format catatan mentah ini menjadi Markdown yang rapi dan terstruktur tanpa mengubah isi fakta',
					section: 'My Docs',
					currentDoc: {
						title: derivedTitle,
						section: 'My Docs',
						category: currentDoc.category || 'Catatan Pribadi',
						content: previousBody
					}
				})
			});

			const d = await res.json();
			if (!res.ok || !d.success) throw new Error(d.error || 'Gagal merapikan catatan dengan AI');

			aiUndoContent = previousBody;
			const aiText = typeof d.result === 'string' ? d.result : d.result?.content || previousBody;
			editorContent = aiText;
			showToast('✓ Catatan berhasil dirapikan ke format Markdown yang bersih');
		} catch (err: any) {
			showToast(err.message || 'Gagal merapikan catatan', true);
		} finally {
			isAiAssistLoading = false;
			aiActionType = null;
		}
	}

	async function runCustomAiInstruction() {
		auth.refresh();
		if (!auth.isAuthenticated) {
			showToast(
				'Sesi login tidak ditemukan. Silakan login terlebih dahulu di aplikasi Helpdesk untuk menggunakan fitur AI.',
				true
			);
			return;
		}
		const instruction = customAiPrompt.trim();
		if (!instruction) {
			showToast('Silakan masukkan instruksi untuk AI terlebih dahulu', true);
			return;
		}

		isAiAssistLoading = true;
		aiActionType = 'custom';
		const previousBody = editorContent;

		try {
			const derivedTitle = extractTitleFromMarkdown(previousBody, currentDoc.title || 'Catatan');
			const res = await fetch('/api/ai/doc-assist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'custom',
					prompt: instruction,
					section: 'My Docs',
					currentDoc: {
						title: derivedTitle,
						section: 'My Docs',
						category: currentDoc.category || 'Catatan Pribadi',
						content: previousBody
					}
				})
			});

			const d = await res.json();
			if (!res.ok || !d.success) throw new Error(d.error || 'Gagal menjalankan instruksi AI');

			aiUndoContent = previousBody;
			const aiText = typeof d.result === 'string' ? d.result : d.result?.content || previousBody;
			editorContent = aiText;
			showToast('✓ Catatan berhasil diperbarui sesuai instruksi Anda');
			customAiPrompt = '';
			showCustomAiPrompt = false;
		} catch (err: any) {
			showToast(err.message || 'Gagal memproses instruksi AI', true);
		} finally {
			isAiAssistLoading = false;
			aiActionType = null;
		}
	}

	function undoAiChanges() {
		if (aiUndoContent !== null) {
			editorContent = aiUndoContent;
			aiUndoContent = null;
			showToast('✓ Perubahan AI berhasil diurungkan (Undo)');
		}
	}

	// Drag and Drop (notes & folders) — every folder at any depth is a valid drop target
	let draggedDoc = $state<any>(null);
	let draggedFolder = $state<any>(null);
	let activeDropTargetId = $state<string | null>(null);
	let isMovingFile = $state(false);
	let hoverExpandTimer: ReturnType<typeof setTimeout> | null = null;

	function folderCat(node: any): string {
		return node?.category ?? node?.title ?? '';
	}

	function folderSub(node: any): string | undefined {
		return node?.subcategory || undefined;
	}

	function folderTarget(node: any) {
		return {
			isFolder: true,
			isSubfolder: Boolean(node.isSubfolder),
			title: node.title,
			category: folderCat(node),
			subcategory: folderSub(node)
		};
	}

	function isNodeExpanded(node: any): boolean {
		// Searching auto-expands every matching branch
		if (filterQuery.trim()) return true;
		return expandedFolders[node.id] ?? !node.isSubfolder;
	}

	function clearHoverExpandTimer() {
		if (hoverExpandTimer) {
			clearTimeout(hoverExpandTimer);
			hoverExpandTimer = null;
		}
	}

	function handleDragStart(e: DragEvent, doc: any) {
		draggedDoc = doc;
		draggedFolder = null;
		if (e.dataTransfer) {
			e.dataTransfer.setData(
				'text/plain',
				JSON.stringify({
					id: doc.id,
					slug: doc.slug,
					title: doc.title,
					category: doc.category,
					subcategory: doc.subcategory
				})
			);
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleFolderItemDragStart(e: DragEvent, node: any) {
		e.stopPropagation();
		draggedDoc = null;
		draggedFolder = {
			category: folderCat(node),
			subcategory: folderSub(node),
			title: node.title
		};
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', JSON.stringify(draggedFolder));
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragEnd() {
		draggedDoc = null;
		draggedFolder = null;
		activeDropTargetId = null;
		clearHoverExpandTimer();
	}

	/** A folder cannot be dropped into itself, its own descendants, or its current parent. */
	function canDropOn(node: any): boolean {
		if (draggedDoc) return true;
		if (!draggedFolder) return false;
		const cat = folderCat(node);
		const sub = folderSub(node);
		const srcCat = draggedFolder.category;
		const srcSub: string | undefined = draggedFolder.subcategory;

		if (srcCat !== cat) return true;
		if (!srcSub) return false; // root folder onto itself / its own children
		if (!sub) return srcSub.includes('/'); // already at category root if no '/'
		if (sub === srcSub || sub.startsWith(`${srcSub}/`)) return false;
		const srcParent = srcSub.split('/').slice(0, -1).join('/');
		return sub !== srcParent;
	}

	function handleFolderDragOver(e: DragEvent, node: any) {
		if (!draggedDoc && !draggedFolder) return;
		if (!canDropOn(node)) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		activeDropTargetId = node.id;

		if (!isNodeExpanded(node) && !hoverExpandTimer) {
			hoverExpandTimer = setTimeout(() => {
				expandedFolders[node.id] = true;
				hoverExpandTimer = null;
			}, 500);
		}
	}

	function handleFolderDragLeave(e: DragEvent, folderId: string) {
		if (activeDropTargetId === folderId) {
			activeDropTargetId = null;
		}
		clearHoverExpandTimer();
	}

	async function handleFolderDrop(e: DragEvent, node: any) {
		e.preventDefault();
		e.stopPropagation();
		const docToMove = draggedDoc;
		const folderToMove = draggedFolder;
		activeDropTargetId = null;
		clearHoverExpandTimer();

		const cat = folderCat(node);
		const sub = folderSub(node);

		if (docToMove) {
			if (docToMove.category === cat && (docToMove.subcategory || undefined) === sub) return;
			await moveDocumentTo(docToMove, cat, sub);
		} else if (folderToMove) {
			if (!canDropOn(node)) return;
			await moveFolderTo(folderToMove, cat, sub);
		}
	}

	async function moveDocumentTo(doc: any, newCategory: string, newSubcategory?: string) {
		isMovingFile = true;
		try {
			const res = await fetch('/api/my-docs/move', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: doc.id || doc.slug,
					category: newCategory,
					subcategory: newSubcategory || undefined
				})
			});

			const dataRes = await res.json();
			if (!res.ok || !dataRes.success) {
				throw new Error(dataRes.error || 'Gagal memindahkan berkas');
			}

			if (dataRes.treeData) {
				customTree = dataRes.treeData;
			}

			// Auto-expand destination folder and every parent subfolder
			expandFolderHierarchy(newCategory, newSubcategory);

			// If the moved document is the currently active one, update editor doc/breadcrumbs
			if (currentDoc.slug === doc.slug || currentDoc.id === doc.id) {
				editorDoc = {
					...currentDoc,
					category: newCategory,
					subcategory: newSubcategory || undefined
				};
				editorCategory = newCategory;
				editorSubcategory = newSubcategory || '';
			}

			const targetName = newSubcategory ? `${newCategory} / ${newSubcategory}` : newCategory;
			showToast(`✓ Berkas "${doc.title}" berhasil dipindahkan ke "${targetName}"`);
		} catch (err: any) {
			showToast(err.message || 'Gagal memindahkan berkas', true);
		} finally {
			isMovingFile = false;
			draggedDoc = null;
		}
	}

	async function moveFolderTo(src: any, targetCategory: string, targetSubcategory?: string) {
		isMovingFile = true;
		try {
			const res = await fetch('/api/my-docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'move-folder',
					category: src.category,
					subcategory: src.subcategory,
					targetCategory,
					targetSubcategory
				})
			});
			const dataRes = await res.json();
			if (!res.ok || !dataRes.success) {
				throw new Error(dataRes.error || 'Gagal memindahkan folder');
			}
			if (dataRes.treeData) customTree = dataRes.treeData;
			expandFolderHierarchy(targetCategory, targetSubcategory);
			const targetName = targetSubcategory ? `${targetCategory} / ${targetSubcategory}` : targetCategory;
			showToast(`✓ Folder "${src.title}" berhasil dipindahkan ke "${targetName}"`);
			await invalidateAll();
		} catch (err: any) {
			showToast(err.message || 'Gagal memindahkan folder', true);
		} finally {
			isMovingFile = false;
			draggedFolder = null;
		}
	}

	// Context Menu (Right-Click) State
	let contextMenu = $state<{ open: boolean; x: number; y: number; targetDoc: any }>({
		open: false,
		x: 0,
		y: 0,
		targetDoc: null
	});

	function openContextMenu(e: MouseEvent, docTarget: any = null) {
		e.preventDefault();
		e.stopPropagation();

		const menuWidth = 265;
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

	function handleContextMenuEdit(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		if (!t || t.slug === currentDoc.slug || t.id === currentDoc.id) {
			viewMode = viewMode === 'view' ? 'split' : viewMode;
		} else {
			goto(`/my-docs/${t.slug}?mode=edit`);
		}
	}

	function handleContextMenuCreate(target: any) {
		closeContextMenu();
		if (target?.category) {
			startCreate('file', target.category, target.subcategory);
		} else {
			startCreate('file', currentDoc.category, currentDoc.subcategory);
		}
	}

	function handleContextMenuCreateFolder(target: any) {
		closeContextMenu();
		if (target?.category) {
			// Works at any depth: the new folder is created INSIDE the targeted folder
			startCreate('folder', target.category, target.subcategory);
		} else {
			startCreate('folder', '', undefined);
		}
	}

	function handleContextMenuRename(target: any) {
		closeContextMenu();
		startRename(target);
	}

	async function handleContextMenuDuplicate(target: any) {
		closeContextMenu();
		const docToDup = target || currentDoc;
		try {
			const res = await fetch('/api/my-docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: `${docToDup.title || 'Catatan'} (Salinan)`,
					category: docToDup.category || currentDoc.category || 'Catatan Harian',
					subcategory: docToDup.subcategory || undefined,
					content: docToDup.content || (docToDup.id === currentDoc.id ? (editorContent || currentDoc.content) : ''),
					tags: Array.isArray(docToDup.tags) ? docToDup.tags : ['Pribadi']
				})
			});
			const json = await res.json();
			if (res.ok && json.doc?.slug) {
				if (json.treeData) customTree = json.treeData;
				const catSlug = (docToDup.category || currentDoc.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
				expandedFolders[`folder-${catSlug}`] = true;
				showToast('✓ Catatan berhasil diduplikasi');
				await invalidateAll();
				await goto(`/my-docs/${json.doc.slug}`, { invalidateAll: true });
			} else {
				showToast(json.error || 'Gagal menduplikasi catatan', true);
			}
		} catch {
			showToast('Gagal menduplikasi catatan', true);
		}
	}

	function handleContextMenuAi(target: any) {
		closeContextMenu();
		askAiAboutDoc('', target);
	}

	function handleContextMenuCopyLink(target: any) {
		closeContextMenu();
		const slug = target?.slug || target?.id || currentDoc.slug || currentDoc.id;
		if (typeof window !== 'undefined') {
			navigator.clipboard.writeText(`${window.location.origin}/my-docs/${slug}`);
			showToast('✓ Tautan catatan berhasil disalin');
		}
	}

	function handleContextMenuCopyMarkdown(target: any) {
		closeContextMenu();
		const doc = target || currentDoc;
		const content = doc.content || (doc.id === currentDoc.id ? (editorContent || currentDoc.content) : '') || '';
		if (typeof window !== 'undefined') {
			navigator.clipboard.writeText(content);
			showToast('✓ Konten Markdown berhasil disalin');
		}
	}

	function handleContextMenuDownload(target: any) {
		closeContextMenu();
		const doc = target || currentDoc;
		const content = doc.content || (doc.id === currentDoc.id ? (editorContent || currentDoc.content) : '') || '';
		const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${(doc.title || 'catatan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleContextMenuDelete(target: any) {
		closeContextMenu();
		if (!target) return;

		if (target.isFolder) {
			deleteTarget = {
				open: true,
				isFolder: true,
				title: target.title || target.category || 'Folder',
				category: target.category || target.title,
				subcategory: target.subcategory,
				isDeleting: false
			};
			return;
		}

		// Single document delete
		const docTitle = target.title || currentDoc.title || 'Catatan ini';
		deleteTarget = {
			open: true,
			isFolder: false,
			title: docTitle,
			docId: target.id || target.slug || currentDoc.id,
			slug: target.slug || currentDoc.slug,
			isDeleting: false
		};
	}

	function openDeleteDocDialog() {
		deleteTarget = {
			open: true,
			isFolder: false,
			title: currentDoc.title || 'Catatan ini',
			docId: currentDoc.id || currentDoc.slug,
			slug: currentDoc.slug,
			isDeleting: false
		};
	}

	// Inline creator (VS Code / Obsidian style): new note or folder at any depth
	let explorerCreator = $state({
		open: false,
		type: 'file' as 'file' | 'folder',
		category: '',
		subcategory: '',
		name: '',
		isSubmitting: false,
		error: ''
	});

	// Inline rename for folders (any depth) and notes
	let explorerRename = $state({
		open: false,
		kind: 'folder' as 'folder' | 'doc',
		category: '',
		subcategory: '',
		id: '',
		name: '',
		original: '',
		isSubmitting: false
	});

	// Last clicked folder (target for the F2 shortcut)
	let selectedFolder = $state<any>(null);

	// Toast notification
	let toast = $state<{ message: string; isError?: boolean } | null>(null);
	function showToast(message: string, isError = false) {
		toast = { message, isError };
		setTimeout(() => {
			if (toast?.message === message) toast = null;
		}, 3000);
	}

	// Toggle folder collapse
	function toggleFolder(node: any) {
		expandedFolders[node.id] = !isNodeExpanded(node);
	}

	function focusInput(id: string) {
		setTimeout(() => {
			const el = document.getElementById(id) as HTMLInputElement | null;
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				el.focus();
				el.select();
			}
		}, 40);
	}

	/** Start inline creation of a note/folder inside any folder (empty category = root folder). */
	function startCreate(type: 'file' | 'folder', category: string, subcategory?: string) {
		explorerRename.open = false;
		isFocusMode = false;
		isMobileSidebarOpen = true;
		explorerCreator = {
			open: true,
			type,
			category: category || '',
			subcategory: subcategory || '',
			name: '',
			isSubmitting: false,
			error: ''
		};
		if (category) expandFolderHierarchy(category, subcategory);
		focusInput('explorer-creator-input');
	}

	function isCreatorAt(node: any): boolean {
		return (
			explorerCreator.open &&
			explorerCreator.category === folderCat(node) &&
			(explorerCreator.subcategory || '') === (node.subcategory || '')
		);
	}

	function startRename(target: any) {
		if (!target) return;
		explorerCreator.open = false;
		isFocusMode = false;
		isMobileSidebarOpen = true;
		if (target.isFolder) {
			const leaf = target.subcategory
				? String(target.subcategory).split('/').pop() || target.title
				: target.category || target.title;
			explorerRename = {
				open: true,
				kind: 'folder',
				category: target.category || target.title,
				subcategory: target.subcategory || '',
				id: '',
				name: leaf,
				original: leaf,
				isSubmitting: false
			};
		} else {
			explorerRename = {
				open: true,
				kind: 'doc',
				category: '',
				subcategory: '',
				id: target.id || target.slug,
				name: target.title || '',
				original: target.title || '',
				isSubmitting: false
			};
		}
		focusInput('explorer-rename-input');
	}

	function isRenamingFolder(node: any): boolean {
		return (
			explorerRename.open &&
			explorerRename.kind === 'folder' &&
			explorerRename.category === folderCat(node) &&
			(explorerRename.subcategory || '') === (node.subcategory || '')
		);
	}

	function isSelectedFolder(node: any): boolean {
		return (
			!!selectedFolder &&
			selectedFolder.category === folderCat(node) &&
			(selectedFolder.subcategory || '') === (node.subcategory || '')
		);
	}

	// Save document handler
	async function handleSave() {
		if (isSaving) return;
		isSaving = true;

		try {
			const derivedTitle = extractTitleFromMarkdown(editorContent, currentDoc.title || 'Catatan Baru');

			const res = await fetch(`/api/my-docs/${currentDoc.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: derivedTitle,
					category: currentDoc.category || 'Catatan Harian',
					subcategory: currentDoc.subcategory || undefined,
					content: editorContent,
					tags: currentDoc.tags || ['Pribadi']
				})
			});

			if (res.ok) {
				const json = await res.json();
				if (json.doc) editorDoc = json.doc;
				if (json.treeData) customTree = json.treeData;

				saveSuccessToast = true;
				showToast('✓ Catatan berhasil disimpan');
				await invalidateAll();
				setTimeout(() => {
					saveSuccessToast = false;
				}, 2500);
			} else {
				const err = await res.json().catch(() => ({}));
				showToast(err.error || 'Gagal menyimpan dokumen', true);
			}
		} catch {
			showToast('Terjadi kesalahan saat menyimpan dokumen', true);
		} finally {
			isSaving = false;
		}
	}

	// Keydown shortcuts: Ctrl+S (Save), Escape (Close context/lightbox/AI), Ctrl+E (Edit), Ctrl+I (AI Copilot), Alt+N (New File), Alt+F (New Folder)
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeContextMenu();
			if (lightboxSrc) lightboxSrc = null;
			if (isDocAiOpen) isDocAiOpen = false;
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			if (viewMode !== 'view') {
				handleSave();
			}
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
			e.preventDefault();
			viewMode = viewMode === 'view' ? 'split' : 'view';
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
			e.preventDefault();
			if (isDocAiOpen) {
				isDocAiOpen = false;
			} else {
				askAiAboutDoc();
			}
			return;
		}
		if (e.altKey && e.key.toLowerCase() === 'n') {
			e.preventDefault();
			startCreate('file', currentDoc.category, currentDoc.subcategory);
			return;
		}
		if (e.altKey && e.key.toLowerCase() === 'f') {
			e.preventDefault();
			startCreate('folder', currentDoc.category, currentDoc.subcategory);
			return;
		}
		if (e.key === 'F2') {
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;
			e.preventDefault();
			startRename(selectedFolder || currentDoc);
			return;
		}
	}

	// Insert Markdown helper (Tanpa menyisipkan kata 'teks' liar saat upload gambar)
	function insertSnippet(before: string, after = '', defaultPlaceholder = '') {
		const textarea = document.getElementById('note-markdown-textarea') as HTMLTextAreaElement | null;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selected = text.substring(start, end);
		const contentToWrap = selected || defaultPlaceholder;

		const replacement = `${before}${contentToWrap}${after}`;
		editorContent = text.substring(0, start) + replacement + text.substring(end);

		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(
				start + before.length,
				start + before.length + contentToWrap.length
			);
		}, 10);
	}

	// Attached images for instant visual thumbnails in editor
	let insertedImages = $derived.by(() => {
		const matches = [...(editorContent || '').matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
		return matches.map((m) => ({ alt: m[1] || 'Gambar', url: m[2] }));
	});

	// Image upload handler (Drag-drop & Clipboard Paste)
	async function uploadAndInsertImage(file: File) {
		if (!file.type.startsWith('image/')) return;

		showToast('Mengunggah gambar...');
		const reader = new FileReader();
		reader.onload = async () => {
			const base64 = reader.result as string;
			try {
				const res = await fetch('/api/upload', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						filename: file.name || 'catatan-pribadi.png',
						image: base64
					})
				});

				if (res.ok) {
					const resData = await res.json();
					insertSnippet(`\n![${file.name || 'Gambar'}](${resData.url})\n`, '', '');
					// Switch to split view so the user immediately sees the live preview of the pasted image
					if (viewMode === 'view') {
						viewMode = 'split';
					}
					showToast('✓ Gambar berhasil disisipkan & dipratinjau');
				} else {
					showToast('Gagal mengunggah gambar', true);
				}
			} catch {
				showToast('Gagal mengirim gambar ke server', true);
			}
		};
		reader.readAsDataURL(file);
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (file) uploadAndInsertImage(file);
				break;
			}
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingFile = false;
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		for (const file of files) {
			if (file.type.startsWith('image/')) {
				uploadAndInsertImage(file);
				break;
			}
		}
	}

	// Create a new note / folder from the inline explorer input
	async function submitCreator(e?: Event) {
		if (e) e.preventDefault();
		const cleanName = explorerCreator.name
			.trim()
			.replace(/^\/+|\/+$/g, '')
			.replace(/\s*\/\s*/g, '/');
		if (!cleanName || explorerCreator.isSubmitting) return;

		explorerCreator.isSubmitting = true;
		explorerCreator.error = '';

		try {
			if (explorerCreator.type === 'folder') {
				// "Mining/CS" creates the whole chain in one go; at root the first part is the category
				let category = explorerCreator.category;
				let subcategory: string | undefined;
				if (!category) {
					const parts = cleanName.split('/').filter(Boolean);
					category = parts[0];
					subcategory = parts.slice(1).join('/') || undefined;
				} else {
					subcategory = [explorerCreator.subcategory, cleanName].filter(Boolean).join('/');
				}

				const res = await fetch('/api/my-docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'add-folder', category, subcategory })
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(json.error || 'Gagal membuat folder');
				if (json.treeData) customTree = json.treeData;
				if (json.success === false) {
					explorerCreator.error = 'Folder dengan nama tersebut sudah ada';
					return;
				}

				expandFolderHierarchy(category, subcategory);
				explorerCreator.open = false;
				showToast(`✓ Folder "${subcategory || category}" berhasil dibuat`);
				await invalidateAll();
			} else {
				const title = cleanName.replace(/\.md$/i, '');
				const category = explorerCreator.category || currentDoc.category || 'Catatan Harian';
				const res = await fetch('/api/my-docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title,
						category,
						subcategory: explorerCreator.subcategory || undefined,
						content: `# ${title}\n\n`,
						tags: ['Pribadi']
					})
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(json.error || 'Gagal membuat catatan');

				if (json.treeData) customTree = json.treeData;
				expandFolderHierarchy(category, explorerCreator.subcategory || undefined);
				explorerCreator.open = false;
				showToast('✓ Catatan baru berhasil dibuat');
				await invalidateAll();
				if (json.doc?.slug) {
					viewMode = 'split';
					await goto(`/my-docs/${json.doc.slug}?mode=edit`, { invalidateAll: true });
				}
			}
		} catch (err: any) {
			explorerCreator.error = err?.message || 'Terjadi kesalahan';
		} finally {
			explorerCreator.isSubmitting = false;
		}
	}

	// Rename a folder (any depth) or a note from the inline explorer input
	async function submitRename() {
		if (!explorerRename.open || explorerRename.isSubmitting) return;
		const newName = explorerRename.name.trim();
		if (!newName || newName === explorerRename.original) {
			explorerRename.open = false;
			return;
		}
		if (explorerRename.kind === 'folder' && newName.includes('/')) {
			showToast("Nama folder tidak boleh mengandung karakter '/'", true);
			return;
		}

		explorerRename.isSubmitting = true;
		try {
			const payload =
				explorerRename.kind === 'folder'
					? {
							action: 'rename-folder',
							category: explorerRename.category,
							subcategory: explorerRename.subcategory || undefined,
							newName
						}
					: { action: 'rename-doc', id: explorerRename.id, newTitle: newName };

			const res = await fetch('/api/my-docs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json.success) throw new Error(json.error || 'Gagal mengubah nama');

			if (json.treeData) customTree = json.treeData;
			if (explorerRename.kind === 'folder') {
				expandFolderHierarchy(json.category, json.subcategory);
				selectedFolder = null;
			}
			explorerRename.open = false;
			showToast(`✓ Berhasil diubah menjadi "${newName}"`);
			await invalidateAll();
		} catch (err: any) {
			showToast(err?.message || 'Gagal mengubah nama', true);
		} finally {
			explorerRename.isSubmitting = false;
		}
	}

	// Confirm delete action for either single note or entire folder
	async function confirmDeleteAction() {
		if (!deleteTarget.open || deleteTarget.isDeleting) return;
		deleteTarget.isDeleting = true;

		if (deleteTarget.isFolder) {
			const folderTitle = deleteTarget.title;
			try {
				const res = await fetch('/api/my-docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'delete-folder',
						category: deleteTarget.category,
						subcategory: deleteTarget.subcategory
					})
				});
				const json = await res.json();
				if (res.ok) {
					if (json.treeData) customTree = json.treeData;
					deleteTarget.open = false;
					showToast(`✓ Folder "${folderTitle}" berhasil dihapus`);
					await invalidateAll();
					const curSub = currentDoc.subcategory || '';
					const delSub = deleteTarget.subcategory || '';
					if (
						currentDoc.category === deleteTarget.category &&
						(!delSub || curSub === delSub || curSub.startsWith(`${delSub}/`))
					) {
						await goto('/my-docs', { invalidateAll: true });
					}
				} else {
					showToast(json.error || 'Gagal menghapus folder', true);
				}
			} catch {
				showToast('Gagal menghapus folder', true);
			} finally {
				deleteTarget.isDeleting = false;
			}
			return;
		}

		// Single document delete
		const docTitle = deleteTarget.title;
		const docId = deleteTarget.docId || currentDoc.id;
		try {
			const res = await fetch(`/api/my-docs/${docId}`, { method: 'DELETE' });
			if (res.ok) {
				const json = await res.json();
				if (json.treeData) customTree = json.treeData;
				deleteTarget.open = false;
				showToast(`✓ Catatan "${docTitle}" berhasil dihapus`);
				await invalidateAll();
				if (docId === currentDoc.id || deleteTarget.slug === currentDoc.slug) {
					await goto('/my-docs', { invalidateAll: true });
				}
			} else {
				showToast('Gagal menghapus catatan', true);
			}
		} catch {
			showToast('Gagal menghapus catatan', true);
		} finally {
			deleteTarget.isDeleting = false;
		}
	}

	// Copy full markdown
	function copyMarkdown() {
		navigator.clipboard.writeText(currentDoc.content || '');
		showToast('Markdown berhasil disalin ke clipboard');
	}

	// Outline scroll
	function scrollToHeading(id: string) {
		activeHeadingId = id;
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// Lightbox click handler
	function handleContentClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'IMG') {
			const img = target as HTMLImageElement;
			lightboxSrc = img.src;
			lightboxAlt = img.alt || 'Gambar Catatan';
		}
	}

	// Word & reading stats
	let wordCount = $derived.by(() => {
		const text = editorContent || currentDoc.content || '';
		const words = text.trim().split(/\s+/).filter(Boolean);
		return words.length;
	});

	let readingTimeMinutes = $derived(Math.max(1, Math.ceil(wordCount / 200)));

	// List of unique categories for autocompletion
	let categoryOptions = $derived.by(() => {
		const set = new Set<string>();
		for (const f of treeData) {
			if (f.title) set.add(f.title);
		}
		return Array.from(set);
	});

	// Derived outline and filtered tree
	let outlineTree = $derived(extractOutlineTree(editorContent || currentDoc.content || ''));

	// Recursive filter: keeps matching notes/folders at ANY depth (SAP -> Mining -> CS -> ...)
	function filterNodes(nodes: any[], q: string): any[] {
		const out: any[] = [];
		for (const n of nodes || []) {
			const selfMatch = (n.title || '').toLowerCase().includes(q);
			if (n.isFolder) {
				const kids = selfMatch ? n.nodes || [] : filterNodes(n.nodes || [], q);
				if (selfMatch || kids.length > 0) out.push({ ...n, nodes: kids });
			} else if (selfMatch) {
				out.push(n);
			}
		}
		return out;
	}

	let filteredTree = $derived.by(() => {
		if (!filterQuery.trim()) return treeData;
		return filterNodes(treeData, filterQuery.trim().toLowerCase());
	});
</script>

<!-- Inline create row (new note / folder) rendered inside whichever folder is targeted -->
{#snippet creatorRow()}
	<form onsubmit={submitCreator} class="px-1 py-0.5">
		<div class="flex items-center gap-1.5">
			{#if explorerCreator.type === 'folder'}
				<Folder class="h-3.5 w-3.5 shrink-0 text-primary" />
			{:else}
				<FileText class="h-3.5 w-3.5 shrink-0 text-primary" />
			{/if}
			<input
				id="explorer-creator-input"
				type="text"
				bind:value={explorerCreator.name}
				disabled={explorerCreator.isSubmitting}
				placeholder={explorerCreator.type === 'folder'
					? explorerCreator.category
						? 'Nama folder (boleh a/b/c)...'
						: 'Nama folder utama...'
					: 'Nama catatan...'}
				class="h-6 min-w-0 flex-1 rounded border border-primary/60 bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50"
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						e.stopPropagation();
						explorerCreator.open = false;
					}
				}}
				onblur={() => {
					if (!explorerCreator.name.trim() && !explorerCreator.isSubmitting) {
						explorerCreator.open = false;
					}
				}}
			/>
		</div>
		{#if explorerCreator.error}
			<p class="pl-5 pt-0.5 text-[10px] text-destructive">{explorerCreator.error}</p>
		{:else}
			<p class="pl-5 pt-0.5 text-[10px] text-muted-foreground/70">Enter untuk membuat • Esc batal</p>
		{/if}
	</form>
{/snippet}

<!-- Recursive explorer tree: folders nest to unlimited depth (SAP -> Mining -> CS -> ...) -->
{#snippet explorerNodes(nodes: any[], depth: number)}
	{#each nodes as node (node.id)}
		{#if node.isFolder}
			{@const expanded = isNodeExpanded(node)}
			{@const isDropActive = activeDropTargetId === node.id}
			{@const renamingThis = isRenamingFolder(node)}
			{@const selected = isSelectedFolder(node)}
			<div
				class="rounded-md transition-all {isDropActive ? 'ring-2 ring-primary/80 bg-primary/10' : ''}"
				oncontextmenu={(e) => openContextMenu(e, folderTarget(node))}
				ondragover={(e) => handleFolderDragOver(e, node)}
				ondragleave={(e) => handleFolderDragLeave(e, node.id)}
				ondrop={(e) => handleFolderDrop(e, node)}
				role="group"
			>
				<div
					class="group/row flex items-center rounded-md pr-1 transition-colors {isDropActive
						? 'bg-primary/15 text-primary'
						: selected
							? 'bg-accent'
							: 'hover:bg-accent/60'}"
					draggable={!renamingThis}
					ondragstart={(e) => handleFolderItemDragStart(e, node)}
					ondragend={handleDragEnd}
					role="treeitem"
					aria-selected={selected}
					aria-expanded={expanded}
					tabindex="-1"
				>
					{#if renamingThis}
						<div class="flex min-w-0 flex-1 items-center gap-1 py-0.5 pl-1.5">
							<Folder class="h-3.5 w-3.5 shrink-0 text-primary" />
							<input
								id="explorer-rename-input"
								type="text"
								bind:value={explorerRename.name}
								class="h-6 min-w-0 flex-1 rounded border border-primary/60 bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50"
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										submitRename();
									} else if (e.key === 'Escape') {
										e.preventDefault();
										e.stopPropagation();
										explorerRename.open = false;
									}
								}}
								onblur={submitRename}
							/>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => {
								selectedFolder = folderTarget(node);
								toggleFolder(node);
							}}
							ondblclick={() => startRename(folderTarget(node))}
							class="flex min-w-0 flex-1 items-center gap-1 py-1 pl-1 pr-1 text-left text-xs {depth === 0
								? 'font-semibold text-foreground'
								: 'font-medium text-foreground/80'}"
							title={node.subcategory ? `${node.category} / ${node.subcategory}` : node.title}
						>
							<ChevronRight
								class="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 {expanded
									? 'rotate-90'
									: ''}"
							/>
							{#if expanded}
								<FolderOpen class="h-3.5 w-3.5 shrink-0 text-primary" />
							{:else}
								<Folder class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							{/if}
							<span class="truncate">{node.title}</span>
						</button>

						{#if isDropActive && (draggedDoc || draggedFolder)}
							<span class="shrink-0 rounded bg-background/80 px-1 py-0.5 text-[9px] font-bold text-primary shadow-2xs">
								Lepas di sini
							</span>
						{:else}
							<div class="shrink-0 items-center gap-0.5 {selected ? 'flex' : 'hidden group-hover/row:flex'}">
								<button
									type="button"
									title="Catatan baru di dalam folder ini"
									onclick={(e) => {
										e.stopPropagation();
										startCreate('file', folderCat(node), folderSub(node));
									}}
									class="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
								>
									<FilePlus class="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									title="Sub-folder baru di dalam folder ini"
									onclick={(e) => {
										e.stopPropagation();
										startCreate('folder', folderCat(node), folderSub(node));
									}}
									class="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
								>
									<FolderPlus class="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									title="Ubah nama folder (F2)"
									onclick={(e) => {
										e.stopPropagation();
										startRename(folderTarget(node));
									}}
									class="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
								>
									<PenLine class="h-3.5 w-3.5" />
								</button>
							</div>
							<span class="shrink-0 pl-1 font-mono text-[10px] text-muted-foreground/60 {selected ? 'hidden' : 'group-hover/row:hidden'}">
								{node.count ?? (node.nodes?.length || 0)}
							</span>
						{/if}
					{/if}
				</div>

				{#if expanded}
					<div class="ml-2.5 mt-0.5 space-y-0.5 border-l border-border/60 pl-1.5">
						{#if isCreatorAt(node)}
							{@render creatorRow()}
						{/if}
						{@render explorerNodes(node.nodes || [], depth + 1)}
						{#if (node.nodes || []).length === 0 && !isCreatorAt(node)}
							<div class="px-2 py-1 text-[10px] italic text-muted-foreground/60">Folder kosong</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			{@const isCurrent = currentDoc.slug === node.slug || currentDoc.id === node.id}
			{@const isThisDragged = draggedDoc?.id === node.id || draggedDoc?.slug === node.slug}
			{@const renamingDoc = explorerRename.open && explorerRename.kind === 'doc' && explorerRename.id === (node.id || node.slug)}
			{#if renamingDoc}
				<div class="flex items-center gap-1.5 px-1.5 py-0.5">
					<FileText class="h-3 w-3 shrink-0 text-primary" />
					<input
						id="explorer-rename-input"
						type="text"
						bind:value={explorerRename.name}
						class="h-6 min-w-0 flex-1 rounded border border-primary/60 bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								submitRename();
							} else if (e.key === 'Escape') {
								e.preventDefault();
								e.stopPropagation();
								explorerRename.open = false;
							}
						}}
						onblur={submitRename}
					/>
				</div>
			{:else}
				<a
					href="/my-docs/{node.slug}"
					draggable="true"
					ondragstart={(e) => handleDragStart(e, node)}
					ondragend={handleDragEnd}
					onclick={(e) => {
						if (draggedDoc || draggedFolder) {
							e.preventDefault();
							return;
						}
						selectedFolder = null;
						isMobileSidebarOpen = false;
					}}
					oncontextmenu={(e) => openContextMenu(e, node)}
					class="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors cursor-grab active:cursor-grabbing {isCurrent
						? 'bg-secondary font-semibold text-foreground'
						: 'text-muted-foreground hover:bg-muted hover:text-foreground'} {isThisDragged ? 'opacity-30 border border-dashed border-primary/50' : ''}"
					title="Geser mouse untuk memindahkan ke folder lain"
				>
					<FileText class="h-3 w-3 shrink-0 {isCurrent ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="truncate">{node.title}</span>
				</a>
			{/if}
		{/if}
	{/each}
{/snippet}

<svelte:window onkeydown={handleKeydown} />

<!-- Uniform Toast Notification -->
{#if toast}
	<div
		class={cn(
			"fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-xl animate-in slide-in-from-bottom-3 duration-150",
			toast.isError
				? "border-destructive/40 bg-destructive/95 text-destructive-foreground backdrop-blur-sm"
				: "border-border bg-popover text-popover-foreground"
		)}
	>
		{#if toast.isError}
			<AlertCircle class="h-4 w-4 shrink-0 text-white" />
		{:else}
			<Check class="h-4 w-4 shrink-0 text-emerald-500" />
		{/if}
		<span>{toast.message}</span>
	</div>
{/if}

<!-- UNIFIED WORKSPACE SHELL: Exactly matches /docs/[...slug] -->
<div
	class={cn(
		"mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-200",
		(viewMode === 'split' || isFocusMode) ? "max-w-[1600px] w-full" : "max-w-7xl"
	)}
	oncontextmenu={(e) => openContextMenu(e, currentDoc)}
	role="region"
	aria-label="My Docs Workspace"
>
	<div class="flex flex-col lg:flex-row gap-6 lg:gap-10 py-6 lg:py-8">
		
		<!-- LEFT SIDEBAR: Personal File Explorer (Identical styling & widths to /docs) -->
		{#if !isFocusMode}
			<aside
				class="{isMobileSidebarOpen
					? 'block rounded-xl border border-border bg-card p-4 shadow-sm lg:rounded-none lg:border-0 lg:border-r lg:bg-transparent lg:p-0 lg:shadow-none'
					: 'hidden'} lg:block lg:w-64 shrink-0 lg:border-r border-border/60 lg:pr-5"
			>
				<div
					class="lg:sticky lg:top-20 space-y-3"
					oncontextmenu={(e) => openContextMenu(e, null)}
					role="region"
					aria-label="File Explorer Pribadi"
				>
					<!-- Sidebar Header: Title & Auto-sync Button for Arif Rahman -->
					<div class="flex items-center justify-between py-1">
						<div class="flex items-center gap-1.5 truncate">
							<BookUser class="h-4 w-4 text-primary shrink-0" />
							<span class="text-xs font-semibold text-foreground truncate">
								My Docs ({data.userName})
							</span>
						</div>
						{#if data.userName && data.userName.toLowerCase().trim() === 'arif rahman'}
							<Button
								variant="ghost"
								size="sm"
								onclick={() => ui.openSyncModal(false)}
								class="h-6 gap-1 px-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 cursor-pointer shrink-0 active:scale-95 transition-transform"
								title="Buka Detail & Jalankan Sinkronisasi Dokumen Eksternal"
							>
								<RefreshCw class="h-3 w-3" />
								<span>Sync Docs</span>
							</Button>
						{/if}
					</div>

					<!-- Explorer Toolbar: create note / folder (like VS Code Explorer & Obsidian) -->
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Explorer</span>
						<div class="flex items-center gap-0.5">
							<button
								type="button"
								onclick={() => startCreate('file', selectedFolder?.category || currentDoc.category, selectedFolder ? selectedFolder.subcategory : currentDoc.subcategory)}
								class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								title="Catatan baru (Alt+N) — di folder yang dipilih"
							>
								<FilePlus class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onclick={() => startCreate('folder', '', undefined)}
								class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								title="Folder utama baru. Untuk sub-folder, arahkan mouse ke folder lalu klik ikon folder (+), atau klik kanan"
							>
								<FolderPlus class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					<!-- Quiet Filter Input (Matches /docs) -->
					<div class="relative">
						<Search class="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
						<Input
							type="text"
							bind:value={filterQuery}
							onkeydown={(e) => {
								if (e.key === 'Escape') filterQuery = '';
							}}
							placeholder="Cari catatan..."
							class="h-7 pl-8 pr-6 text-xs"
						/>
						{#if filterQuery}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onclick={() => (filterQuery = '')}
								class="absolute right-1 top-1 h-5 w-5 text-muted-foreground hover:text-foreground"
							>
								<X class="h-3 w-3" />
							</Button>
						{/if}
					</div>

					<!-- Clean Folder & File Tree Navigation (unlimited nesting, VS Code / Obsidian style) -->
					{#if draggedDoc || draggedFolder}
						<div class="mb-1.5 flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary animate-in fade-in">
							<FolderInput class="h-3.5 w-3.5 shrink-0 animate-pulse" />
							<span class="truncate">Lepaskan di folder tujuan...</span>
						</div>
					{/if}

					<nav class="space-y-0.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
						{#if explorerCreator.open && !explorerCreator.category}
							{@render creatorRow()}
						{/if}

						{#if filteredTree.length === 0}
							<div class="py-8 text-center text-xs text-muted-foreground space-y-2">
								<p>{filterQuery ? 'Tidak ada catatan yang cocok.' : 'Belum ada folder. Klik ikon folder (+) di atas untuk membuat.'}</p>
								{#if filterQuery}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => (filterQuery = '')}
										class="h-6 text-[11px]"
									>
										Reset Filter
									</Button>
								{/if}
							</div>
						{:else}
							{@render explorerNodes(filteredTree, 0)}
						{/if}
					</nav>
				</div>
			</aside>
		{/if}

		<!-- CENTER NOTE CANVAS: Main Reading / Editing Area -->
		<div
			class={cn(
				"min-w-0 flex-1 space-y-6 transition-all duration-200",
				viewMode === 'split' ? "max-w-none w-full" : ""
			)}
			oncontextmenu={(e) => openContextMenu(e, currentDoc)}
			role="main"
			aria-label="Area Catatan Dokumen Pribadi"
		>
			<!-- Breadcrumbs & Quick Action Toolbar -->
			<div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-b border-border/60 pb-3">
				<!-- Left: Mobile toggle + Breadcrumbs -->
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => (isMobileSidebarOpen = !isMobileSidebarOpen)}
						class="h-7 lg:hidden gap-1.5 px-2 text-xs"
					>
						<Layers class="h-3.5 w-3.5" />
						<span>Explorer</span>
					</Button>

					<nav aria-label="Breadcrumbs" class="flex items-center gap-1.5">
						<a href="/my-docs" class="hover:text-foreground transition-colors font-medium">My Docs</a>
						<ChevronRight class="h-3 w-3 text-muted-foreground/60" />
						<span class="text-foreground/80 font-medium">{currentDoc.category}</span>
						{#each (currentDoc.subcategory || '').split('/').filter(Boolean) as crumb}
							<ChevronRight class="h-3 w-3 text-muted-foreground/60" />
							<span>{crumb}</span>
						{/each}
					</nav>
				</div>

				<!-- Right: Mode Switcher, Save & Action Buttons -->
				<div class="flex items-center gap-1.5">
					<!-- Mode Switcher: Mode Baca vs Edit Catatan -->
					{#if viewMode === 'split'}
						<Button
							variant="outline"
							size="sm"
							onclick={() => (viewMode = 'view')}
							class="h-8 gap-1.5 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
							title="Beralih ke tampilan membaca layar penuh (Ctrl+E)"
						>
							<Eye class="size-3.5" />
							<span class="hidden sm:inline">Mode Baca</span>
						</Button>

						<Button
							size="sm"
							onclick={handleSave}
							disabled={isSaving}
							class="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs"
							title="Simpan perubahan catatan (Ctrl+S)"
						>
							{#if isSaving}
								<Loader2 class="size-3.5 animate-spin" />
								<span>Menyimpan...</span>
							{:else}
								<Save class="size-3.5" />
								<span>Simpan</span>
							{/if}
						</Button>
					{:else}
						<Button
							variant="default"
							size="sm"
							onclick={() => (viewMode = 'split')}
							class="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs"
							title="Beralih ke mode editor catatan (Ctrl+E)"
						>
							<Edit3 class="size-3.5" />
							<span>Edit Catatan</span>
						</Button>
					{/if}

					<!-- Focus Mode Toggle -->
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (isFocusMode = !isFocusMode)}
						class="hidden lg:inline-flex h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
						title={isFocusMode ? 'Keluar Mode Fokus' : 'Mode Fokus (Sembunyikan Menu)'}
					>
						{#if isFocusMode}
							<Minimize2 class="size-3.5" />
							<span>Keluar Fokus</span>
						{:else}
							<Maximize2 class="size-3.5" />
							<span>Mode Fokus</span>
						{/if}
					</Button>

					<!-- Copy Markdown -->
					<Button
						variant="ghost"
						size="sm"
						onclick={copyMarkdown}
						class="size-8 p-0 text-muted-foreground hover:text-foreground"
						title="Salin isi Markdown"
					>
						<Copy class="size-3.5" />
					</Button>

					<!-- AI Copilot Modal (Fokus Dokumen Ini) -->
					<Button
						variant="outline"
						size="sm"
						onclick={() => askAiAboutDoc()}
						class="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
						title="Tanya AI Copilot khusus dokumen ini (Ctrl+I)"
					>
						<Sparkles class="size-3.5 text-primary" />
						<span class="hidden sm:inline">AI Dokumen</span>
					</Button>

					<!-- Delete Document -->
					<Button
						variant="ghost"
						size="sm"
						onclick={openDeleteDocDialog}
						class="size-8 p-0 text-destructive hover:bg-destructive/10"
						title="Hapus Catatan"
					>
						<Trash2 class="size-3.5" />
					</Button>

					<!-- More Actions (Context Menu Trigger) -->
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={(e) => openContextMenu(e, currentDoc)}
						class="size-8 p-0 text-muted-foreground hover:text-foreground"
						title="Opsi Catatan Lengkap (Klik Kanan)"
					>
						<MoreHorizontal class="size-4" />
					</Button>
				</div>
			</div>

			<!-- Document Header Section -->
			{#if viewMode === 'view' && !editorContent.trim().startsWith('# ')}
				<h1 class="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl pb-1">
					{currentDoc.title}
				</h1>
			{/if}

			<!-- Content Canvas -->
			{#if viewMode === 'view'}
				<!-- Mode Baca (Prose Output) -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed py-2 [&_img]:cursor-zoom-in [&_img]:rounded-xl [&_img]:border [&_img]:border-border [&_img]:shadow-xs"
					onclick={handleContentClick}
					ondblclick={() => {
						if (viewMode === 'view') viewMode = 'split';
					}}
					oncontextmenu={(e) => openContextMenu(e, currentDoc)}
				>
					{@html renderMarkdown(editorContent || currentDoc.content || '*Catatan ini belum memiliki isi. Klik tombol Edit untuk mulai menulis.*')}
				</div>
			{:else}
				<!-- Mode Tulis Langsung (Split View: Editor di Kiri, Live Preview di Kanan) -->
				<div class="space-y-2.5">
					<!-- Formatting Toolbar: Sleek Semantic Grouping & Pixel-Perfect Alignment -->
					<div class="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-border/80 bg-card p-1.5 shadow-2xs">
						<div class="flex flex-wrap items-center gap-1.5">
							<!-- Group 1: Text Formatting -->
							<div class="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-2xs">
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('## ', '', 'Heading 2')} class="size-7 p-0 rounded-md" title="Heading 2">
									<Heading2 class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('### ', '', 'Heading 3')} class="size-7 p-0 rounded-md" title="Heading 3">
									<Heading3 class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('**', '**', 'teks tebal')} class="size-7 p-0 rounded-md" title="Tebal (Bold)">
									<Bold class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('*', '*', 'teks miring')} class="size-7 p-0 rounded-md" title="Miring (Italic)">
									<Italic class="size-3.5" />
								</Button>
							</div>

							<!-- Group 2: Insert Elements -->
							<div class="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-2xs">
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('- ', '', 'poin')} class="size-7 p-0 rounded-md" title="Daftar Poin">
									<List class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('- [ ] ', '', 'tugas')} class="size-7 p-0 rounded-md" title="Daftar Checklist">
									<CheckSquare class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('```typescript\n', '\n```', '// kode di sini')} class="size-7 p-0 rounded-md" title="Blok Kode">
									<Code class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Baris 1 | Baris 2 |')} class="size-7 p-0 rounded-md" title="Tabel">
									<Table class="size-3.5" />
								</Button>
								<Button variant="ghost" size="sm" onclick={() => insertSnippet('![Deskripsi](', ')', 'https://')} class="size-7 p-0 rounded-md" title="Sisipkan Gambar">
									<ImageIcon class="size-3.5" />
								</Button>
							</div>

							<!-- Group 3: AI Actions -->
							<div class="flex items-center gap-1">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isAiAssistLoading || !editorContent.trim()}
									onclick={runAiFormatNote}
									class="h-7 gap-1.5 px-2.5 text-xs font-medium"
									title="Rapikan catatan mentah menjadi Markdown yang rapi dan terstruktur secara otomatis"
								>
									{#if isAiAssistLoading && aiActionType === 'format'}
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
									disabled={isAiAssistLoading}
									onclick={() => (showCustomAiPrompt = !showCustomAiPrompt)}
									class="h-7 gap-1.5 px-2.5 text-xs font-medium"
									title="Beri instruksi manual untuk memodifikasi atau menambah isi catatan"
								>
									<Wand2 class="size-3.5 text-primary" />
									<span>Instruksi AI</span>
								</Button>
								{#if aiUndoContent !== null}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={undoAiChanges}
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
								<span>{wordCount} kata</span>
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
								placeholder="Ketik instruksi manual untuk AI (mis: Buat tabel, tambahkan kesimpulan, buatkan draf meeting...)"
								class="h-7 text-xs bg-background flex-1 border-primary/20 focus-visible:ring-primary/40"
								disabled={isAiAssistLoading}
								onkeydown={(e) => {
									if (e.key === 'Enter' && !isAiAssistLoading && customAiPrompt.trim()) {
										e.preventDefault();
										runCustomAiInstruction();
									}
								}}
							/>
							<Button
								type="button"
								size="sm"
								disabled={isAiAssistLoading || !customAiPrompt.trim()}
								onclick={runCustomAiInstruction}
								class="h-7 text-xs gap-1.5 px-3"
							>
								{#if isAiAssistLoading && aiActionType === 'custom'}
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
					{#if insertedImages.length > 0}
						<div class="flex items-center gap-2 overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-2 shadow-2xs">
							<span class="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider pl-1">
								Gambar Terlampir ({insertedImages.length}):
							</span>
							<div class="flex items-center gap-2 overflow-x-auto py-0.5">
								{#each insertedImages as img}
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

					<!-- Flexible Editor Canvas: Tulis Penuh (100%) vs Split View (50:50) -->
					{#if editorLayout === 'full'}
						<!-- Mode Tulis Penuh: 100% Lebar Layar, Sangat Lega & Leluasa -->
						<div class="relative">
							<Textarea
								id="note-markdown-textarea"
								bind:value={editorContent}
								onpaste={handlePaste}
								ondrop={handleDrop}
								ondragover={(e) => { e.preventDefault(); isDraggingFile = true; }}
								ondragleave={() => (isDraggingFile = false)}
								rows={26}
								placeholder="Tulis catatan Anda dengan Markdown di sini..."
								class="min-h-[580px] w-full resize-y rounded-xl p-5 font-mono text-sm leading-relaxed border-border/80 bg-background shadow-xs focus-visible:ring-2 focus-visible:ring-primary/40"
							/>
							{#if isDraggingFile}
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
									id="note-markdown-textarea"
									bind:value={editorContent}
									onpaste={handlePaste}
									ondrop={handleDrop}
									ondragover={(e) => { e.preventDefault(); isDraggingFile = true; }}
									ondragleave={() => (isDraggingFile = false)}
									rows={26}
									placeholder="Tulis catatan Anda dengan Markdown di sini..."
									class="min-h-[580px] w-full resize-none rounded-xl p-5 font-mono text-sm leading-relaxed border-border/80 bg-background shadow-xs"
								/>
								{#if isDraggingFile}
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
									{@html renderMarkdown(editorContent || '*Catatan masih kosong...*')}
								</div>
							</Card>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Bottom Navigation: Prev & Next Catatan -->
			<div class="border-t border-border/70 pt-6">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#if data.prevArticle}
						<a
							href="/my-docs/{data.prevArticle.slug}"
							class="group flex items-center gap-3 rounded-xl border border-border/80 bg-card/60 p-3.5 text-left transition-all hover:bg-muted/60"
						>
							<ArrowLeft class="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1 shrink-0" />
							<div class="flex-1 truncate">
								<div class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Catatan Sebelumnya</div>
								<div class="text-xs font-medium text-foreground truncate mt-0.5">{data.prevArticle.title}</div>
							</div>
						</a>
					{:else}
						<div></div>
					{/if}

					{#if data.nextArticle}
						<a
							href="/my-docs/{data.nextArticle.slug}"
							class="group flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 p-3.5 text-right transition-all hover:bg-muted/60"
						>
							<div class="flex-1 truncate">
								<div class="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Catatan Selanjutnya</div>
								<div class="text-xs font-medium text-foreground truncate mt-0.5">{data.nextArticle.title}</div>
							</div>
							<ArrowRight class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0" />
						</a>
					{/if}
				</div>
			</div>
		</div>

		<!-- RIGHT OUTLINE: Table of Contents (Identical width & placement to /docs) -->
		{#if !isFocusMode && outlineTree.length > 0}
			<aside class="hidden xl:block w-52 shrink-0">
				<div class="sticky top-20 space-y-4">
					<div class="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
						Daftar Isi Catatan
					</div>
					<DocsRightOutline
						{outlineTree}
						{activeHeadingId}
						onSelectHeading={scrollToHeading}
					/>
				</div>
			</aside>
		{/if}
	</div>
</div>

<!-- Alert Dialog: Konfirmasi Hapus Catatan / Folder -->
<AlertDialog bind:open={deleteTarget.open}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<div class="flex items-center gap-2 text-destructive">
				<Trash2 class="h-5 w-5" />
				<AlertDialogTitle>
					{deleteTarget.isFolder ? 'Hapus Folder Catatan?' : 'Hapus Catatan?'}
				</AlertDialogTitle>
			</div>
			<AlertDialogDescription>
				{#if deleteTarget.isFolder}
					Apakah Anda yakin ingin menghapus folder <strong>"{deleteTarget.title}"</strong> beserta seluruh catatan di dalamnya? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
				{:else}
					Apakah Anda yakin ingin menghapus catatan <strong>"{deleteTarget.title}"</strong>? Berkas ini akan dihapus dari storage catatan pribadi Anda.
				{/if}
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (deleteTarget.open = false)}>Batal</AlertDialogCancel>
			<AlertDialogAction
				variant="destructive"
				disabled={deleteTarget.isDeleting}
				onclick={confirmDeleteAction}
			>
				{#if deleteTarget.isDeleting}
					<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
					<span>Menghapus...</span>
				{:else}
					<span>Hapus Permanen</span>
				{/if}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- Lightbox Zoom Image -->
{#if lightboxSrc}
	<DocsLightbox
		src={lightboxSrc}
		alt={lightboxAlt}
		onClose={() => (lightboxSrc = null)}
	/>
{/if}

<!-- Context Menu (Right-Click) -->
<DocsContextMenu
	open={contextMenu.open}
	x={contextMenu.x}
	y={contextMenu.y}
	targetDoc={contextMenu.targetDoc}
	onEdit={handleContextMenuEdit}
	onCreate={handleContextMenuCreate}
	onCreateFolder={handleContextMenuCreateFolder}
	onRename={handleContextMenuRename}
	onDuplicate={handleContextMenuDuplicate}
	onAskAi={handleContextMenuAi}
	onCopyLink={handleContextMenuCopyLink}
	onCopyMarkdown={handleContextMenuCopyMarkdown}
	onDownload={handleContextMenuDownload}
	onDelete={handleContextMenuDelete}
	onClose={closeContextMenu}
/>

<!-- Dedicated Single-Document AI Assistant Modal (Fokus Dokumen yang Dibuka) -->
<DocAiAssistantModal
	bind:isOpen={isDocAiOpen}
	doc={docAiTarget || {
		...currentDoc,
		section: 'My Docs',
		category: currentDoc.category || 'Catatan Pribadi',
		content: editorContent || currentDoc.content || ''
	}}
	initialPrompt={docAiInitialPrompt}
	onPinToArticle={(content, title) => {
		const snippet = `\n\n> [!NOTE] ${title}\n> ${content.replace(/\n/g, '\n> ')}\n\n`;
		if (viewMode === 'view') {
			viewMode = 'split';
		}
		editorContent = (editorContent || currentDoc.content || '') + snippet;
		showToast('✓ Rangkuman AI disisipkan ke catatan');
	}}
/>
