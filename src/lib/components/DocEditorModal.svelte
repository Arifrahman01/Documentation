<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import * as Card from '$lib/components/ui/card';
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
	import { renderMarkdown } from '$lib/utils/markdown';
	import {
		DOC_TEMPLATES,
		MARKDOWN_TABLE_SNIPPET,
		MARKDOWN_CHECKLIST_SNIPPET,
		type DocTemplate
	} from '$lib/utils/docTemplates';
	import {
		X,
		Sparkles,
		Save,
		Eye,
		Edit3,
		Columns2,
		Wand2,
		Code,
		List,
		Heading2,
		Heading3,
		Bold,
		Italic,
		AlertCircle,
		CheckCircle2,
		Loader2,
		Image as ImageIcon,
		Link as LinkIcon,
		Table,
		CheckSquare,
		FileUp,
		RotateCcw,
		LayoutTemplate,
		Folder,
		FolderOpen
	} from '@lucide/svelte';

	interface DocumentItem {
		id?: string;
		slug?: string;
		section?: 'SAP' | 'SAC' | 'WEB';
		title: string;
		category: string;
		subcategory?: string;
		description?: string;
		snippet?: string;
		content: string;
		tags?: string[];
		sacUrl?: string;
	}

	const SECTION_CATEGORIES: Record<'SAP' | 'SAC' | 'WEB', string[]> = {
		SAP: ['Core Architecture', 'Integration & Development', 'Gateway Services', 'SAP Modules (FI/CO/MM/SD)', 'Customizing & Configuration'],
		SAC: ['Finance', 'Marketing', 'Operation Mining', 'Operation Marine', 'PnL by Segment', 'PM Mining', 'PM Marine', 'PnL by Trip', 'Overview & BI'],
		WEB: ['Web Stack', 'API & Backend', 'Security', 'Frontend Essentials', 'Quality Assurance']
	};

	let {
		isOpen = $bindable(false),
		mode = 'create',
		initialDoc = null,
		onSave = (doc: DocumentItem) => {}
	}: {
		isOpen: boolean;
		mode: 'create' | 'edit';
		initialDoc?: DocumentItem | null;
		onSave?: (doc: DocumentItem) => void;
		categories?: string[];
	} = $props();

	let section = $state<'SAP' | 'SAC' | 'WEB'>('SAP');
	let title = $state('');
	let category = $state('Core Architecture');
	let customCategory = $state('');
	let subcategory = $state('');
	let sacUrl = $state('');
	let description = $state('');
	let tagsString = $state('');
	let content = $state('');

	let activeTab = $state<'edit' | 'split' | 'preview'>('split');
	let aiPrompt = $state('');
	let isAiLoading = $state(false);
	let isSaving = $state(false);
	let aiSuccessMessage = $state('');
	let errorMessage = $state('');
	let aiUndoContent = $state<string | null>(null);
	let showMetadataEditor = $state(false);
	let debouncedPreview = $state('');

	let draftStorageKey = $derived(
		`portal_doc_draft_${mode}_${initialDoc?.slug || initialDoc?.id || 'new'}`
	);
	let availableDraft = $state<{
		title: string;
		section: 'SAP' | 'SAC' | 'WEB';
		category: string;
		subcategory?: string;
		sacUrl: string;
		description: string;
		tagsString: string;
		content: string;
		savedAt: string;
	} | null>(null);
	let lastAutoSavedAt = $state<string>('');
	let modalReadyForAutoSave = $state(false);
	let mdFileInputRef = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (isOpen) {
			modalReadyForAutoSave = false;
			lastAutoSavedAt = '';
			availableDraft = null;

			if (mode === 'edit' && initialDoc) {
				const inferredSec = (initialDoc.section || (initialDoc.slug?.startsWith('sac') ? 'SAC' : initialDoc.slug?.startsWith('sap') ? 'SAP' : 'WEB')) as 'SAP' | 'SAC' | 'WEB';
				section = inferredSec;
				title = initialDoc.title || '';
				category = initialDoc.category || SECTION_CATEGORIES[inferredSec][0];
				subcategory = initialDoc.subcategory || '';
				sacUrl = initialDoc.sacUrl || '';
				description = initialDoc.description || initialDoc.snippet || '';
				tagsString = (initialDoc.tags || []).join(', ');
				content = initialDoc.content || '';
			} else {
				const initSec = (initialDoc?.section || 'SAP') as 'SAP' | 'SAC' | 'WEB';
				section = ['SAP', 'SAC', 'WEB'].includes(initSec) ? initSec : 'SAP';
				title = initialDoc?.title || '';
				const availableCats = SECTION_CATEGORIES[section] || [];
				category = initialDoc?.category || availableCats[0] || 'General';
				customCategory = '';
				subcategory = initialDoc?.subcategory || '';
				sacUrl = initialDoc?.sacUrl || '';
				description = initialDoc?.description || initialDoc?.snippet || '';
				tagsString = initialDoc?.tags ? initialDoc.tags.join(', ') : '';
				content = initialDoc?.content || '';
			}
			activeTab = 'split';
			aiPrompt = '';
			errorMessage = '';
			aiSuccessMessage = '';
			aiUndoContent = null;
			showMetadataEditor = mode === 'create';

			if (typeof window !== 'undefined') {
				try {
					const rawDraft = localStorage.getItem(draftStorageKey);
					if (rawDraft) {
						const parsed = JSON.parse(rawDraft);
						if (
							parsed &&
							parsed.content &&
							parsed.content.trim() !== (initialDoc?.content || '').trim()
						) {
							availableDraft = parsed;
						}
					}
				} catch (_) {}
			}

			setTimeout(() => {
				modalReadyForAutoSave = true;
			}, 300);
		} else {
			modalReadyForAutoSave = false;
		}
	});

	$effect(() => {
		if (!isOpen || !modalReadyForAutoSave || typeof window === 'undefined') return;
		const currentTitle = title;
		const currentContent = content;
		const currentSection = section;
		const currentCategory = category;
		const currentSacUrl = sacUrl;
		const currentDesc = description;
		const currentTags = tagsString;

		if (!currentTitle.trim() && !currentContent.trim()) return;
		if (
			currentContent.trim() === (initialDoc?.content || '').trim() &&
			currentTitle.trim() === (initialDoc?.title || '').trim()
		) {
			return;
		}

		const timer = setTimeout(() => {
			try {
				const nowStr = new Date().toLocaleTimeString('id-ID', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				localStorage.setItem(
					draftStorageKey,
					JSON.stringify({
						title: currentTitle,
						section: currentSection,
						category: currentCategory,
						sacUrl: currentSacUrl,
						description: currentDesc,
						tagsString: currentTags,
						content: currentContent,
						savedAt: nowStr
					})
				);
				lastAutoSavedAt = nowStr;
			} catch (_) {}
		}, 700);

		return () => clearTimeout(timer);
	});

	function restoreDraft() {
		if (!availableDraft) return;
		section = availableDraft.section || section;
		title = availableDraft.title || title;
		category = availableDraft.category || category;
		subcategory = availableDraft.subcategory || '';
		sacUrl = availableDraft.sacUrl || '';
		description = availableDraft.description || '';
		tagsString = availableDraft.tagsString || '';
		content = availableDraft.content || '';
		aiSuccessMessage = `Draft dari pukul ${availableDraft.savedAt} berhasil dipulihkan.`;
		availableDraft = null;
	}

	function discardDraft() {
		availableDraft = null;
		if (typeof window !== 'undefined') {
			try {
				localStorage.removeItem(draftStorageKey);
			} catch (_) {}
		}
	}

	let templateConfirm = $state<{
		open: boolean;
		tpl: DocTemplate | null;
	}>({
		open: false,
		tpl: null
	});

	function applyTemplate(tpl: DocTemplate) {
		if (content.trim() && content.trim().length > 40) {
			templateConfirm = {
				open: true,
				tpl
			};
			return;
		}
		executeApplyTemplate(tpl);
	}

	function executeApplyTemplate(tpl: DocTemplate) {
		if (!title.trim()) {
			title = tpl.defaultTitle;
		}
		content = tpl.content;
		aiSuccessMessage = `Kerangka "${tpl.name}" siap diisi.`;
		templateConfirm.open = false;
	}

	async function importMarkdownFile(file: File) {
		try {
			const text = await file.text();
			if (!text.trim()) return;

			let importedBody = text;
			const h1Match = importedBody.match(/^#\s+(.+)$/m);
			if (!title.trim()) {
				if (h1Match) {
					title = h1Match[1].trim();
				} else {
					title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
				}
			}
			content = content.trim() ? `${content}\n\n${importedBody}` : importedBody;
			aiSuccessMessage = `File "${file.name}" berhasil diimpor ke dalam editor.`;
		} catch (err: any) {
			errorMessage = 'Gagal membaca file: ' + (err.message || 'Format tidak didukung');
		}
	}

	function handleMdFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			importMarkdownFile(target.files[0]);
			target.value = '';
		}
	}

	$effect(() => {
		if (!isOpen || activeTab === 'edit') return;
		const currentText = content;
		const timer = setTimeout(() => {
			debouncedPreview = currentText
				? renderMarkdown(currentText)
				: '<p class="text-muted-foreground italic">Konten dokumen masih kosong. Mulai menulis atau gunakan generator AI.</p>';
		}, 160);
		return () => clearTimeout(timer);
	});

	function undoAiAction() {
		if (aiUndoContent === null) return;
		content = aiUndoContent;
		aiUndoContent = null;
		aiSuccessMessage = 'Perubahan AI berhasil diurungkan (dikembalikan ke teks sebelumnya).';
	}

	function insertSnippet(before: string, after: string = '', defaultPlaceholder: string = '') {
		const textarea = document.getElementById('doc-editor-textarea') as HTMLTextAreaElement | null;
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = content.substring(start, end);
		const contentToWrap = selected || defaultPlaceholder;
		const replacement = before + contentToWrap + after;
		content = content.substring(0, start) + replacement + content.substring(end);
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + before.length, start + before.length + contentToWrap.length);
		}, 10);
	}

	let fileInputRef = $state<HTMLInputElement | null>(null);
	let isUploadingImage = $state(false);

	async function uploadAndInsertImage(file: File) {
		isUploadingImage = true;
		const cleanFileName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'gambar';
		const placeholder = `\n![Mengunggah ${cleanFileName}...]()\n`;
		insertSnippet(placeholder, '');

		try {
			const reader = new FileReader();
			const base64Promise = new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
			});
			reader.readAsDataURL(file);
			const base64 = await base64Promise;

			const res = await fetch('/api/upload-image', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					filename: file.name || 'screenshot.png',
					data: base64
				})
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				throw new Error(errBody.error || `HTTP ${res.status}: Gagal mengunggah gambar`);
			}

			const data = await res.json();
			if (data.url) {
				const imageMd = `\n![${cleanFileName}](${data.url})\n`;
				content = content.replace(placeholder, imageMd);
			} else {
				throw new Error('Respon server tidak memuat URL gambar');
			}
		} catch (err: any) {
			content = content.replace(placeholder, `\n<!-- Gagal mengunggah gambar: ${err.message} -->\n`);
			errorMessage = 'Gagal mengunggah gambar: ' + (err.message || 'Unknown error');
		} finally {
			isUploadingImage = false;
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.indexOf('image') !== -1) {
				const file = item.getAsFile();
				if (file) {
					e.preventDefault();
					uploadAndInsertImage(file);
					return;
				}
			}
		}
	}

	function handleDrop(e: DragEvent) {
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (file.type.startsWith('image/')) {
			e.preventDefault();
			uploadAndInsertImage(file);
		} else if (
			file.name.endsWith('.md') ||
			file.name.endsWith('.txt') ||
			file.type === 'text/markdown' ||
			file.type === 'text/plain'
		) {
			e.preventDefault();
			importMarkdownFile(file);
		}
	}

	function handleFileInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			uploadAndInsertImage(files[0]);
			target.value = '';
		}
	}

	function promptInsertImageUrl() {
		const url = window.prompt('Masukkan URL Gambar (atau path lokal seperti /img/nama.png):', '/img/');
		if (url) {
			const desc = window.prompt('Masukkan deskripsi gambar (alt text):', 'Ilustrasi / Diagram') || 'Gambar';
			insertSnippet(`\n![${desc}](${url})\n`, '');
		}
	}

	async function runAiAction(action: 'generate' | 'improve' | 'code' | 'summarize' | 'format') {
		isAiLoading = true;
		errorMessage = '';
		aiSuccessMessage = '';

		try {
			const effectivePrompt = aiPrompt.trim() || title.trim() || `Dokumentasi Sistem ${section}`;

			const res = await fetch('/api/ai/doc-assist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action,
					prompt: effectivePrompt,
					section,
					currentDoc: {
						title,
						section,
						category: category === 'custom' ? customCategory : category,
						content,
						description
					}
				})
			});

			if (!res.ok) {
				throw new Error(`Server returned HTTP ${res.status}`);
			}

			const data = await res.json();
			if (!data.success) {
				throw new Error(data.error || 'Gagal memproses bantuan AI');
			}

			if (action !== 'summarize') {
				aiUndoContent = content;
			}

			if (action === 'generate') {
				const generated = data.result;
				if (!title.trim() && generated.title) title = generated.title;
				if (generated.description) description = generated.description;
				if (generated.tags) tagsString = Array.isArray(generated.tags) ? generated.tags.join(', ') : generated.tags;
				if (generated.content) content = generated.content;
				aiSuccessMessage = `Dokumen bagian [${section}] berhasil dibuat oleh AI.`;
			} else if (action === 'improve') {
				content = data.result;
				aiSuccessMessage = 'Konten dokumen berhasil disempurnakan oleh AI.';
			} else if (action === 'format') {
				content = data.result;
				aiSuccessMessage = 'Catatan mentah berhasil dirapikan menjadi format Markdown terstruktur.';
			} else if (action === 'code') {
				content = content + '\n\n' + data.result;
				aiSuccessMessage = 'Contoh kode implementasi telah ditambahkan oleh AI.';
			} else if (action === 'summarize') {
				description = data.result;
				aiSuccessMessage = 'Ringkasan eksekutif telah diperbarui oleh AI.';
			}
		} catch (err: any) {
			errorMessage = err.message || 'Kendala koneksi ke server AI';
		} finally {
			isAiLoading = false;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!title.trim() || !content.trim()) {
			errorMessage = 'Judul dan Konten dokumen tidak boleh kosong';
			return;
		}

		isSaving = true;
		errorMessage = '';

		const finalCategory = category === 'custom' ? (customCategory.trim() || 'General') : category;
		const finalSubcategory = subcategory.trim() || undefined;
		const finalTags = tagsString.split(',').map((t) => t.trim()).filter(Boolean);

		const payload = {
			title: title.trim(),
			section,
			category: finalCategory,
			subcategory: finalSubcategory,
			sacUrl: section === 'SAC' && sacUrl.trim() ? sacUrl.trim() : undefined,
			description: description.trim() || content.slice(0, 160).replace(/[#*`\n]/g, ' ').trim(),
			tags: finalTags.length > 0 ? finalTags : [section, finalCategory, ...(finalSubcategory ? [finalSubcategory] : [])],
			content: content.trim()
		};

		try {
			let res;
			if (mode === 'edit' && initialDoc?.slug) {
				res = await fetch(`/api/docs/${initialDoc.slug}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				res = await fetch('/api/docs', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			}

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: Gagal menyimpan dokumen`);
			}

			const json = await res.json();
			if (json.document) {
				if (typeof window !== 'undefined') {
					try {
						localStorage.removeItem(draftStorageKey);
					} catch (_) {}
				}
				onSave(json.document);
				isOpen = false;
			}
		} catch (err: any) {
			errorMessage = err.message || 'Gagal menyimpan ke server';
		} finally {
			isSaving = false;
		}
	}

	function closeModal(e?: Event) {
		if (e) {
			e.stopPropagation();
		}
		isOpen = false;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && isOpen) {
			closeModal(e);
		}
	}}
/>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModal(e);
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<Card.Root class="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-xl border border-border bg-background py-0 gap-0 shadow-2xl overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
						<Edit3 class="h-4 w-4" />
					</div>
					<div>
						<h2 class="text-base font-semibold text-foreground">
							{mode === 'edit' ? 'Edit Dokumen' : 'Tambah Dokumen Baru'}
						</h2>
						<p class="text-xs text-muted-foreground">
							Dokumentasi tersimpan langsung secara terstruktur dengan dukungan AI Writer.
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onpointerdown={(e) => e.stopPropagation()}
						onclick={closeModal}
						title="Tutup Modal (ESC)"
						aria-label="Tutup Modal"
						class="h-8 w-8 text-muted-foreground hover:text-foreground"
					>
						<X class="h-4 w-4 pointer-events-none" />
					</Button>
				</div>
			</div>

			<!-- AI Assistant Quick Prompt Bar -->
			<div class="px-6 py-3 border-b border-border bg-muted/30">
				<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
					<div class="flex items-center gap-2 shrink-0">
						<Badge variant="secondary" class="gap-1">
							<Sparkles class="h-3 w-3" />
							<span>AI Assistant</span>
						</Badge>
					</div>

					<Input
						type="text"
						bind:value={aiPrompt}
						placeholder="Ketik topik untuk dibuatkan AI (contoh: 'Panduan konfigurasi SAP OData v4 & CDS View')..."
						class="flex-1 h-8 text-xs"
						disabled={isAiLoading}
					/>

					<div class="flex items-center gap-1.5 shrink-0">
						<Button
							type="button"
							size="sm"
							variant="default"
							onclick={() => runAiAction('generate')}
							disabled={isAiLoading}
							class="h-8 gap-1.5 text-xs"
						>
							{#if isAiLoading}
								<Loader2 class="h-3.5 w-3.5 animate-spin" />
								<span>Memproses...</span>
							{:else}
								<Wand2 class="h-3.5 w-3.5" />
								<span>Tulis dengan AI</span>
							{/if}
						</Button>

						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => runAiAction('format')}
							disabled={isAiLoading || !content}
							title="Rapikan catatan mentah/kasar menjadi Markdown terstruktur tanpa mengubah isi fakta"
							class="h-8 gap-1 text-xs"
						>
							<Sparkles class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">Rapikan Format</span>
						</Button>

						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => runAiAction('improve')}
							disabled={isAiLoading || !content}
							class="h-8 gap-1 text-xs"
						>
							<Wand2 class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">Poles AI</span>
						</Button>

						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => runAiAction('code')}
							disabled={isAiLoading || !content}
							class="h-8 gap-1 text-xs"
						>
							<Code class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">+ Contoh Kode</span>
						</Button>
					</div>
				</div>

				{#if availableDraft}
					<div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground">
						<div class="flex items-center gap-1.5">
							<RotateCcw class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<span>
								Ditemukan <strong>draft otomatis belum disimpan</strong> dari pukul {availableDraft.savedAt} ({availableDraft.title || 'Tanpa Judul'}).
							</span>
						</div>
						<div class="flex items-center gap-1.5">
							<Button
								type="button"
								size="sm"
								onclick={restoreDraft}
								class="h-7 px-2.5 text-[11px]"
							>
								Pulihkan Draft
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={discardDraft}
								class="h-7 px-2 text-[11px]"
							>
								Abaikan
							</Button>
						</div>
					</div>
				{/if}

				{#if aiSuccessMessage}
					<div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground animate-in fade-in">
						<div class="flex items-center gap-1.5">
							<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground" />
							<span>{aiSuccessMessage}</span>
						</div>
						{#if aiUndoContent !== null}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={undoAiAction}
								class="h-6 px-2 text-[11px]"
							>
								Urungkan Perubahan AI (Undo)
							</Button>
						{/if}
					</div>
				{/if}
				{#if errorMessage}
					<div role="alert" class="mt-2 flex items-center gap-1.5 text-xs text-destructive animate-in fade-in">
						<AlertCircle class="h-3.5 w-3.5" />
						<span>{errorMessage}</span>
					</div>
				{/if}
			</div>

			<!-- Main Form Content Area -->
			<form onsubmit={handleSubmit} class="flex flex-col flex-1 overflow-hidden">
				<div class="flex-1 overflow-y-auto p-6 space-y-4">
					<!-- Context Badge, Metadata Selector & Note Title -->
					<div class="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
								<span class="font-semibold text-foreground">Lokasi File:</span>
								<Badge variant="secondary" class="text-[10px] font-bold">
									{section}
								</Badge>
								<span>/</span>
								<Badge variant="outline" class="gap-1 text-[10px]">
									<Folder class="h-2.5 w-2.5" />
									<span>{category === 'custom' ? customCategory || 'General' : category}</span>
								</Badge>
								{#if subcategory}
									<span>/</span>
									<Badge variant="outline" class="gap-1 text-[10px]">
										<FolderOpen class="h-2.5 w-2.5" />
										<span>{subcategory}</span>
									</Badge>
								{/if}
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => (showMetadataEditor = !showMetadataEditor)}
								class="h-6 px-2 text-[11px]"
							>
								{showMetadataEditor ? 'Sembunyikan Lokasi & Tag' : 'Ubah Lokasi / Kategori / Tag'}
							</Button>
						</div>

						{#if showMetadataEditor}
							<div class="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3 border-t border-border/60">
								<div class="space-y-1">
									<label for="doc-modal-section" class="text-[11px] font-medium text-muted-foreground">Modul Utama</label>
									<select
										id="doc-modal-section"
										bind:value={section}
										onchange={() => {
											const avail = SECTION_CATEGORIES[section] || [];
											if (avail.length > 0 && !avail.includes(category)) {
												category = avail[0];
											}
										}}
										class="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
									>
										<option value="SAP">SAP (ERP & S/4HANA)</option>
										<option value="SAC">SAC (Analytics Cloud)</option>
										<option value="WEB">WEB (Web & Architecture)</option>
									</select>
								</div>
								<div class="space-y-1">
									<label for="doc-modal-category" class="text-[11px] font-medium text-muted-foreground">Folder Kategori</label>
									<select
										id="doc-modal-category"
										bind:value={category}
										class="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
									>
										{#each SECTION_CATEGORIES[section] || [] as catOpt}
											<option value={catOpt}>{catOpt}</option>
										{/each}
										<option value="custom">+ Kategori Baru...</option>
									</select>
									{#if category === 'custom'}
										<Input
											type="text"
											aria-label="Nama kategori baru"
											bind:value={customCategory}
											placeholder="Ketik nama kategori..."
											class="mt-1 h-8 text-xs"
										/>
									{/if}
								</div>
								<div class="space-y-1">
									<label for="doc-modal-subcategory" class="text-[11px] font-medium text-muted-foreground">Sub-Folder (Opsional)</label>
									<Input
										id="doc-modal-subcategory"
										type="text"
										bind:value={subcategory}
										placeholder="Contoh: Modul MM / Procurement"
										class="h-8 text-xs"
									/>
								</div>
								<div class="space-y-1 sm:col-span-2">
									<label for="doc-modal-tags" class="text-[11px] font-medium text-muted-foreground">Tags (pisahkan dengan koma)</label>
									<Input
										id="doc-modal-tags"
										type="text"
										bind:value={tagsString}
										placeholder="SAP, BAPI, Integration..."
										class="h-8 text-xs"
									/>
								</div>
								<div class="space-y-1">
									<label for="doc-modal-sacurl" class="text-[11px] font-medium text-muted-foreground">URL Story SAC (Opsional)</label>
									<Input
										id="doc-modal-sacurl"
										type="url"
										bind:value={sacUrl}
										placeholder="https://..."
										class="h-8 text-xs"
									/>
								</div>
							</div>
						{/if}

						<div>
							<label for="doc-title" class="sr-only">Judul Catatan</label>
							<Input
								id="doc-title"
								type="text"
								bind:value={title}
								required
								placeholder="Judul Catatan..."
								class="h-9 text-sm font-bold"
							/>
						</div>
					</div>

					<!-- 1-Click Ready Templates Bar & Import File -->
					<div class="rounded-xl border border-border bg-muted/20 p-3">
						<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
								<LayoutTemplate class="h-3.5 w-3.5 text-muted-foreground" />
								<span>Template Pencatatan Cepat (1-Klik)</span>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => mdFileInputRef?.click()}
								class="h-7 gap-1.5 px-2.5 text-[11px]"
							>
								<FileUp class="h-3.5 w-3.5" />
								<span>Import File (.md / .txt)</span>
							</Button>
							<input
								type="file"
								bind:this={mdFileInputRef}
								accept=".md,.txt,text/markdown,text/plain"
								class="hidden"
								onchange={handleMdFileChange}
							/>
						</div>

						<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
							{#each DOC_TEMPLATES as tpl}
								<Button
									type="button"
									variant="outline"
									onclick={() => applyTemplate(tpl)}
									class="flex h-auto flex-col items-start p-2.5 text-left"
								>
									<div class="flex w-full items-center justify-between gap-1">
										<span class="text-[11px] font-bold text-foreground truncate">{tpl.name}</span>
										<Badge variant="secondary" class="px-1.5 py-0 text-[9px]">
											{tpl.badge}
										</Badge>
									</div>
									<span class="mt-0.5 line-clamp-1 text-[10px] font-normal text-muted-foreground">
										{tpl.description}
									</span>
								</Button>
							{/each}
						</div>
					</div>

					<!-- Editor & Preview Tabs with Toolbar -->
					<div class="space-y-2">
						<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
							<!-- Tab switch (Shadcn Tabs) -->
							<Tabs bind:value={activeTab} class="w-auto">
								<TabsList class="h-8 bg-muted/60 p-0.5">
									<TabsTrigger value="edit" class="gap-1.5 px-3 py-1 text-xs">
										<Edit3 class="h-3.5 w-3.5" />
										<span>Editor</span>
									</TabsTrigger>
									<TabsTrigger value="split" class="gap-1.5 px-3 py-1 text-xs">
										<Columns2 class="h-3.5 w-3.5" />
										<span>Split View</span>
									</TabsTrigger>
									<TabsTrigger value="preview" class="gap-1.5 px-3 py-1 text-xs">
										<Eye class="h-3.5 w-3.5" />
										<span>Live Preview</span>
									</TabsTrigger>
								</TabsList>
							</Tabs>

							<!-- Formatting Toolbar -->
							{#if activeTab !== 'preview'}
								<div class="flex flex-wrap items-center gap-0.5">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="Heading 2"
										onclick={() => insertSnippet('\n## ', '\n')}
										class="h-7 w-7"
									>
										<Heading2 class="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="Heading 3"
										onclick={() => insertSnippet('\n### ', '\n')}
										class="h-7 w-7"
									>
										<Heading3 class="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="Bold"
										onclick={() => insertSnippet('**', '**')}
										class="h-7 w-7"
									>
										<Bold class="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="Italic"
										onclick={() => insertSnippet('*', '*')}
										class="h-7 w-7"
									>
										<Italic class="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="List"
										onclick={() => insertSnippet('\n- ', '')}
										class="h-7 w-7"
									>
										<List class="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										title="Checklist Langkah Kerja"
										onclick={() => insertSnippet(MARKDOWN_CHECKLIST_SNIPPET, '')}
										class="h-7 gap-1 px-2 text-[11px]"
									>
										<CheckSquare class="h-3.5 w-3.5" />
										<span class="hidden md:inline">Checklist</span>
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										title="Sisipkan Tabel Markdown Otomatis"
										onclick={() => insertSnippet(MARKDOWN_TABLE_SNIPPET, '')}
										class="h-7 gap-1 px-2 text-[11px]"
									>
										<Table class="h-3.5 w-3.5" />
										<span class="hidden md:inline">Tabel</span>
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="Code Block"
										onclick={() => insertSnippet('\n```javascript\n', '\n```\n')}
										class="h-7 w-7"
									>
										<Code class="h-3.5 w-3.5" />
									</Button>
									<Separator orientation="vertical" class="mx-1 h-4" />
									<Button
										type="button"
										variant="outline"
										size="sm"
										title="Note Alert"
										onclick={() => insertSnippet('\n> [!NOTE]\n> ', '\n')}
										class="h-6 px-2 text-[10px]"
									>
										+ Note
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										title="Tip Alert"
										onclick={() => insertSnippet('\n> [!TIP]\n> ', '\n')}
										class="h-6 px-2 text-[10px]"
									>
										+ Tip
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										title="Warning Alert"
										onclick={() => insertSnippet('\n> [!WARNING]\n> ', '\n')}
										class="h-6 px-2 text-[10px]"
									>
										+ Warning
									</Button>
									<Separator orientation="vertical" class="mx-1 h-4" />
									<Button
										type="button"
										variant="outline"
										size="sm"
										title="Unggah Gambar dari Komputer"
										onclick={() => fileInputRef?.click()}
										disabled={isUploadingImage}
										class="h-7 gap-1 px-2 text-[11px]"
									>
										{#if isUploadingImage}
											<Loader2 class="h-3.5 w-3.5 animate-spin" />
											<span>Unggah...</span>
										{:else}
											<ImageIcon class="h-3.5 w-3.5" />
											<span>+ Gambar</span>
										{/if}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										title="Sisipkan URL / Link Gambar Luar"
										onclick={promptInsertImageUrl}
										class="h-7 w-7"
									>
										<LinkIcon class="h-3.5 w-3.5" />
									</Button>
								</div>
							{/if}
						</div>

						<input
							type="file"
							bind:this={fileInputRef}
							accept="image/*"
							class="hidden"
							onchange={handleFileInputChange}
						/>

						<!-- Editor Body -->
						{#if activeTab === 'edit'}
							<Textarea
								id="doc-editor-textarea"
								aria-label="Isi dokumentasi Markdown"
								bind:value={content}
								onpaste={handlePaste}
								ondrop={handleDrop}
								ondragover={(e) => e.preventDefault()}
								required
								rows={16}
								placeholder="Tuliskan isi dokumentasi di sini... Mendukung Markdown, Heading H2/H3, tabel, code block, dan alert [!NOTE] / [!TIP]."
								class="rounded-xl p-4 font-mono text-sm leading-relaxed shadow-inner"
							/>
							<div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground px-1 pt-0.5">
								<span>Tekan <strong class="text-foreground">Ctrl + V</strong> untuk langsung menempel screenshot gambar, atau seret (drag & drop) file ke editor.</span>
								{#if isUploadingImage}
									<span class="flex items-center gap-1 text-foreground font-semibold animate-pulse">
										<Loader2 class="h-3 w-3 animate-spin" /> Sedang mengunggah gambar...
									</span>
								{/if}
							</div>
						{:else if activeTab === 'split'}
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<div class="flex flex-col">
									<Textarea
										id="doc-editor-textarea"
										aria-label="Isi dokumentasi Markdown"
										bind:value={content}
										onpaste={handlePaste}
										ondrop={handleDrop}
										ondragover={(e) => e.preventDefault()}
										required
										rows={17}
										placeholder="Tuliskan isi dokumentasi di sini... Mendukung Markdown, Heading H2/H3, tabel, code block, dan alert [!NOTE] / [!TIP]."
										class="h-[420px] resize-none rounded-xl p-4 font-mono text-sm leading-relaxed shadow-inner"
									/>
								</div>
								<Card.Root class="h-[420px] overflow-y-auto p-5 py-5 gap-0 bg-muted/15 shadow-none">
									<div class="mb-3">
										<Badge variant="secondary" class="mb-1.5 text-[10px]">{category === 'custom' ? customCategory : category}</Badge>
										<h1 class="text-xl font-bold text-foreground">{title || 'Judul Dokumen'}</h1>
									</div>
									<Separator class="my-3" />
									<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
										{@html debouncedPreview}
									</div>
								</Card.Root>
							</div>
							<div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground px-1 pt-0.5">
								<span>Mode Split View Aktif: Ketik di kiri (mendukung <strong class="text-foreground">Ctrl + V</strong> paste gambar) dan lihat hasil secara real-time di kanan.</span>
								{#if isUploadingImage}
									<span class="flex items-center gap-1 text-foreground font-semibold animate-pulse">
										<Loader2 class="h-3 w-3 animate-spin" /> Sedang mengunggah gambar...
									</span>
								{/if}
							</div>
						{:else}
							<Card.Root class="min-h-[350px] max-h-[500px] overflow-y-auto p-6 py-6 gap-0 bg-muted/15 shadow-none">
								<div class="mb-4">
									<Badge variant="secondary" class="mb-2 text-[10px]">{category === 'custom' ? customCategory : category}</Badge>
									<h1 class="text-2xl font-bold text-foreground">{title || 'Judul Dokumen'}</h1>
									{#if description}
										<p class="mt-2 text-xs text-muted-foreground">{description}</p>
									{/if}
								</div>
								<Separator class="my-4" />
								<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
									{@html debouncedPreview}
								</div>
							</Card.Root>
						{/if}
					</div>
				</div>

				<!-- Footer Actions -->
				<div class="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
					<div class="flex items-center gap-3 text-xs text-muted-foreground">
						<span>Format tersimpan otomatis dalam basis data JSON.</span>
						{#if lastAutoSavedAt}
							<Badge variant="outline" class="gap-1 text-[11px] font-normal">
								<CheckCircle2 class="h-3 w-3" />
								<span>Draft tersimpan otomatis ({lastAutoSavedAt})</span>
							</Badge>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => (isOpen = false)}
							disabled={isSaving}
						>
							Batal
						</Button>

						<Button
							type="submit"
							size="sm"
							disabled={isSaving || isAiLoading}
							class="gap-1.5"
						>
							{#if isSaving}
								<Loader2 class="h-3.5 w-3.5 animate-spin" />
								<span>Menyimpan...</span>
							{:else}
								<Save class="h-3.5 w-3.5" />
								<span>{mode === 'edit' ? 'Simpan Perubahan' : 'Terbitkan Dokumen'}</span>
							{/if}
						</Button>
					</div>
				</div>
			</form>
		</Card.Root>
	</div>
{/if}

<!-- SHADCN ALERT DIALOG: Konfirmasi Terapkan Kerangka Template -->
<AlertDialog bind:open={templateConfirm.open}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Terapkan Template "{templateConfirm.tpl?.name}"?</AlertDialogTitle>
			<AlertDialogDescription>
				Tindakan ini akan mengganti isi catatan saat ini dengan kerangka template. Tulisan yang ada saat ini akan ditimpa.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (templateConfirm.open = false)}>Batal</AlertDialogCancel>
			<AlertDialogAction
				onclick={() => {
					if (templateConfirm.tpl) executeApplyTemplate(templateConfirm.tpl);
				}}
			>
				Terapkan Kerangka
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
