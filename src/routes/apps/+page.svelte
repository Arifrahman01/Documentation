<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ui } from '$lib/stores/ui.svelte';
	import appsData from '$lib/data/apps.json';
	import DocEditorModal from '$lib/components/DocEditorModal.svelte';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import {
		Search,
		ExternalLink,
		Sparkles,
		Copy,
		Check,
		Layers,
		Plus,
		FileText,
		BookOpen,
		Edit3,
		Trash2,
		X,
		Save,
		Loader2,
		FolderPlus
	} from '@lucide/svelte';

	interface ProgramItem {
		id: string;
		title: string;
		subtitle: string;
		description: string;
		url: string;
		category: string;
		categoryName?: string;
		status: string;
		statusState?: string;
		tags: string[];
		docSlug?: string;
	}

	let programs = $state<ProgramItem[]>(appsData.programs as ProgramItem[]);
	let allDocs = $state<any[]>([]);
	let searchQuery = $state('');
	let selectedCategory = $state('all');
	let copiedAppId = $state<string | null>(null);

	// Document Editor Modal State (for adding/editing documentation directly from Program Navigator)
	let isDocEditorOpen = $state(false);
	let docEditorMode = $state<'create' | 'edit'>('create');
	let docEditorInitial = $state<any>(null);
	let activeProgramForDoc = $state<ProgramItem | null>(null);

	// Program Card Modal State (for adding/editing a Program in Program Navigator)
	let isProgramModalOpen = $state(false);
	let programModalMode = $state<'create' | 'edit'>('create');
	let isSavingProgram = $state(false);
	let progForm = $state({
		id: '',
		title: '',
		subtitle: '',
		description: '',
		url: '',
		category: 'operations',
		status: 'Production',
		tagsInput: '',
		docSlug: ''
	});

	// Right-click Context Menu on Program Cards
	let contextMenu = $state<{ open: boolean; x: number; y: number; app: ProgramItem | null }>({
		open: false,
		x: 0,
		y: 0,
		app: null
	});

	$effect(() => {
		ui.currentContext = {
			type: 'apps',
			title: `Program Navigator (${programs.length} Apps Enterprise)`
		};
	});

	onMount(() => {
		// Load latest programs & docs from API
		fetch('/api/apps')
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d?.programs) programs = d.programs;
			})
			.catch(() => {});

		fetch('/api/docs')
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d?.documents) allDocs = d.documents;
			})
			.catch(() => {});

		const closeMenu = () => {
			if (contextMenu.open) contextMenu = { open: false, x: 0, y: 0, app: null };
		};
		window.addEventListener('click', closeMenu);
		return () => window.removeEventListener('click', closeMenu);
	});

	const categories = $derived([
		{ id: 'all', label: `Semua Aplikasi (${programs.length})` },
		{ id: 'operations', label: 'Operations & Logistics' },
		{ id: 'analytics', label: 'Analytics & BI' },
		{ id: 'commercial', label: 'Marketing & CRM' },
		{ id: 'safety', label: 'Safety & SHE' },
		{ id: 'finance', label: 'Finance & Plant' },
		{ id: 'storage', label: 'Storage & Infra' }
	]);

	const filteredApps = $derived.by(() => {
		let list = programs;
		if (selectedCategory !== 'all') {
			list = list.filter((p) => p.category === selectedCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.subtitle.toLowerCase().includes(q) ||
					p.description.toLowerCase().includes(q) ||
					p.tags.some((t) => t.toLowerCase().includes(q))
			);
		}
		return list;
	});

	// Find linked documentation for a given Program
	function getLinkedDoc(app: ProgramItem) {
		if (app.docSlug) {
			const exact = allDocs.find((d) => d.slug === app.docSlug || d.id === app.docSlug);
			if (exact) return exact;
		}
		const titleLower = app.title.toLowerCase();
		return allDocs.find(
			(d) =>
				d.title?.toLowerCase().includes(titleLower) ||
				(Array.isArray(d.tags) && d.tags.some((t: string) => t.toLowerCase() === app.id.toLowerCase()))
		);
	}

	// Open Document Editor Modal to create documentation for a specific Program (or general)
	function openCreateDocForApp(app?: ProgramItem) {
		contextMenu = { open: false, x: 0, y: 0, app: null };
		activeProgramForDoc = app || null;

		if (app) {
			const existingDoc = getLinkedDoc(app);
			if (existingDoc) {
				docEditorMode = 'edit';
				docEditorInitial = existingDoc;
				isDocEditorOpen = true;
				return;
			}

			const sec = app.category === 'analytics' ? 'SAC' : 'WEB';
			const cat = sec === 'SAC' ? 'Overview & BI' : 'Web Stack';
			docEditorMode = 'create';
			docEditorInitial = {
				section: sec,
				category: cat,
				subcategory: app.title,
				title: `Panduan & Arsitektur ${app.title}`,
				description: app.description,
				sacUrl: sec === 'SAC' ? app.url : '',
				tags: [sec, ...app.tags],
				content: `## 1. Gambaran Umum ${app.title}
**${app.title}** (*${app.subtitle}*) adalah bagian dari ekosistem aplikasi enterprise.
${app.description}

> [!NOTE]
> **Informasi Akses Sistem**
> - **Nama Aplikasi:** \`${app.title}\`
> - **Kategori:** \`${app.categoryName || app.category}\`
> - **Status Lingkungan:** \`${app.status}\`
> - **URL Akses:** [${app.url}](${app.url})

---

## 2. Fitur Utama & Modul Operasional
- **Fitur 1:** Jelaskan modul atau alur kerja utama pada aplikasi ini.
- **Fitur 2:** Jelaskan integrasi data atau pelaporan real-time.

---

## 3. Panduan Penggunaan (Step-by-Step)
1. Buka aplikasi melalui tautan resmi **${app.url}**.
2. Masuk (*Login*) menggunakan akun otorisasi perusahaan.
3. Pilih menu operasional yang sesuai.

---

## 4. Arsitektur Teknis & Troubleshooting
| Komponen | Spesifikasi / Keterangan |
| :--- | :--- |
| **Platform** | Enterprise Web Application |
| **Integrasi** | REST API / Database Terpusat |
| **PIC / Support** | Tim IT Enterprise |`
			};
		} else {
			docEditorMode = 'create';
			docEditorInitial = {
				section: 'WEB',
				category: 'Web Stack',
				subcategory: 'Program Navigator',
				title: '',
				description: '',
				tags: ['WEB', 'Enterprise App'],
				content: ''
			};
		}

		isDocEditorOpen = true;
	}

	async function handleDocSaved(savedDoc: any) {
		// Refresh docs list
		fetch('/api/docs')
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d?.documents) allDocs = d.documents;
			})
			.catch(() => {});

		// If created for a specific program, link docSlug to that program
		if (activeProgramForDoc && savedDoc?.slug) {
			try {
				const res = await fetch('/api/apps', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: activeProgramForDoc.id,
						docSlug: savedDoc.slug
					})
				});
				if (res.ok) {
					const data = await res.json();
					if (data.programs) programs = data.programs;
				}
			} catch (_) {}
		}

		if (savedDoc?.slug) {
			goto(`/docs/${savedDoc.slug}`);
		}
	}

	// Open Program Modal (Create / Edit Program Card)
	function openCreateProgramModal() {
		contextMenu = { open: false, x: 0, y: 0, app: null };
		programModalMode = 'create';
		progForm = {
			id: '',
			title: '',
			subtitle: '',
			description: '',
			url: 'http://',
			category: selectedCategory !== 'all' ? selectedCategory : 'operations',
			status: 'Production',
			tagsInput: '',
			docSlug: ''
		};
		isProgramModalOpen = true;
	}

	function openEditProgramModal(app: ProgramItem) {
		contextMenu = { open: false, x: 0, y: 0, app: null };
		programModalMode = 'edit';
		progForm = {
			id: app.id,
			title: app.title,
			subtitle: app.subtitle,
			description: app.description,
			url: app.url,
			category: app.category || 'operations',
			status: app.status || 'Production',
			tagsInput: (app.tags || []).join(', '),
			docSlug: app.docSlug || ''
		};
		isProgramModalOpen = true;
	}

	async function handleSaveProgram(e: SubmitEvent) {
		e.preventDefault();
		if (!progForm.title.trim() || !progForm.url.trim()) return;
		isSavingProgram = true;

		const tags = progForm.tagsInput
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		try {
			const method = programModalMode === 'edit' ? 'PUT' : 'POST';
			const res = await fetch('/api/apps', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: progForm.id || undefined,
					title: progForm.title,
					subtitle: progForm.subtitle,
					description: progForm.description,
					url: progForm.url,
					category: progForm.category,
					status: progForm.status,
					tags,
					docSlug: progForm.docSlug || undefined
				})
			});
			if (res.ok) {
				const data = await res.json();
				if (data.programs) programs = data.programs;
				isProgramModalOpen = false;
			}
		} finally {
			isSavingProgram = false;
		}
	}

	async function handleDeleteProgram(app: ProgramItem) {
		contextMenu = { open: false, x: 0, y: 0, app: null };
		if (!confirm(`Apakah Anda yakin ingin menghapus program "${app.title}" dari navigator?`)) return;

		const res = await fetch(`/api/apps?id=${encodeURIComponent(app.id)}`, { method: 'DELETE' });
		if (res.ok) {
			const data = await res.json();
			if (data.programs) programs = data.programs;
		}
	}

	function openCardContextMenu(e: MouseEvent, app: ProgramItem) {
		e.preventDefault();
		e.stopPropagation();
		const x = Math.min(e.clientX, window.innerWidth - 260);
		const y = Math.min(e.clientY, window.innerHeight - 260);
		contextMenu = { open: true, x: Math.max(10, x), y: Math.max(10, y), app };
	}

	function copyUrl(app: ProgramItem) {
		navigator.clipboard.writeText(app.url);
		copiedAppId = app.id;
		setTimeout(() => (copiedAppId = null), 2000);
	}

	function askAiAboutApp(app: ProgramItem) {
		ui.openAi(
			`Jelaskan fitur utama, manfaat, dan alur integrasi dari ${app.title} (${app.subtitle}).`,
			{
				type: 'apps',
				title: app.title
			}
		);
	}
</script>

<svelte:head>
	<title>Program Navigator - Ekosistem Aplikasi & Dokumentasi Enterprise</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
	<!-- Hero Section with Action Buttons -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<div class="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
				<span class="flex h-2 w-2 rounded-full bg-emerald-500"></span>
				<span>Enterprise Application Suite</span>
			</div>
			<h1 class="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
				Program Navigator
			</h1>
			<p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
				Katalog peluncuran sistem aplikasi enterprise terintegrasi beserta pencatatan dokumentasi teknisnya. Klik kanan pada kartu aplikasi untuk membuat/mengedit dokumentasi atau mengelola program.
			</p>
		</div>

		<!-- Top Action Buttons: Tambah Dokumentasi & Tambah Program -->
		<div class="flex flex-wrap items-center gap-2.5">
			<Button
				variant="default"
				size="sm"
				onclick={() => openCreateDocForApp()}
				class="h-9 gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs shadow-xs"
			>
				<FileText class="h-3.5 w-3.5" />
				<span>+ Tambah Dokumentasi</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				onclick={openCreateProgramModal}
				class="h-9 gap-1.5 text-xs shadow-xs"
			>
				<Plus class="h-3.5 w-3.5 text-emerald-500" />
				<span>+ Tambah Program Baru</span>
			</Button>
		</div>
	</div>

	<Separator class="my-8" />

	<!-- Filter Controls -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<!-- Category Tabs (Shadcn Tabs) -->
		<Tabs bind:value={selectedCategory} class="w-full sm:w-auto">
			<TabsList class="flex h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
				{#each categories as cat}
					<TabsTrigger value={cat.id} class="px-3 py-1.5 text-xs">
						{cat.label}
					</TabsTrigger>
				{/each}
			</TabsList>
		</Tabs>

		<!-- Search Input -->
		<div class="relative w-full sm:w-72">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
			<Input
				type="text"
				bind:value={searchQuery}
				placeholder="Filter aplikasi atau tag..."
				class="pl-9 pr-8 h-9 text-xs"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</div>

	<!-- App Cards Grid -->
	<div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each filteredApps as app (app.id)}
			{@const linkedDoc = getLinkedDoc(app)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div oncontextmenu={(e) => openCardContextMenu(e, app)} class="h-full">
				<Card class="flex h-full flex-col justify-between transition-all hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700">
					<CardHeader class="pb-3">
						<div class="flex items-start justify-between gap-3">
							<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 shadow-xs ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700">
								<Layers class="h-5 w-5" />
							</div>

							<div class="flex items-center gap-1.5">
								{#if linkedDoc}
									<a
										href="/docs/{linkedDoc.slug}"
										class="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400 transition-colors"
										title="Buka Dokumentasi {app.title}"
									>
										<BookOpen class="h-2.5 w-2.5" />
										<span>Terhubung Dokumen</span>
									</a>
								{/if}
								<Badge variant={app.status === 'Production' || app.status === 'Active' ? 'default' : 'secondary'} class="text-[10px]">
									<span class="mr-1.5 h-1.5 w-1.5 rounded-full {app.status === 'Production' || app.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
									{app.status}
								</Badge>
							</div>
						</div>

						<CardTitle class="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-50">
							{app.title}
						</CardTitle>
						<CardDescription class="text-xs font-medium text-zinc-500 dark:text-zinc-400">
							{app.subtitle}
						</CardDescription>
					</CardHeader>

					<CardContent class="pb-4">
						<p class="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
							{app.description}
						</p>

						<!-- Tags -->
						<div class="mt-4 flex flex-wrap gap-1.5">
							{#each app.tags as tag}
								<Badge variant="outline" class="text-[10px] text-zinc-500 dark:text-zinc-400">
									#{tag}
								</Badge>
							{/each}
						</div>
					</CardContent>

					<CardFooter class="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
						<div class="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onclick={() => copyUrl(app)}
								class="h-8 px-2 text-xs text-zinc-500"
								title="Salin tautan aplikasi"
							>
								{#if copiedAppId === app.id}
									<Check class="h-3.5 w-3.5 text-emerald-500" />
								{:else}
									<Copy class="h-3.5 w-3.5" />
								{/if}
							</Button>

							<!-- Direct Add / Open Documentation Button for this Program -->
							{#if linkedDoc}
								<a href="/docs/{linkedDoc.slug}">
									<Button
										variant="ghost"
										size="sm"
										class="h-8 gap-1 px-2 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
										title="Baca dokumentasi aplikasi ini"
									>
										<BookOpen class="h-3.5 w-3.5" />
										<span>Dokumentasi</span>
									</Button>
								</a>
							{:else}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => openCreateDocForApp(app)}
									class="h-8 gap-1 px-2 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
									title="Buat catatan dokumentasi untuk aplikasi {app.title}"
								>
									<FolderPlus class="h-3.5 w-3.5" />
									<span>+ Dokumentasi</span>
								</Button>
							{/if}

							<Button
								variant="ghost"
								size="sm"
								onclick={() => askAiAboutApp(app)}
								class="h-8 gap-1 px-2 text-xs text-zinc-600 dark:text-zinc-400"
								title="Tanyakan AI Copilot"
							>
								<Sparkles class="h-3.5 w-3.5 text-amber-500" />
								<span class="hidden xl:inline">AI</span>
							</Button>
						</div>

						<a href={app.url} target="_blank" rel="noopener noreferrer">
							<Button size="sm" class="h-8 gap-1 text-xs">
								<span>Buka Aplikasi</span>
								<ExternalLink class="h-3 w-3 opacity-70" />
							</Button>
						</a>
					</CardFooter>
				</Card>
			</div>
		{/each}
	</div>

	{#if filteredApps.length === 0}
		<div class="py-16 text-center">
			<Layers class="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700" />
			<h3 class="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tidak ada aplikasi yang cocok</h3>
			<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Coba kata kunci lain atau tambahkan program/dokumentasi baru.</p>
			<div class="mt-4 flex justify-center gap-2">
				<Button variant="outline" size="sm" onclick={() => { searchQuery = ''; selectedCategory = 'all'; }}>
					Reset Filter
				</Button>
				<Button size="sm" onclick={openCreateProgramModal}>
					+ Tambah Program Baru
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Right-Click Context Menu for Program Navigator Cards -->
{#if contextMenu.open && contextMenu.app}
	{@const targetApp = contextMenu.app}
	{@const targetLinkedDoc = getLinkedDoc(targetApp)}
	<div
		class="fixed z-50 min-w-[240px] overflow-hidden rounded-xl border border-border bg-popover/95 p-1.5 text-xs text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			if (e.key === 'Escape') contextMenu = { open: false, x: 0, y: 0, app: null };
		}}
		role="menu"
		tabindex="-1"
	>
		<div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border truncate">
			{targetApp.title}
		</div>
		<div class="space-y-0.5 pt-1">
			<button
				type="button"
				onclick={() => openCreateDocForApp(targetApp)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition-colors"
			>
				<FileText class="h-3.5 w-3.5" />
				<span>{targetLinkedDoc ? 'Edit Dokumentasi Program' : '+ Buat Dokumentasi Program'}</span>
			</button>

			{#if targetLinkedDoc}
				<a
					href="/docs/{targetLinkedDoc.slug}"
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-muted transition-colors"
				>
					<BookOpen class="h-3.5 w-3.5 text-emerald-500" />
					<span>Buka Halaman Dokumentasi</span>
				</a>
			{/if}

			<div class="my-1 border-t border-border"></div>

			<button
				type="button"
				onclick={() => openEditProgramModal(targetApp)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted transition-colors"
			>
				<Edit3 class="h-3.5 w-3.5 text-blue-500" />
				<span>Edit Info Program</span>
			</button>

			<button
				type="button"
				onclick={() => openCreateProgramModal()}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted transition-colors"
			>
				<Plus class="h-3.5 w-3.5 text-emerald-500" />
				<span>Tambah Program Baru</span>
			</button>

			<div class="my-1 border-t border-border"></div>

			<button
				type="button"
				onclick={() => handleDeleteProgram(targetApp)}
				class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
			>
				<Trash2 class="h-3.5 w-3.5" />
				<span>Hapus Program</span>
			</button>
		</div>
	</div>
{/if}

<!-- Modal: Add / Edit Program Item in Program Navigator -->
{#if isProgramModalOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) isProgramModalOpen = false;
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
			<div class="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/40">
				<div class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
						<Layers class="h-4 w-4" />
					</div>
					<div>
						<h3 class="text-sm font-bold text-foreground">
							{programModalMode === 'edit' ? 'Edit Program Enterprise' : 'Tambah Program Baru'}
						</h3>
						<p class="text-[11px] text-muted-foreground">Simpan ke daftar Program Navigator</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (isProgramModalOpen = false)}
					class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/15 hover:text-red-500"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<form onsubmit={handleSaveProgram} class="p-5 space-y-3.5 text-xs">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="prog-title" class="text-xs font-semibold">Nama Program / Aplikasi *</Label>
						<Input
							id="prog-title"
							type="text"
							required
							bind:value={progForm.title}
							placeholder="Contoh: Fleet Telemetry System"
							class="h-9 text-xs"
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="prog-sub" class="text-xs font-semibold">Sub-Judul / Fungsi Singkat</Label>
						<Input
							id="prog-sub"
							type="text"
							bind:value={progForm.subtitle}
							placeholder="Contoh: Real-Time Fleet Monitoring"
							class="h-9 text-xs"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="prog-url" class="text-xs font-semibold">URL Aplikasi *</Label>
						<Input
							id="prog-url"
							type="url"
							required
							bind:value={progForm.url}
							placeholder="https://..."
							class="h-9 text-xs font-mono"
						/>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1.5">
							<Label for="prog-cat" class="text-xs font-semibold">Kategori</Label>
							<select
								id="prog-cat"
								bind:value={progForm.category}
								class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus:outline-none dark:bg-input/30"
							>
								<option value="operations">Operations</option>
								<option value="analytics">Analytics & BI</option>
								<option value="commercial">Marketing & CRM</option>
								<option value="safety">Safety & SHE</option>
								<option value="finance">Finance & Plant</option>
								<option value="storage">Storage & Infra</option>
							</select>
						</div>
						<div class="space-y-1.5">
							<Label for="prog-status" class="text-xs font-semibold">Status</Label>
							<select
								id="prog-status"
								bind:value={progForm.status}
								class="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus:outline-none dark:bg-input/30"
							>
								<option value="Production">Production</option>
								<option value="Active">Active</option>
								<option value="Development">Development</option>
							</select>
						</div>
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="prog-desc" class="text-xs font-semibold">Deskripsi Aplikasi</Label>
					<Textarea
						id="prog-desc"
						rows={3}
						bind:value={progForm.description}
						placeholder="Jelaskan kegunaan dan modul utama aplikasi ini..."
						class="text-xs"
					/>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="prog-tags" class="text-xs font-semibold">Tags (Pisahkan koma)</Label>
						<Input
							id="prog-tags"
							type="text"
							bind:value={progForm.tagsInput}
							placeholder="FMS, Logistics, Real-Time"
							class="h-9 text-xs"
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="prog-doc" class="text-xs font-semibold">Slug Dokumentasi Terkait (Opsional)</Label>
						<Input
							id="prog-doc"
							type="text"
							bind:value={progForm.docSlug}
							placeholder="Contoh: web/architecture"
							class="h-9 text-xs font-mono"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
					<Button type="button" variant="outline" size="sm" onclick={() => (isProgramModalOpen = false)}>
						Batal
					</Button>
					<Button type="submit" size="sm" disabled={isSavingProgram} class="gap-1.5">
						{#if isSavingProgram}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Menyimpan...</span>
						{:else}
							<Save class="h-3.5 w-3.5" />
							<span>Simpan Program</span>
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Document Editor Modal (Creates / Edits Documentation directly from Program Navigator!) -->
<DocEditorModal
	bind:isOpen={isDocEditorOpen}
	mode={docEditorMode}
	initialDoc={docEditorInitial}
	onSave={handleDocSaved}
/>
