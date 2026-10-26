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
		FolderPlus,
		MoreHorizontal,
		AlertCircle
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
	let programErrorMsg = $state('');
	let pageToastMsg = $state('');
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
			title: `Apps (${programs.length} Enterprise Apps)`
		};
	});

	onMount(() => {
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
		fetch('/api/docs')
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d?.documents) allDocs = d.documents;
			})
			.catch(() => {});

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

	function showPageToast(msg: string) {
		pageToastMsg = msg;
		setTimeout(() => {
			if (pageToastMsg === msg) pageToastMsg = '';
		}, 3000);
	}

	function openCreateProgramModal() {
		contextMenu = { open: false, x: 0, y: 0, app: null };
		programModalMode = 'create';
		programErrorMsg = '';
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
		programErrorMsg = '';
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
		if (!progForm.title.trim() || !progForm.url.trim()) {
			programErrorMsg = 'Nama program dan URL aplikasi wajib diisi.';
			return;
		}
		isSavingProgram = true;
		programErrorMsg = '';

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
				showPageToast(
					programModalMode === 'edit'
						? `Program "${progForm.title}" berhasil diperbarui`
						: `Program "${progForm.title}" berhasil ditambahkan`
				);
			} else {
				const errData = await res.json().catch(() => null);
				programErrorMsg = errData?.error || `Gagal menyimpan program (HTTP ${res.status}).`;
			}
		} catch (err: any) {
			programErrorMsg = err?.message || 'Gagal menghubungi server saat menyimpan program.';
		} finally {
			isSavingProgram = false;
		}
	}

	let deleteProgramTarget = $state<{
		open: boolean;
		app: ProgramItem | null;
		isDeleting?: boolean;
	}>({
		open: false,
		app: null
	});

	function handleDeleteProgram(app: ProgramItem) {
		contextMenu = { open: false, x: 0, y: 0, app: null };
		deleteProgramTarget = {
			open: true,
			app,
			isDeleting: false
		};
	}

	async function confirmDeleteProgram() {
		if (!deleteProgramTarget.app || deleteProgramTarget.isDeleting) return;
		const app = deleteProgramTarget.app;
		deleteProgramTarget.isDeleting = true;

		try {
			const res = await fetch(`/api/apps?id=${encodeURIComponent(app.id)}`, { method: 'DELETE' });
			if (res.ok) {
				const data = await res.json();
				if (data.programs) programs = data.programs;
				deleteProgramTarget.open = false;
				showPageToast(`Program "${app.title}" telah dihapus`);
			} else {
				showPageToast(`Gagal menghapus program "${app.title}"`);
			}
		} catch (_) {
			showPageToast(`Gagal menghubungi server saat menghapus "${app.title}"`);
		} finally {
			deleteProgramTarget.isDeleting = false;
		}
	}

	function openCardContextMenu(e: MouseEvent, app: ProgramItem) {
		e.preventDefault();
		e.stopPropagation();
		let rawX = e.clientX;
		let rawY = e.clientY;
		if (!rawX && !rawY && e.currentTarget instanceof HTMLElement) {
			const rect = e.currentTarget.getBoundingClientRect();
			rawX = rect.left;
			rawY = rect.bottom + 4;
		}
		const x = Math.min(rawX, window.innerWidth - 260);
		const y = Math.min(rawY, window.innerHeight - 260);
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
	<title>Apps - Ekosistem Aplikasi & Dokumentasi Enterprise</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
	<!-- Hero Section with Action Buttons -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
		<div>
			<Badge variant="outline" class="gap-2 px-3 py-1 text-xs">
				<span class="flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
				<span>Enterprise Application Suite</span>
			</Badge>
			<h1 class="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
				Apps
			</h1>
			<p class="mt-2 text-sm text-muted-foreground max-w-2xl">
				Katalog peluncuran sistem aplikasi enterprise terintegrasi beserta pencatatan dokumentasi teknisnya. Klik tombol menu (<strong>•••</strong>) atau klik kanan pada kartu aplikasi untuk membuat/mengedit dokumentasi dan mengelola program.
			</p>
		</div>

		<!-- Top Action Buttons: Tambah Dokumentasi & Tambah Program -->
		<div class="flex flex-wrap items-center gap-2.5">
			<Button
				variant="default"
				size="sm"
				onclick={() => openCreateDocForApp()}
				class="h-9 gap-1.5 text-xs"
			>
				<FileText class="h-3.5 w-3.5" />
				<span>Tambah Dokumentasi</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				onclick={openCreateProgramModal}
				class="h-9 gap-1.5 text-xs"
			>
				<Plus class="h-3.5 w-3.5" />
				<span>Tambah Program Baru</span>
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
				<Button
					variant="ghost"
					size="icon"
					onclick={() => (searchQuery = '')}
					class="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					title="Bersihkan pencarian"
					aria-label="Bersihkan pencarian"
				>
					<X class="h-3.5 w-3.5" />
				</Button>
			{/if}
		</div>
	</div>

	{#if pageToastMsg}
		<div class="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3.5 py-2 text-xs text-foreground">
			<div class="flex items-center gap-2">
				<Check class="h-3.5 w-3.5 text-emerald-500" />
				<span>{pageToastMsg}</span>
			</div>
			<button
				type="button"
				onclick={() => (pageToastMsg = '')}
				class="text-muted-foreground hover:text-foreground"
				aria-label="Tutup notifikasi"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}

	<!-- App Cards Grid -->
	<div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each filteredApps as app (app.id)}
			{@const linkedDoc = getLinkedDoc(app)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div oncontextmenu={(e) => openCardContextMenu(e, app)} class="h-full">
				<Card class="flex h-full flex-col justify-between transition-all hover:border-foreground/30">
					<CardHeader class="pb-3">
						<div class="flex items-start justify-between gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
								<Layers class="h-5 w-5" />
							</div>

							<div class="flex items-center gap-1.5">
								{#if linkedDoc}
									<Badge variant="outline" class="gap-1 text-[10px]">
										<BookOpen class="h-2.5 w-2.5" />
										<span>Terhubung Dokumen</span>
									</Badge>
								{/if}
								<Badge variant={app.status === 'Production' || app.status === 'Active' ? 'default' : 'secondary'} class="text-[10px]">
									{app.status}
								</Badge>
								<Button
									variant="ghost"
									size="icon"
									onclick={(e) => openCardContextMenu(e, app)}
									class="h-7 w-7 text-muted-foreground hover:text-foreground"
									title="Kelola program & dokumentasi (Edit / Hapus)"
									aria-label="Kelola program {app.title}"
								>
									<MoreHorizontal class="h-4 w-4" />
								</Button>
							</div>
						</div>

						<CardTitle class="mt-4 text-base font-bold text-foreground">
							{app.title}
						</CardTitle>
						<CardDescription class="text-xs font-medium text-muted-foreground">
							{app.subtitle}
						</CardDescription>
					</CardHeader>

					<CardContent class="pb-4">
						<p class="text-xs leading-relaxed text-muted-foreground">
							{app.description}
						</p>

						<!-- Tags -->
						<div class="mt-4 flex flex-wrap gap-1.5">
							{#each app.tags as tag}
								<Badge variant="outline" class="text-[10px] text-muted-foreground">
									#{tag}
								</Badge>
							{/each}
						</div>
					</CardContent>

					<CardFooter class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
						<div class="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onclick={() => copyUrl(app)}
								class="h-8 px-2 text-xs text-muted-foreground"
								title="Salin tautan aplikasi"
								aria-label="Salin tautan aplikasi {app.title}"
							>
								{#if copiedAppId === app.id}
									<Check class="h-3.5 w-3.5" />
								{:else}
									<Copy class="h-3.5 w-3.5" />
								{/if}
							</Button>

							{#if linkedDoc}
								<Button
									variant="ghost"
									size="sm"
									href="/docs/{linkedDoc.slug}"
									class="h-8 gap-1 px-2 text-xs"
									title="Baca dokumentasi aplikasi ini"
								>
									<BookOpen class="h-3.5 w-3.5 text-muted-foreground" />
									<span>Dokumentasi</span>
								</Button>
							{:else}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => openCreateDocForApp(app)}
									class="h-8 gap-1 px-2 text-xs"
									title="Buat catatan dokumentasi untuk aplikasi {app.title}"
								>
									<FolderPlus class="h-3.5 w-3.5 text-muted-foreground" />
									<span>Dokumentasi</span>
								</Button>
							{/if}

							<Button
								variant="ghost"
								size="sm"
								onclick={() => askAiAboutApp(app)}
								class="h-8 gap-1 px-2 text-xs text-muted-foreground"
								title="Tanyakan AI Copilot"
							>
								<Sparkles class="h-3.5 w-3.5" />
								<span class="hidden xl:inline">AI</span>
							</Button>
						</div>

						<Button size="sm" href={app.url} target="_blank" rel="noopener noreferrer" class="h-8 gap-1 text-xs">
							<span>Buka Aplikasi</span>
							<ExternalLink class="h-3 w-3 opacity-70" />
						</Button>
					</CardFooter>
				</Card>
			</div>
		{/each}
	</div>

	{#if filteredApps.length === 0}
		<div class="py-16 text-center">
			<Layers class="mx-auto h-10 w-10 text-muted-foreground/50" />
			<h3 class="mt-3 text-sm font-semibold text-foreground">Tidak ada aplikasi yang cocok</h3>
			<p class="mt-1 text-xs text-muted-foreground">Coba kata kunci lain atau tambahkan program/dokumentasi baru.</p>
			<div class="mt-4 flex justify-center gap-2">
				<Button variant="outline" size="sm" onclick={() => { searchQuery = ''; selectedCategory = 'all'; }}>
					Reset Filter
				</Button>
				<Button size="sm" onclick={openCreateProgramModal}>
					Tambah Program Baru
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
		class="fixed z-50 min-w-[240px] overflow-hidden rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 duration-100"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			if (e.key === 'Escape') contextMenu = { open: false, x: 0, y: 0, app: null };
		}}
		role="menu"
		tabindex="-1"
	>
		<div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
			{targetApp.title}
		</div>
		<Separator class="my-1" />
		<div class="space-y-0.5">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => openCreateDocForApp(targetApp)}
				class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
			>
				<FileText class="h-3.5 w-3.5 text-muted-foreground" />
				<span>{targetLinkedDoc ? 'Edit Dokumentasi Program' : 'Buat Dokumentasi Program'}</span>
			</Button>

			{#if targetLinkedDoc}
				<Button
					variant="ghost"
					size="sm"
					href="/docs/{targetLinkedDoc.slug}"
					class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
				>
					<BookOpen class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Buka Halaman Dokumentasi</span>
				</Button>
			{/if}

			<Separator class="my-1" />

			<Button
				variant="ghost"
				size="sm"
				onclick={() => openEditProgramModal(targetApp)}
				class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
			>
				<Edit3 class="h-3.5 w-3.5 text-muted-foreground" />
				<span>Edit Info Program</span>
			</Button>

			<Button
				variant="ghost"
				size="sm"
				onclick={() => openCreateProgramModal()}
				class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
			>
				<Plus class="h-3.5 w-3.5 text-muted-foreground" />
				<span>Tambah Program Baru</span>
			</Button>

			<Separator class="my-1" />

			<Button
				variant="ghost"
				size="sm"
				onclick={() => handleDeleteProgram(targetApp)}
				class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
			>
				<Trash2 class="h-3.5 w-3.5" />
				<span>Hapus Program</span>
			</Button>
		</div>
	</div>
{/if}

<!-- SHADCN DIALOG: Add / Edit Program Item in Program Navigator -->
<Dialog bind:open={isProgramModalOpen}>
	<DialogContent class="max-w-lg sm:max-w-lg p-0 gap-0 overflow-hidden">
		<div class="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30">
			<DialogHeader class="text-left sm:text-left gap-1">
				<div class="flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
						<Layers class="h-4 w-4" />
					</div>
					<div>
						<DialogTitle class="text-sm font-bold text-foreground">
							{programModalMode === 'edit' ? 'Edit Program Enterprise' : 'Tambah Program Baru'}
						</DialogTitle>
						<DialogDescription class="text-[11px] text-muted-foreground">
							Simpan ke direktori Apps
						</DialogDescription>
					</div>
				</div>
			</DialogHeader>
			<Button
				variant="ghost"
				size="icon"
				onclick={() => (isProgramModalOpen = false)}
				class="h-8 w-8 text-muted-foreground hover:text-foreground"
				title="Tutup"
				aria-label="Tutup modal program"
			>
				<X class="h-4 w-4" />
			</Button>
		</div>

		<form onsubmit={handleSaveProgram} class="p-5 space-y-3.5 text-xs">
			{#if programErrorMsg}
				<div class="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					<AlertCircle class="h-4 w-4 shrink-0" />
					<span>{programErrorMsg}</span>
				</div>
			{/if}

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

			<DialogFooter class="border-t border-border pt-3">
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
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<!-- SHADCN ALERT DIALOG: Konfirmasi Hapus Program -->
<AlertDialog bind:open={deleteProgramTarget.open}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<div class="flex items-center gap-2 text-destructive">
				<Trash2 class="h-5 w-5" />
				<AlertDialogTitle>Hapus Program?</AlertDialogTitle>
			</div>
			<AlertDialogDescription>
				Apakah Anda yakin ingin menghapus program <strong>"{deleteProgramTarget.app?.title}"</strong> dari Apps? Tindakan ini bersifat permanen.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (deleteProgramTarget.open = false)}>Batal</AlertDialogCancel>
			<AlertDialogAction
				variant="destructive"
				disabled={deleteProgramTarget.isDeleting}
				onclick={confirmDeleteProgram}
			>
				{#if deleteProgramTarget.isDeleting}
					<Loader2 class="h-3.5 w-3.5 animate-spin mr-1.5" />
					<span>Menghapus...</span>
				{:else}
					<span>Hapus Program</span>
				{/if}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<DocEditorModal
	bind:isOpen={isDocEditorOpen}
	mode={docEditorMode}
	initialDoc={docEditorInitial}
	onSave={handleDocSaved}
/>
