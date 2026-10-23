<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { marked } from 'marked';
	import {
		X,
		Sparkles,
		Save,
		Eye,
		Edit3,
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
		RefreshCw,
		HelpCircle,
		Image as ImageIcon,
		Link as LinkIcon
	} from '@lucide/svelte';

	interface DocumentItem {
		id?: string;
		slug?: string;
		section?: 'SAP' | 'SAC' | 'WEB';
		title: string;
		category: string;
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
	let sacUrl = $state('');
	let description = $state('');
	let tagsString = $state('');
	let content = $state('');

	let activeTab = $state<'edit' | 'preview'>('edit');
	let aiPrompt = $state('');
	let isAiLoading = $state(false);
	let isSaving = $state(false);
	let aiSuccessMessage = $state('');
	let errorMessage = $state('');

	function selectSection(sec: 'SAP' | 'SAC' | 'WEB') {
		section = sec;
		const available = SECTION_CATEGORIES[sec];
		if (!available.includes(category) && category !== 'custom') {
			category = available[0];
		}
	}

	$effect(() => {
		if (isOpen) {
			if (mode === 'edit' && initialDoc) {
				const inferredSec = (initialDoc.section || (initialDoc.slug?.startsWith('sac') ? 'SAC' : initialDoc.slug?.startsWith('sap') ? 'SAP' : 'WEB')) as 'SAP' | 'SAC' | 'WEB';
				section = inferredSec;
				title = initialDoc.title || '';
				category = initialDoc.category || SECTION_CATEGORIES[inferredSec][0];
				sacUrl = initialDoc.sacUrl || '';
				description = initialDoc.description || initialDoc.snippet || '';
				tagsString = (initialDoc.tags || []).join(', ');
				content = initialDoc.content || '';
			} else {
				// mode === 'create'
				const initSec = (initialDoc?.section || 'SAP') as 'SAP' | 'SAC' | 'WEB';
				section = ['SAP', 'SAC', 'WEB'].includes(initSec) ? initSec : 'SAP';
				title = '';
				const availableCats = SECTION_CATEGORIES[section] || [];
				category = initialDoc?.category && availableCats.includes(initialDoc.category) 
					? initialDoc.category 
					: availableCats[0] || 'General';
				customCategory = '';
				sacUrl = '';
				description = '';
				tagsString = '';
				content = '';
			}
			activeTab = 'edit';
			aiPrompt = '';
			errorMessage = '';
			aiSuccessMessage = '';
		}
	});

	const renderedPreview = $derived.by(() => {
		if (!content) return '<p class="text-zinc-400 italic">Konten dokumen masih kosong. Mulai menulis atau gunakan generator AI.</p>';
		let raw = content;
		raw = raw.replace(/>\s*\[!NOTE\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-blue-500 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><strong>Note:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!TIP\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-emerald-500 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><strong>Tip:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!IMPORTANT\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-amber-500 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><strong>Important:</strong> $1</div>');
		raw = raw.replace(/>\s*\[!WARNING\]\s*(.*?)(?=(\n\n|\n>|$))/gs, '<div class="my-4 rounded-lg border-l-4 border-red-500 bg-red-50/60 p-3.5 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200"><strong>Warning:</strong> $1</div>');
		return marked.parse(raw);
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

	async function runAiAction(action: 'generate' | 'improve' | 'code' | 'summarize') {
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
				if (generated.section && ['SAP', 'SAC', 'WEB'].includes(generated.section.toUpperCase())) {
					section = generated.section.toUpperCase() as 'SAP' | 'SAC' | 'WEB';
				}
				if (generated.title) title = generated.title;
				if (generated.category) {
					category = generated.category;
				}
				if (generated.description) description = generated.description;
				if (generated.tags) tagsString = Array.isArray(generated.tags) ? generated.tags.join(', ') : generated.tags;
				if (generated.content) content = generated.content;
				aiSuccessMessage = `✨ Dokumen bagian [${section}] berhasil di-generate secara lengkap oleh AI!`;
			} else if (action === 'improve') {
				content = data.result;
				aiSuccessMessage = '✨ Konten dokumen berhasil disempurnakan dan dirapikan oleh AI!';
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
		const finalTags = tagsString.split(',').map((t) => t.trim()).filter(Boolean);

		const payload = {
			title: title.trim(),
			section,
			category: finalCategory,
			sacUrl: section === 'SAC' && sacUrl.trim() ? sacUrl.trim() : undefined,
			description: description.trim() || content.slice(0, 160).replace(/[#*`\n]/g, ' ').trim(),
			tags: finalTags.length > 0 ? finalTags : [section, finalCategory],
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
				onSave(json.document);
				isOpen = false;
			}
		} catch (err: any) {
			errorMessage = err.message || 'Gagal menyimpan ke server';
		} finally {
			isSaving = false;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
		<div
			class="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-950"
			role="dialog"
			aria-modal="true"
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
					<Button variant="ghost" size="icon" onclick={() => (isOpen = false)} class="h-8 w-8 rounded-lg">
						<X class="h-4 w-4" />
					</Button>
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

					<input
						type="text"
						bind:value={aiPrompt}
						placeholder="Ketik topik untuk dibuatkan AI (contoh: 'Panduan konfigurasi SAP OData v4 & CDS View')..."
						class="flex-1 rounded-lg border border-indigo-200 bg-white/90 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-indigo-900/60 dark:bg-zinc-900 dark:text-zinc-100"
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
							onclick={() => runAiAction('improve')}
							disabled={isAiLoading || !content}
							class="h-8 gap-1 text-xs border-indigo-200 text-indigo-800 hover:bg-indigo-100/60 dark:border-indigo-900 dark:text-indigo-300"
						>
							<Sparkles class="h-3.5 w-3.5" />
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

			<!-- Main Form Content Area -->
			<form onsubmit={handleSubmit} class="flex flex-col flex-1 overflow-hidden">
				<div class="flex-1 overflow-y-auto p-6 space-y-4">
					<!-- Section Selector Row (SAP / SAC / WEB) -->
					<div class="space-y-1.5">
						<span class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
							Bagian Utama (Section) <span class="text-destructive">*</span>
						</span>
						<div class="grid grid-cols-3 gap-2">
							<button
								type="button"
								onclick={() => selectSection('SAP')}
								class="flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-all {section === 'SAP'
									? 'border-blue-600 bg-blue-50/80 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-xs'
									: 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}"
							>
								<span class="text-sm">🏢</span>
								<span>SAP Enterprise</span>
							</button>
							<button
								type="button"
								onclick={() => selectSection('SAC')}
								class="flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-all {section === 'SAC'
									? 'border-purple-600 bg-purple-50/80 text-purple-700 dark:border-purple-500 dark:bg-purple-950/60 dark:text-purple-300 ring-2 ring-purple-500/20 shadow-xs'
									: 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}"
							>
								<span class="text-sm">📊</span>
								<span>SAC Analytics</span>
							</button>
							<button
								type="button"
								onclick={() => selectSection('WEB')}
								class="flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-all {section === 'WEB'
									? 'border-emerald-600 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
									: 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}"
							>
								<span class="text-sm">🌐</span>
								<span>WEB Stack</span>
							</button>
						</div>
					</div>

					<!-- Title & Category Row -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div class="sm:col-span-2 space-y-1.5">
							<label for="doc-title" class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
								Judul Dokumen <span class="text-destructive">*</span>
							</label>
							<input
								id="doc-title"
								type="text"
								bind:value={title}
								required
								placeholder="Contoh: Arsitektur SAP ERP & Integrasi S/4HANA"
								class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="doc-category" class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
								Kategori ({section})
							</label>
							<div class="flex gap-2">
								<select
									id="doc-category"
									bind:value={category}
									class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
								>
									{#each SECTION_CATEGORIES[section] as cat}
										<option value={cat}>{cat}</option>
									{/each}
									<option value="custom">+ Kategori Lainnya...</option>
								</select>
							</div>
							{#if category === 'custom'}
								<input
									type="text"
									bind:value={customCategory}
									placeholder="Nama kategori baru..."
									class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
								/>
							{/if}
						</div>
					</div>

					<!-- SAC Story Live Link (Only shown when Section is SAC) -->
					{#if section === 'SAC'}
						<div class="space-y-1.5 rounded-xl border border-purple-200/80 bg-purple-50/40 p-3 dark:border-purple-900/40 dark:bg-purple-950/20">
							<label for="doc-sac-url" class="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center justify-between">
								<span>Tautan Langsung Story SAC Production (URL)</span>
								<span class="text-[10px] font-normal text-purple-600 dark:text-purple-400">Tenant 6c653</span>
							</label>
							<input
								id="doc-sac-url"
								type="url"
								bind:value={sacUrl}
								placeholder="https://sacprod-jhonlin.ap11.analytics.cloud.sap/sap/fpa/ui/tenants/6c653/..."
								class="w-full rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-xs focus:border-purple-500 focus:outline-none dark:border-purple-900/60 dark:bg-zinc-900 dark:text-zinc-50 font-mono"
							/>
						</div>
					{/if}

					<!-- Description & Tags Row -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label for="doc-desc" class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
								Ringkasan Singkat / Deskripsi
							</label>
							<input
								id="doc-desc"
								type="text"
								bind:value={description}
								placeholder="Deskripsi 1-2 kalimat untuk preview dan pencarian..."
								class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="doc-tags" class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
								Tags (Pisahkan dengan koma)
							</label>
							<input
								id="doc-tags"
								type="text"
								bind:value={tagsString}
								placeholder="Architecture, MVC, Controller, Best Practice"
								class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 shadow-xs focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
							/>
						</div>
					</div>

					<!-- Editor & Preview Tabs with Toolbar -->
					<div class="space-y-2">
						<div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
							<!-- Tab switch -->
							<div class="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
								<button
									type="button"
									onclick={() => (activeTab = 'edit')}
									class="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all {activeTab === 'edit'
										? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
										: 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'}"
								>
									<Edit3 class="h-3.5 w-3.5" />
									<span>Editor</span>
								</button>
								<button
									type="button"
									onclick={() => (activeTab = 'preview')}
									class="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all {activeTab === 'preview'
										? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
										: 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'}"
								>
									<Eye class="h-3.5 w-3.5" />
									<span>Live Preview</span>
								</button>
							</div>

							<!-- Formatting Toolbar -->
							{#if activeTab === 'edit'}
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
							<textarea
								id="doc-editor-textarea"
								bind:value={content}
								onpaste={handlePaste}
								ondrop={handleDrop}
								ondragover={(e) => e.preventDefault()}
								required
								rows={16}
								placeholder="Tuliskan isi dokumentasi di sini... Mendukung Markdown, Heading H2/H3, tabel, code block, dan alert [!NOTE] / [!TIP]."
								class="w-full rounded-xl border border-zinc-300 bg-white p-4 font-mono text-xs leading-relaxed text-zinc-900 shadow-inner focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
							></textarea>
							<div class="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 px-1 pt-0.5">
								<span>💡 Tips Gambar: Tekan <strong class="text-zinc-700 dark:text-zinc-200">Ctrl + V</strong> untuk langsung paste screenshot, atau seret (drag & drop) file gambar ke editor.</span>
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
				<div class="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
					<div class="text-xs text-zinc-500 dark:text-zinc-400">
						<span>Format tersimpan otomatis dalam basis data JSON. Tidak memerlukan file .md manual.</span>
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
