<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
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
		LayoutTemplate
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

	const SUBCATEGORY_SUGGESTIONS: Record<string, string[]> = {
		'Core Architecture': ['System Landscape', 'Database & HANA', 'Performance'],
		'Integration & Development': ['ABAP Report', 'RFC & BAPI', 'CDS Views', 'Enhancement & BAdI'],
		'Gateway Services': ['OData v2/v4', 'SAP Fiori', 'Cloud Connector'],
		'SAP Modules (FI/CO/MM/SD)': ['FI - Financial', 'CO - Controlling', 'MM - Material Management', 'SD - Sales & Distribution', 'PM - Plant Maintenance'],
		'Customizing & Configuration': ['SPRO Configuration', 'Authorization & Role', 'Transport Management'],
		'Finance': ['Profit & Loss', 'Balance Sheet & Cashflow', 'AP & AR', 'Financial Covenant'],
		'Marketing': ['Sales Volume', 'Contract & Shipment', 'Market Price'],
		'Operation Mining': ['OB Removal', 'Coal Getting', 'Hauling &barging', 'Fuel & Equipment'],
		'Operation Marine': ['Vessel & Tugboat', 'Trip & Tonnage', 'Fuel Consumption', 'Port & Demurrage'],
		'Web Stack': ['SvelteKit Core', 'State Management', 'Deployment'],
		'API & Backend': ['REST Endpoints', 'Middleware & Cache', 'AI Integration'],
		'Security': ['Authentication', 'Authorization & RBAC', 'API Security']
	};

	let {
		isOpen = $bindable(false),
		mode = 'create', // 'create' | 'edit'
		initialDoc = null,
		onSave = (doc: DocumentItem) => {},
		categories = ['Core Architecture', 'Integration & Development', 'Gateway Services', 'Stories & Visuals', 'Web Stack']
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

	// Auto-save Draft State
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

	function selectSection(sec: 'SAP' | 'SAC' | 'WEB') {
		section = sec;
		const available = SECTION_CATEGORIES[sec];
		if (!available.includes(category) && category !== 'custom') {
			category = available[0];
		}
	}

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
				// mode === 'create' (also supports Duplicating an existing doc if initialDoc has content/title)
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

			// Check if an unsaved draft exists in localStorage
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

	// Real-time Auto-Save Draft Effect
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
		aiSuccessMessage = `💾 Draft dari pukul ${availableDraft.savedAt} berhasil dipulihkan!`;
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

	function applyTemplate(tpl: DocTemplate) {
		if (content.trim() && content.trim().length > 40) {
			const replace = confirm(
				`Terapkan "${tpl.name}"?\nKlik OK untuk mengganti isi saat ini dengan kerangka template, atau Cancel untuk membatalkan.`
			);
			if (!replace) return;
		}
		if (!title.trim()) {
			title = tpl.defaultTitle;
		}
		content = tpl.content;
		aiSuccessMessage = `📋 Kerangka "${tpl.name}" siap diisi!`;
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
			aiSuccessMessage = `📂 File "${file.name}" berhasil diimpor ke dalam editor!`;
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

	const renderedPreview = $derived.by(() => {
		if (!content) return '<p class="text-zinc-400 italic">Konten dokumen masih kosong. Mulai menulis atau gunakan generator AI.</p>';
		return renderMarkdown(content);
	});

	function insertSnippet(before: string, after: string = '') {
		const textarea = document.getElementById('doc-editor-textarea') as HTMLTextAreaElement | null;
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = content.substring(start, end) || 'Teks';
		const replacement = before + selected + after;
		content = content.substring(0, start) + replacement + content.substring(end);
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
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

			if (action === 'generate') {
				const generated = data.result;
				if (!title.trim() && generated.title) title = generated.title;
				if (generated.description) description = generated.description;
				if (generated.tags) tagsString = Array.isArray(generated.tags) ? generated.tags.join(', ') : generated.tags;
				if (generated.content) content = generated.content;
				aiSuccessMessage = `✨ Dokumen bagian [${section}] berhasil di-generate secara lengkap oleh AI!`;
			} else if (action === 'improve') {
				content = data.result;
				aiSuccessMessage = '✨ Konten dokumen berhasil disempurnakan dan dirapikan oleh AI!';
			} else if (action === 'format') {
				content = data.result;
				aiSuccessMessage = '✨ Catatan mentah berhasil dirapikan menjadi format Markdown terstruktur!';
			} else if (action === 'code') {
				content = content + '\n\n' + data.result;
				aiSuccessMessage = '✨ Contoh kode implementasi telah ditambahkan oleh AI!';
			} else if (action === 'summarize') {
				description = data.result;
				aiSuccessMessage = '✨ Ringkasan eksekutif telah diperbarui oleh AI!';
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
		<div
			class="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-950"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
						<Edit3 class="h-4 w-4" />
					</div>
					<div>
						<h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
							{mode === 'edit' ? 'Edit Dokumen' : 'Tambah Dokumen Baru'}
						</h2>
						<p class="text-xs text-zinc-500 dark:text-zinc-400">
							Dokumentasi tersimpan langsung secara terstruktur dengan dukungan AI Writer.
						</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onpointerdown={(e) => e.stopPropagation()}
						onclick={closeModal}
						title="Tutup Modal (ESC)"
						aria-label="Tutup Modal"
						class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/15 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
					>
						<X class="h-4 w-4 pointer-events-none" />
					</button>
				</div>
			</div>

			<!-- AI Assistant Quick Prompt Bar -->
			<div class="px-6 py-3 border-b border-zinc-200/80 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-pink-50/30 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-zinc-900">
				<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
					<div class="flex items-center gap-2 shrink-0">
						<Badge variant="secondary" class="gap-1 border-indigo-200 bg-indigo-100/70 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
							<Sparkles class="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
							<span>AI Assistant</span>
						</Badge>
					</div>

					<Input
						type="text"
						bind:value={aiPrompt}
						placeholder="Ketik topik untuk dibuatkan AI (contoh: 'Panduan konfigurasi SAP OData v4 & CDS View')..."
						class="flex-1 h-8 border-indigo-200 bg-white/90 text-xs text-foreground placeholder:text-muted-foreground shadow-xs focus-visible:border-indigo-500 dark:border-indigo-900/60 dark:bg-zinc-900"
						disabled={isAiLoading}
					/>

					<div class="flex items-center gap-1.5 shrink-0">
						<Button
							type="button"
							size="sm"
							variant="default"
							onclick={() => runAiAction('generate')}
							disabled={isAiLoading}
							class="h-8 gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 text-xs shadow-xs"
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
							class="h-8 gap-1 text-xs border-indigo-200 text-indigo-800 hover:bg-indigo-100/60 dark:border-indigo-900 dark:text-indigo-300"
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
							class="h-8 gap-1 text-xs border-indigo-200 text-indigo-800 hover:bg-indigo-100/60 dark:border-indigo-900 dark:text-indigo-300"
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
							class="h-8 gap-1 text-xs border-indigo-200 text-indigo-800 hover:bg-indigo-100/60 dark:border-indigo-900 dark:text-indigo-300"
						>
							<Code class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">+ Contoh Kode</span>
						</Button>
					</div>
				</div>

				{#if availableDraft}
					<div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
						<div class="flex items-center gap-1.5">
							<RotateCcw class="h-3.5 w-3.5 shrink-0" />
							<span>
								Ditemukan <strong>draft otomatis belum disimpan</strong> dari pukul {availableDraft.savedAt} ({availableDraft.title || 'Tanpa Judul'}).
							</span>
						</div>
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								onclick={restoreDraft}
								class="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors"
							>
								Pulihkan Draft
							</button>
							<button
								type="button"
								onclick={discardDraft}
								class="rounded-md px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-500/15 dark:text-amber-300 transition-colors"
							>
								Abaikan
							</button>
						</div>
					</div>
				{/if}

				{#if aiSuccessMessage}
					<div class="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 animate-in fade-in">
						<CheckCircle2 class="h-3.5 w-3.5" />
						<span>{aiSuccessMessage}</span>
					</div>
				{/if}
				{#if errorMessage}
					<div class="mt-2 flex items-center gap-1.5 text-xs text-destructive animate-in fade-in">
						<AlertCircle class="h-3.5 w-3.5" />
						<span>{errorMessage}</span>
					</div>
				{/if}
			</div>

			<!-- Main Form Content Area (Obsidian Note Style: Lokasi Otomatis + Judul + Isi Konten Saja) -->
			<form onsubmit={handleSubmit} class="flex flex-col flex-1 overflow-hidden">
				<div class="flex-1 overflow-y-auto p-6 space-y-4">
					<!-- Automatic Context Badge & Note Title -->
					<div class="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex-1 space-y-1.5">
							<div class="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
								<span class="font-semibold text-foreground">Lokasi File Otomatis:</span>
								<Badge variant="secondary" class="text-[10px] font-bold">
									{section}
								</Badge>
								<span>/</span>
								<Badge variant="outline" class="text-[10px]">
									📁 {category === 'custom' ? customCategory || 'General' : category}
								</Badge>
								{#if subcategory}
									<span>/</span>
									<Badge variant="outline" class="text-[10px] border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
										📂 {subcategory}
									</Badge>
								{/if}
							</div>
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
					<div class="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
						<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
								<LayoutTemplate class="h-3.5 w-3.5 text-indigo-500" />
								<span>Template Pencatatan Cepat (1-Klik)</span>
							</div>
							<button
								type="button"
								onclick={() => mdFileInputRef?.click()}
								class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
							>
								<FileUp class="h-3.5 w-3.5 text-indigo-500" />
								<span>Import File (.md / .txt)</span>
							</button>
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
								<button
									type="button"
									onclick={() => applyTemplate(tpl)}
									class="flex flex-col items-start rounded-lg border border-zinc-200 bg-white p-2 text-left transition-all hover:border-indigo-500/60 hover:bg-indigo-50/30 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/20"
								>
									<div class="flex w-full items-center justify-between">
										<span class="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{tpl.name}</span>
										<span class="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
											{tpl.badge}
										</span>
									</div>
									<span class="mt-0.5 line-clamp-1 text-[10px] text-zinc-500 dark:text-zinc-400">
										{tpl.description}
									</span>
								</button>
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
								<div class="flex flex-wrap items-center gap-1 text-zinc-600 dark:text-zinc-300">
									<button
										type="button"
										title="Heading 2"
										onclick={() => insertSnippet('\n## ', '\n')}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<Heading2 class="h-4 w-4" />
									</button>
									<button
										type="button"
										title="Heading 3"
										onclick={() => insertSnippet('\n### ', '\n')}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<Heading3 class="h-4 w-4" />
									</button>
									<button
										type="button"
										title="Bold"
										onclick={() => insertSnippet('**', '**')}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<Bold class="h-4 w-4" />
									</button>
									<button
										type="button"
										title="Italic"
										onclick={() => insertSnippet('*', '*')}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<Italic class="h-4 w-4" />
									</button>
									<button
										type="button"
										title="List"
										onclick={() => insertSnippet('\n- ', '')}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<List class="h-4 w-4" />
									</button>
									<button
										type="button"
										title="Checklist Langkah Kerja"
										onclick={() => insertSnippet(MARKDOWN_CHECKLIST_SNIPPET, '')}
										class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<CheckSquare class="h-3.5 w-3.5 text-emerald-500" />
										<span class="hidden md:inline">Checklist</span>
									</button>
									<button
										type="button"
										title="Sisipkan Tabel Markdown Otomatis"
										onclick={() => insertSnippet(MARKDOWN_TABLE_SNIPPET, '')}
										class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<Table class="h-3.5 w-3.5 text-indigo-500" />
										<span class="hidden md:inline">Tabel</span>
									</button>
									<button
										type="button"
										title="Code Block"
										onclick={() => insertSnippet('\n```javascript\n', '\n```\n')}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									>
										<Code class="h-4 w-4" />
									</button>
									<Separator orientation="vertical" class="h-4" />
									<button
										type="button"
										title="Note Alert"
										onclick={() => insertSnippet('\n> [!NOTE]\n> ', '\n')}
										class="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
									>
										+ Note
									</button>
									<button
										type="button"
										title="Tip Alert"
										onclick={() => insertSnippet('\n> [!TIP]\n> ', '\n')}
										class="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
									>
										+ Tip
									</button>
									<button
										type="button"
										title="Warning Alert"
										onclick={() => insertSnippet('\n> [!WARNING]\n> ', '\n')}
										class="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
									>
										+ Warning
									</button>
									<Separator orientation="vertical" class="h-4" />
									<button
										type="button"
										title="Unggah Gambar dari Komputer"
										onclick={() => fileInputRef?.click()}
										disabled={isUploadingImage}
										class="flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
									>
										{#if isUploadingImage}
											<Loader2 class="h-3.5 w-3.5 animate-spin text-indigo-600" />
											<span class="text-[11px]">Unggah...</span>
										{:else}
											<ImageIcon class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
											<span class="text-[11px]">+ Gambar</span>
										{/if}
									</button>
									<button
										type="button"
										title="Sisipkan URL / Link Gambar Luar"
										onclick={promptInsertImageUrl}
										class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
									>
										<LinkIcon class="h-3.5 w-3.5" />
									</button>
								</div>
							{/if}
						</div>

						<!-- Hidden File Input for Image Upload -->
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
								bind:value={content}
								onpaste={handlePaste}
								ondrop={handleDrop}
								ondragover={(e) => e.preventDefault()}
								required
								rows={16}
								placeholder="Tuliskan isi dokumentasi di sini... Mendukung Markdown, Heading H2/H3, tabel, code block, dan alert [!NOTE] / [!TIP]."
								class="rounded-xl p-4 font-mono text-xs leading-relaxed shadow-inner"
							/>
							<div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground px-1 pt-0.5">
								<span>💡 Tips Gambar: Tekan <strong class="text-foreground">Ctrl + V</strong> untuk langsung paste screenshot, atau seret (drag & drop) file gambar ke editor.</span>
								{#if isUploadingImage}
									<span class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
										<Loader2 class="h-3 w-3 animate-spin" /> Sedang mengunggah gambar...
									</span>
								{/if}
							</div>
						{:else if activeTab === 'split'}
							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<div class="flex flex-col">
									<Textarea
										id="doc-editor-textarea"
										bind:value={content}
										onpaste={handlePaste}
										ondrop={handleDrop}
										ondragover={(e) => e.preventDefault()}
										required
										rows={17}
										placeholder="Tuliskan isi dokumentasi di sini... Mendukung Markdown, Heading H2/H3, tabel, code block, dan alert [!NOTE] / [!TIP]."
										class="h-[420px] resize-none rounded-xl p-4 font-mono text-xs leading-relaxed shadow-inner"
									/>
								</div>
								<div class="h-[420px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
									<div class="mb-3">
										<Badge variant="secondary" class="mb-1.5 text-[10px]">{category === 'custom' ? customCategory : category}</Badge>
										<h1 class="text-xl font-bold text-zinc-900 dark:text-white">{title || 'Judul Dokumen'}</h1>
									</div>
									<Separator class="my-3" />
									<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
										{@html renderedPreview}
									</div>
								</div>
							</div>
							<div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 px-1 pt-0.5">
								<span>💡 Mode Split View Aktif: Ketik di kiri (mendukung <strong class="text-zinc-700 dark:text-zinc-200">Ctrl + V</strong> paste gambar) dan lihat hasil secara real-time di kanan.</span>
								{#if isUploadingImage}
									<span class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
										<Loader2 class="h-3 w-3 animate-spin" /> Sedang mengunggah gambar...
									</span>
								{/if}
							</div>
						{:else}
							<div class="min-h-[350px] max-h-[500px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
								<div class="mb-4">
									<Badge variant="secondary" class="mb-2 text-[10px]">{category === 'custom' ? customCategory : category}</Badge>
									<h1 class="text-2xl font-bold text-zinc-900 dark:text-white">{title || 'Judul Dokumen'}</h1>
									{#if description}
										<p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
									{/if}
								</div>
								<Separator class="my-4" />
								<div class="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed">
									{@html renderedPreview}
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Footer Actions -->
				<div class="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
					<div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
						<span>Format tersimpan otomatis dalam basis data JSON.</span>
						{#if lastAutoSavedAt}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
								<CheckCircle2 class="h-3 w-3" />
								<span>Draft tersimpan otomatis ({lastAutoSavedAt})</span>
							</span>
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
							class="gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
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
		</div>
	</div>
{/if}
