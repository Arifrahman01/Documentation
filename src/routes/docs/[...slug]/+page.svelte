<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import DocAiAssistantModal from '$lib/components/docs/DocAiAssistantModal.svelte';
	import DocsContextMenu from '$lib/components/docs/DocsContextMenu.svelte';
	import DocsLightbox from '$lib/components/docs/DocsLightbox.svelte';
	import DocsRightOutline from '$lib/components/docs/DocsRightOutline.svelte';
	import { renderMarkdown, extractOutlineTree, slugifyHeading } from '$lib/utils/markdown';
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
		Plus,
		Search,
		ExternalLink,
		ChevronDown,
		X,
		MoreHorizontal,
		Edit3,
		Save,
		Code,
		List,
		Heading2,
		Bold,
		Table,
		CheckSquare,
		Image as ImageIcon,
		FileUp,
		Loader2
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

	// Focus mode & Outline Scroll-spy
	let isFocusMode = $state(false);
	let activeHeadingId = $state<string>('');

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

	// Tab switcher between FSD (Konsultan) and Story Builder Spec (Tim Internal)
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
		inlineStatusMsg = `Kerangka "${tpl.name}" diterapkan`;
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
				inlineStatusMsg = 'Draft catatan berhasil ditulis oleh AI';
			} else if (action === 'format') {
				inlineContent = d.result?.content || inlineContent;
				inlineStatusMsg = 'Catatan berhasil dirapikan ke format Markdown';
			} else if (action === 'improve') {
				inlineContent = d.result?.content || inlineContent;
				inlineStatusMsg = 'Isi catatan berhasil dipoles oleh AI';
			} else if (action === 'code') {
				inlineContent = `${inlineContent.trim()}\n\n${d.result?.content || ''}`;
				inlineStatusMsg = 'Contoh blok kode berhasil ditambahkan';
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
			inlineStatusMsg = 'Gambar berhasil disisipkan';
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

	// Outline & Markdown Rendering (reactively adapts to active tab: FSD vs Story Builder Spec)
	const activeMarkdownContent = $derived(
		activeDocTab === 'builder' && currentDoc?.builderContent
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
					if (isInlineEditing && !typing) isInlineEditing = false;
					return;
				}

				// Ctrl+S: Save active inline note
				if (hasCmdOrCtrl && (key === 's' || code === 'KeyS') && isInlineEditing) {
					e.preventDefault();
					e.stopPropagation();
					saveInlineNote(false);
					return;
				}

				// Ctrl+E / Alt+E (or 'e' when not typing in an input): Edit current note
				if (
					((hasCmdOrCtrl || hasAlt) && (key === 'e' || code === 'KeyE')) ||
					(!typing && !hasCmdOrCtrl && !hasAlt && !e.shiftKey && key === 'e' && !isEditorOpen && !isDocAiOpen && !ui.isAiOpen && !ui.isSearchOpen)
				) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						if (isInlineEditing && (hasCmdOrCtrl || hasAlt)) {
							saveInlineNote(true);
						} else if (!isInlineEditing) {
							startInlineEdit(currentDoc);
						}
					}
					return;
				}

				// Alt+N / Ctrl+M / Ctrl+N (or 'n' when not typing in an input): Create New Note File
				if (
					(hasAlt && (key === 'n' || code === 'KeyN')) ||
					(hasCmdOrCtrl && (key === 'm' || code === 'KeyM' || key === 'n' || code === 'KeyN')) ||
					(!typing && !hasCmdOrCtrl && !hasAlt && !e.shiftKey && key === 'n' && !isEditorOpen && !isDocAiOpen && !ui.isAiOpen && !ui.isSearchOpen)
				) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						openExplorerCreateFile(currentDoc);
					}
					return;
				}

				// Alt+F (or 'f' when not typing in an input): Create New Folder
				if (
					(hasAlt && (key === 'f' || code === 'KeyF')) ||
					(!typing && !hasCmdOrCtrl && !hasAlt && !e.shiftKey && key === 'f' && !isEditorOpen && !isDocAiOpen && !ui.isAiOpen && !ui.isSearchOpen)
				) {
					if (!isEditorOpen) {
						e.preventDefault();
						e.stopPropagation();
						openExplorerCreateFolder(currentDoc);
					}
					return;
				}

				// Ctrl+I / Alt+I (or 'i' when not typing in an input): Open/Toggle Document AI Assistant Modal
				if (
					((hasCmdOrCtrl || hasAlt) && (key === 'i' || code === 'KeyI')) ||
					(!typing && !hasCmdOrCtrl && !hasAlt && !e.shiftKey && key === 'i' && !isEditorOpen && !ui.isAiOpen && !ui.isSearchOpen)
				) {
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
		}
	}

	function handleContextMenuCopyMarkdown(target: any) {
		closeContextMenu();
		const t = target || currentDoc;
		if (t.content && typeof window !== 'undefined') {
			navigator.clipboard.writeText(t.content);
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
	<!-- CLEAN WORKSPACE: SIDEBAR EXPLORER + NOTE CANVAS + OUTLINE -->
	<!-- ======================================================== -->
	<div class="flex gap-10 py-8">
		<!-- LEFT SIDEBAR: MINIMAL FILE EXPLORER -->
		{#if !isFocusMode}
			<aside class="hidden lg:block w-64 shrink-0 border-r border-border/60 pr-5">
				<div
					class="sticky top-20 space-y-3"
					oncontextmenu={(e) => openContextMenu(e, null)}
					role="region"
					aria-label="File Explorer"
				>
					<!-- Explorer Top Header: Section Title + Create File / Create Folder (100% Shadcn) -->
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-foreground">
							Folder {activeSection === 'ALL' ? 'Dokumen' : activeSection}
						</span>
						<div class="flex items-center gap-1">
							<Button
								variant="outline"
								size="sm"
								title="Buat File Catatan Baru (Ctrl+N)"
								onclick={() => openExplorerCreateFile()}
								class="h-7 gap-1 px-2 text-xs"
							>
								<FilePlus class="h-3.5 w-3.5" />
								<span>File</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								title="Buat Folder Baru"
								onclick={() => openExplorerCreateFolder()}
								class="h-7 gap-1 px-2 text-xs"
							>
								<FolderPlus class="h-3.5 w-3.5" />
								<span>Folder</span>
							</Button>
						</div>
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

								{#if explorerCreator.type === 'file'}
									<select
										bind:value={explorerCreator.category}
										class="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none"
									>
										{#each currentTree.filter((g: any) => (g.section || 'SAP') === explorerCreator.section) as folderGroup}
											<option value={folderGroup.title}>{folderGroup.title}</option>
										{/each}
									</select>
								{/if}

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
								class="group/folder"
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

									<div class="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity shrink-0">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											title="Buat File di folder {group.title}"
											onclick={(e) => {
												e.stopPropagation();
												openExplorerCreateFile({
													section: group.section,
													category: group.title
												});
											}}
											class="h-5 w-5 text-muted-foreground hover:text-foreground"
										>
											<Plus class="h-3 w-3" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											title="Buat Sub-Folder di {group.title}"
											onclick={(e) => {
												e.stopPropagation();
												openExplorerCreateFolder({
													isFolder: true,
													section: group.section,
													category: group.title
												});
											}}
											class="h-5 w-5 text-muted-foreground hover:text-foreground"
										>
											<FolderPlus class="h-3 w-3" />
										</Button>
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
													<Button
														type="button"
														variant="ghost"
														size="icon"
														title="Buat File di {subGroup.title}"
														onclick={() =>
															openExplorerCreateFile({
																section: group.section,
																category: group.title,
																subcategory: subGroup.title
															})}
														class="opacity-0 group-hover/sub:opacity-100 h-5 w-5 text-muted-foreground hover:text-foreground"
													>
														<Plus class="h-3 w-3" />
													</Button>
												</div>

												{#if subExpanded}
													<div class="space-y-0.5 pl-3 ml-2 border-l border-border/50 py-0.5">
														{#each subGroup.nodes as node}
															{@const isCurrent = node.path === data.slug || node.slug === data.slug}
															<a
																href="/docs/{node.path}"
																oncontextmenu={(e) => openContextMenu(e, node)}
																class="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors {isCurrent
																	? 'bg-secondary font-semibold text-secondary-foreground'
																	: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
															>
																<FileText class="h-3 w-3 opacity-60 shrink-0" />
																<span class="truncate">{node.title}</span>
															</a>
														{/each}
														{#if subGroup.nodes.length === 0}
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onclick={() =>
																	openExplorerCreateFile({
																		section: group.section,
																		category: group.title,
																		subcategory: subGroup.title
																	})}
																class="h-6 w-full justify-start px-2 text-[11px] text-muted-foreground"
															>
																<Plus class="h-3 w-3 mr-1" />
																<span>Buat file</span>
															</Button>
														{/if}
													</div>
												{/if}
											</div>
										{/each}

										<!-- Direct Files in Folder -->
										{#each group.directNodes || group.nodes as node}
											{@const isCurrent = node.path === data.slug || node.slug === data.slug}
											<a
												href="/docs/{node.path}"
												oncontextmenu={(e) => openContextMenu(e, node)}
												class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors {isCurrent
													? 'bg-secondary font-semibold text-secondary-foreground'
													: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
											>
												<FileText class="h-3.5 w-3.5 opacity-60 shrink-0" />
												<span class="truncate">{node.title}</span>
											</a>
										{/each}

										{#if (group.directNodes || group.nodes).length === 0 && (group.subcategories || []).length === 0}
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() =>
													openExplorerCreateFile({
														section: group.section,
														category: group.title
													})}
												class="h-6 w-full justify-start px-2 text-[11px] text-muted-foreground"
											>
												<Plus class="h-3 w-3 mr-1" />
												<span>Buat file</span>
											</Button>
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
			class="min-w-0 flex-1 max-w-3xl"
			oncontextmenu={(e) => openContextMenu(e, currentDoc)}
			onclick={handleArticleClick}
			ondblclick={handleArticleDblClick}
			role="article"
		>
			<!-- Single Quiet Top Bar: Folder Path on Left, Clean Shadcn Buttons on Right -->
			<div class="mb-6 flex items-center justify-between gap-2 text-xs text-muted-foreground">
				<div class="flex items-center gap-1.5 truncate">
					<Folder class="h-3.5 w-3.5 shrink-0" />
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
				</div>

				<div class="flex items-center gap-1.5 shrink-0">
					{#if currentDoc?.sacUrl}
						<Button
							href={currentDoc.sacUrl}
							target="_blank"
							rel="noopener noreferrer"
							variant="outline"
							size="sm"
							class="h-7 gap-1 px-2.5 text-xs"
						>
							<ExternalLink class="h-3 w-3" />
							<span>Story SAC</span>
						</Button>
					{/if}

					{#if isInlineEditing}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => (isInlineEditing = false)}
							class="h-7 px-2.5 text-xs"
						>
							Batal
						</Button>
						<Button
							type="button"
							variant="default"
							size="sm"
							disabled={isSavingInline}
							onclick={() => saveInlineNote(true)}
							class="h-7 gap-1.5 px-3 text-xs"
						>
							{#if isSavingInline}
								<Loader2 class="h-3 w-3 animate-spin" />
							{:else}
								<Save class="h-3 w-3" />
							{/if}
							<span>Simpan</span>
						</Button>
					{:else}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => startInlineEdit(currentDoc)}
							class="h-7 gap-1.5 px-2.5 text-xs"
						>
							<Edit3 class="h-3 w-3" />
							<span>Edit</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={askAiAboutDoc}
							class="h-7 gap-1.5 px-2.5 text-xs"
						>
							<Sparkles class="h-3 w-3" />
							<span>AI</span>
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							title="Opsi lainnya"
							onclick={(e) => openContextMenu(e, currentDoc)}
							class="h-7 w-7 text-muted-foreground hover:text-foreground"
						>
							<MoreHorizontal class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			</div>

			{#if isInlineEditing}
				<!-- ============================================================ -->
				<!-- CLEAN OBSIDIAN NOTE EDITOR (100% Shadcn Components)          -->
				<!-- ============================================================ -->
				<div class="space-y-3 animate-in fade-in duration-100">
					<Input
						type="text"
						bind:value={inlineTitle}
						placeholder="Judul catatan..."
						class="h-11 px-3 text-xl font-bold tracking-tight"
					/>

					{#if inlineErrorMsg}
						<div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{inlineErrorMsg}
						</div>
					{/if}

					<!-- Single Simple Toolbar Row Using Shadcn Buttons -->
					<div class="flex flex-wrap items-center justify-between gap-2 border-y border-border/60 py-1.5">
						<Tabs bind:value={inlineMode} class="w-auto">
							<TabsList class="h-7 p-0.5">
								<TabsTrigger value="edit" class="px-2.5 py-0.5 text-xs">Tulis</TabsTrigger>
								<TabsTrigger value="split" class="px-2.5 py-0.5 text-xs">Split</TabsTrigger>
								<TabsTrigger value="preview" class="px-2.5 py-0.5 text-xs">Preview</TabsTrigger>
							</TabsList>
						</Tabs>

						<div class="flex items-center gap-0.5">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="Heading"
								onclick={() => insertInlineSnippet('\n## ', '\n')}
								class="h-7 w-7"
							>
								<Heading2 class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="Bold"
								onclick={() => insertInlineSnippet('**', '**')}
								class="h-7 w-7"
							>
								<Bold class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="List"
								onclick={() => insertInlineSnippet('\n- ', '')}
								class="h-7 w-7"
							>
								<List class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="Checklist"
								onclick={() => insertInlineSnippet(MARKDOWN_CHECKLIST_SNIPPET, '')}
								class="h-7 w-7"
							>
								<CheckSquare class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="Tabel"
								onclick={() => insertInlineSnippet(MARKDOWN_TABLE_SNIPPET, '')}
								class="h-7 w-7"
							>
								<Table class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="Kode"
								onclick={() => insertInlineSnippet('\n```javascript\n', '\n```\n')}
								class="h-7 w-7"
							>
								<Code class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								title="Sisipkan Gambar (atau tekan Ctrl+V)"
								onclick={() => inlineImageInputRef?.click()}
								class="h-7 w-7"
							>
								<ImageIcon class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onclick={() => (showTemplateBar = !showTemplateBar)}
								class="ml-1 h-7 gap-1 px-2 text-xs"
							>
								<Sparkles class="h-3 w-3" />
								<span>Template & AI</span>
							</Button>
						</div>
					</div>

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

					{#if showTemplateBar}
						<Card class="p-3 space-y-2.5 shadow-2xs">
							<div class="flex flex-wrap gap-1.5">
								{#each DOC_TEMPLATES as tpl}
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => applyInlineTemplate(tpl)}
										class="h-7 px-2.5 text-xs"
									>
										{tpl.name}
									</Button>
								{/each}
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onclick={() => inlineMdInputRef?.click()}
									class="h-7 gap-1 px-2.5 text-xs"
								>
									<FileUp class="h-3 w-3" />
									<span>Import .md</span>
								</Button>
							</div>

							<div class="flex items-center gap-2">
								<Input
									type="text"
									bind:value={inlineAiPrompt}
									placeholder="Tulis topik untuk dibuatkan AI..."
									class="h-8 text-xs flex-1"
									disabled={isInlineAiLoading}
								/>
								<Button
									type="button"
									size="sm"
									disabled={isInlineAiLoading}
									onclick={() => runInlineAiAction('generate')}
									class="h-8 text-xs"
								>
									{isInlineAiLoading ? 'Memproses...' : 'Tulis AI'}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={isInlineAiLoading || !inlineContent}
									onclick={() => runInlineAiAction('format')}
									class="h-8 text-xs"
								>
									Rapikan
								</Button>
							</div>
						</Card>
					{/if}

					{#if inlineMode === 'edit'}
						<Textarea
							id="inline-note-textarea"
							bind:value={inlineContent}
							onpaste={handleInlinePaste}
							ondrop={handleInlineDrop}
							ondragover={(e) => e.preventDefault()}
							rows={22}
							placeholder="Mulai tulis catatan di sini..."
							class="min-h-[480px] rounded-xl p-4 font-mono text-xs leading-relaxed"
						/>
					{:else if inlineMode === 'split'}
						<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<Textarea
								id="inline-note-textarea"
								bind:value={inlineContent}
								onpaste={handleInlinePaste}
								ondrop={handleInlineDrop}
								ondragover={(e) => e.preventDefault()}
								rows={22}
								placeholder="Mulai tulis catatan di sini..."
								class="h-[480px] resize-none rounded-xl p-4 font-mono text-xs leading-relaxed"
							/>
							<Card class="h-[480px] overflow-y-auto p-5 shadow-none">
								<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
									{@html renderMarkdown(inlineContent || '*Pratinjau catatan...*')}
								</div>
							</Card>
						</div>
					{:else}
						<Card class="min-h-[420px] p-6 shadow-none">
							<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
								{@html renderMarkdown(inlineContent || '*Catatan masih kosong.*')}
							</div>
						</Card>
					{/if}
				</div>
			{:else}
				<!-- ============================================================ -->
				<!-- CLEAN READING VIEW (Just Title + Content, Zero Visual Noise) -->
				<!-- ============================================================ -->
				<h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
					{currentDoc?.title || data.article.title}
				</h1>

				{#if currentDoc?.builderContent}
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

				<article class="prose prose-zinc dark:prose-invert max-w-none leading-relaxed">
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
