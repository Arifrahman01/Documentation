<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import {
		BookOpen,
		Layers,
		Sparkles,
		ArrowRight,
		Building2,
		BarChart3,
		Globe,
		MousePointerClick,
		FolderTree,
		LayoutTemplate,
		Image as ImageIcon,
		Columns2,
		Lock,
		Save,
		CopyPlus,
		Keyboard,
		CheckCircle2,
		Compass,
		FileText,
		Wand2
	} from '@lucide/svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';

	let activeGuideTab = $state<string>('workflow');

	$effect(() => {
		ui.currentContext = { type: 'home', title: 'Overview & Panduan Portal Dokumentasi' };
	});

	const workflowSteps = [
		{
			step: '01',
			title: 'Pilih Modul, Kategori & Sub-Kategori',
			desc: 'Gunakan panel Explorer di sisi kiri untuk memfilter modul (SAP, SAC, WEB, atau Semua). Dokumen tersusun rapi dalam folder Kategori Utama dan Sub-Kategori bertingkat.',
			badge: 'Explorer & Multi-Tab',
			color: 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400'
		},
		{
			step: '02',
			title: 'Klik Kanan atau Double-Click (Gaya Obsidian)',
			desc: 'Klik kanan di mana saja pada halaman dokumen atau pohon Explorer untuk membuka menu aksi: Edit Catatan, Tambah Baru, Duplikat Catatan, atau Hapus. Anda juga cukup Klik 2x (Double-Click) pada isi artikel untuk langsung mengedit.',
			badge: 'Context Menu',
			color: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400'
		},
		{
			step: '03',
			title: 'Gunakan Template 1-Klik, Split-View & Paste Gambar',
			desc: 'Saat mencatat dokumen baru, pilih Template Siap Pakai (SAC Story, SAP ABAP, Web/API, atau SOP). Ketik di sisi kiri sambil melihat hasil Live Preview di kanan, sisipkan Tabel/Checklist 1-klik, atau tekan Ctrl+V untuk langsung menempelkan screenshot gambar.',
			badge: 'Smart Editor',
			color: 'border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400'
		},
		{
			step: '04',
			title: 'Rapikan Catatan Mentah & Analisis dengan AI',
			desc: 'Tempel catatan kasar lalu klik "Rapikan Format" agar otomatis berubah menjadi Markdown rapi. Gunakan "AI Assistant (Ctrl+I)" untuk analisis yang terkunci khusus pada 1 dokumen aktif, atau "AI Copilot (Ctrl+J)" untuk tanya-jawab global seluruh sistem.',
			badge: 'Dual AI System',
			color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
		}
	];

	const detailedFeatures = [
		{
			icon: MousePointerClick,
			title: 'Menu Klik Kanan & Double-Click Edit',
			category: 'Navigasi & Aksi',
			points: [
				'Klik kanan pada nama file di Explorer, tab atas, atau isi artikel untuk membuka menu aksi cepat.',
				'Klik 2x (Double-Click) langsung pada paragraf artikel untuk masuk ke mode Edit.',
				'Mendukung fitur "Duplikat Catatan" untuk menggandakan struktur dokumen yang mirip dalam 1 detik.'
			]
		},
		{
			icon: FolderTree,
			title: 'Hierarki Kategori, Sub-Kategori & Multi-Tab',
			category: 'Organisasi File',
			points: [
				'Kelompokkan dokumen ke dalam 3 pilar utama (SAP, SAC, WEB), Kategori, hingga Sub-Kategori (Sub-Folder).',
				'Klik tombol (+) di samping nama Sub-Kategori untuk langsung menambah catatan di dalam sub-folder tersebut.',
				'Buka banyak dokumen sekaligus dengan Baris Tab ala VS Code di bagian atas (lengkap dengan tombol Tutup Semua).'
			]
		},
		{
			icon: LayoutTemplate,
			title: '4 Template Instan & Import File (.md / .txt)',
			category: 'Pencatatan Cepat',
			points: [
				'4 Template 1-Klik: Template SAC Story, Template SAP/ABAP, Template Web & API, serta Template SOP/Troubleshooting.',
				'Import file .md atau .txt dari komputer (melalui tombol Import atau Drag & Drop langsung ke kotak ketik).',
				'Toolbar Markdown 1-Klik untuk membuat Tabel otomatis, Checklist langkah kerja, Heading, Callout Box, dan Blok Kode.'
			]
		},
		{
			icon: ImageIcon,
			title: 'Sisipkan Gambar Instan & Lightbox Zoom',
			category: 'Media & Visual',
			points: [
				'Tekan Ctrl+V langsung di dalam editor untuk menempelkan gambar/screenshot dari clipboard.',
				'Mendukung Drag & Drop file gambar dari komputer atau klik tombol "+ Gambar" di toolbar.',
				'Setiap gambar di dalam artikel dapat diklik untuk diperbesar (Full-Screen Lightbox Zoom).'
			]
		},
		{
			icon: Lock,
			title: 'AI Assistant Dokumen (Ctrl+I) vs Chat AI Global (Ctrl+J)',
			category: 'Kecerdasan Buatan',
			points: [
				'AI Assistant Dokumen (Ctrl+I): Berbentuk Modal Spotlight yang lingkupnya 100% terkunci hanya pada isi dokumen yang sedang dibuka.',
				'Dilengkapi fitur "Sematkan di Artikel" agar hasil rangkuman AI menempel di atas dokumen sambil Anda membaca.',
				'Tombol "✨ Rapikan Format" di Editor mengubah catatan mentah menjadi struktur Heading & Tabel rapi tanpa mengubah fakta.'
			]
		},
		{
			icon: Save,
			title: 'Auto-Save Draft Lokal & Ekspor Markdown',
			category: 'Keamanan Data',
			points: [
				'Setiap ketikan di editor disimpan otomatis (Real-time Auto-Save Draft) agar tidak hilang jika modal tertutup.',
				'Muncul tombol "Pulihkan Draft" secara otomatis apabila terdapat ketikan yang belum sempat disimpan.',
				'Setiap dokumentasi dapat disalin tautannya, disalin Raw Markdown-nya, atau diunduh sebagai file .md.'
			]
		}
	];

	const shortcutsList = [
		{ keys: 'Klik Kanan', action: 'Membuka menu konteks (Edit, Tambah Baru, Duplikat, AI Dokumen, Unduh, Hapus)' },
		{ keys: 'Double-Click', action: 'Klik 2x pada teks artikel untuk langsung mengedit dokumen aktif' },
		{ keys: 'Ctrl + N', action: 'Membuka modal Tambah Catatan Dokumentasi Baru' },
		{ keys: 'Ctrl + E', action: 'Membuka modal Edit untuk dokumen yang sedang aktif' },
		{ keys: 'Ctrl + I', action: 'Membuka Modal AI Assistant Khusus Dokumen Ini (Lingkup Terkunci 1 Dokumen)' },
		{ keys: 'Ctrl + J', action: 'Membuka laci Chat AI Copilot Global (Lintas seluruh dokumen & 7 aplikasi)' },
		{ keys: 'Ctrl + K', action: 'Membuka Pencarian Cepat Global (Dokumen & Program Navigator)' },
		{ keys: 'Ctrl + V', action: 'Menempelkan (Paste) gambar/screenshot langsung ke dalam Editor' },
		{ keys: 'ESC', action: 'Menutup modal editor, AI Assistant, pencarian, atau pratinjau gambar' }
	];
</script>

<div class="relative overflow-hidden">
	<!-- Ambient Background Glow -->
	<div class="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/10 via-sky-500/10 to-emerald-500/10 blur-3xl dark:from-indigo-950/30 dark:via-sky-950/20 dark:to-emerald-950/20"></div>

	<!-- Hero Section -->
	<section class="mx-auto max-w-7xl px-4 pt-16 pb-16 sm:px-6 lg:px-8 lg:pt-20">
		<div class="text-center">
			<div class="inline-flex items-center gap-2">
				<Badge variant="outline" class="gap-2 px-3.5 py-1 text-xs">
					<span class="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
					<span class="font-medium">Enterprise Knowledge & Documentation Workspace</span>
				</Badge>
			</div>

			<h1 class="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
				Documentation Portal
			</h1>

			<p class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
				Pusat pencatatan dokumentasi teknis SAP, SAC Analytics, dan Web Stack dengan pengalaman menulis cepat bergaya Obsidian & Notion.
			</p>

			<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
				<a href="/docs/sap/overview">
					<Button size="lg" class="gap-2 shadow-sm">
						<BookOpen class="h-4 w-4" />
						<span>Buka Workspace Dokumentasi</span>
						<ArrowRight class="h-4 w-4 opacity-70" />
					</Button>
				</a>

				<a href="#panduan-penggunaan">
					<Button variant="outline" size="lg" class="gap-2 shadow-xs">
						<Compass class="h-4 w-4 text-indigo-500" />
						<span>Panduan Penggunaan & Fitur</span>
					</Button>
				</a>

				<a href="/apps">
					<Button variant="outline" size="lg" class="gap-2 shadow-xs">
						<Layers class="h-4 w-4 text-emerald-500" />
						<span>Program Navigator (7 Apps)</span>
					</Button>
				</a>
			</div>

			<!-- Quick Stats Banner -->
			<div class="mt-14 grid grid-cols-2 gap-4 border-y border-border py-6 sm:grid-cols-4">
				<div>
					<div class="text-2xl font-bold text-foreground">3 Pilar Modul</div>
					<div class="text-xs text-muted-foreground">SAP, SAC & Web Stack</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-foreground">Sub-Kategori</div>
					<div class="text-xs text-muted-foreground">Pohon Folder Bertingkat</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-foreground">4 Template</div>
					<div class="text-xs text-muted-foreground">Pencatatan Instan 1-Klik</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-foreground">Dual AI</div>
					<div class="text-xs text-muted-foreground">AI Dokumen & Copilot Global</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Bento Feature Grid: 3 Main Documentation Pillars -->
	<section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
		<div class="mb-8 text-center sm:text-left">
			<h2 class="text-2xl font-bold tracking-tight text-foreground">3 Bagian Utama Dokumentasi</h2>
			<p class="mt-1 text-sm text-muted-foreground">Pilih bagian untuk membaca atau mencatat dokumentasi teknis sesuai ekosistem sistem.</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- Pillar 1: SAP Enterprise -->
			<Card class="transition-all hover:shadow-md border-blue-200/70 dark:border-blue-900/40 hover:border-blue-400">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
							<Building2 class="h-5 w-5" />
						</div>
						<Badge class="bg-blue-600 text-white">SAP Enterprise</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">SAP ERP & S/4HANA</CardTitle>
					<CardDescription>
						Fondasi arsitektur database in-memory HANA, modul bisnis FI/CO, MM, SD, PM, integrasi ABAP via RFC & BAPI, serta implementasi SAP Gateway OData.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-1.5 mb-5">
						<Badge variant="outline" class="text-[10px]">S/4HANA</Badge>
						<Badge variant="outline" class="text-[10px]">ABAP RFC</Badge>
						<Badge variant="outline" class="text-[10px]">BAPI</Badge>
						<Badge variant="outline" class="text-[10px]">CDS Views</Badge>
					</div>
					<a href="/docs/sap/overview" class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
						Eksplorasi SAP <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>

			<!-- Pillar 2: SAC Analytics -->
			<Card class="transition-all hover:shadow-md border-purple-200/70 dark:border-purple-900/40 hover:border-purple-400">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
							<BarChart3 class="h-5 w-5" />
						</div>
						<Badge class="bg-purple-600 text-white">SAC Analytics</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">SAP Analytics Cloud (SAC)</CardTitle>
					<CardDescription>
						Dokumentasi Story Dashboard (Finance, Marketing, Operation Mining, Operation Marine, PM), rumus Calculated/Restricted Measure, dan koneksi CDS View.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-1.5 mb-5">
						<Badge variant="outline" class="text-[10px]">Stories BI</Badge>
						<Badge variant="outline" class="text-[10px]">Operation Mining</Badge>
						<Badge variant="outline" class="text-[10px]">Operation Marine</Badge>
						<Badge variant="outline" class="text-[10px]">Measures</Badge>
					</div>
					<a href="/docs/sac/overview" class="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400">
						Eksplorasi SAC <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>

			<!-- Pillar 3: WEB Stack -->
			<Card class="transition-all hover:shadow-md border-emerald-200/70 dark:border-emerald-900/40 hover:border-emerald-400">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
							<Globe class="h-5 w-5" />
						</div>
						<Badge class="bg-emerald-600 text-white">WEB Stack</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">Modern Web Applications</CardTitle>
					<CardDescription>
						Arsitektur aplikasi web enterprise, dokumentasi layanan backend, integrasi sistem, dan standar pengujian kualitas perangkat lunak.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-1.5 mb-5">
						<Badge variant="outline" class="text-[10px]">SvelteKit 5</Badge>
						<Badge variant="outline" class="text-[10px]">Architecture</Badge>
						<Badge variant="outline" class="text-[10px]">Data Binding</Badge>
						<Badge variant="outline" class="text-[10px]">Security</Badge>
					</div>
					<a href="/docs/web/architecture" class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
						Eksplorasi WEB <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>
		</div>
	</section>

	<!-- ===================================================================== -->
	<!-- NEW: COMPREHENSIVE USAGE GUIDE & FEATURE CHART SECTION ON OVERVIEW    -->
	<!-- ===================================================================== -->
	<section id="panduan-penggunaan" class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8 scroll-mt-20">
		<Card class="overflow-hidden border-indigo-500/30 bg-gradient-to-b from-indigo-950/15 via-card to-card shadow-xl">
			<CardHeader class="border-b border-border/80 pb-5">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div class="space-y-1.5">
						<div class="flex items-center gap-2">
							<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
								<Compass class="h-5 w-5" />
							</div>
							<Badge class="bg-indigo-600 text-white">Panduan Penggunaan Program</Badge>
							<Badge variant="outline" class="text-[11px]">Zero-Friction Note-Taking</Badge>
						</div>
						<CardTitle class="text-2xl font-extrabold tracking-tight pt-1">
							Dokumentasi Penggunaan & Fitur Lengkap Portal
						</CardTitle>
						<CardDescription class="text-sm max-w-3xl">
							Program ini dirancang khusus untuk mempermudah pencatatan, pengorganisasian, dan pencarian dokumentasi teknis enterprise dengan menggabungkan kecepatan <strong>Obsidian</strong>, kerapian <strong>Notion</strong>, dan kecerdasan <strong>AI Assistant</strong>.
						</CardDescription>
					</div>

					<!-- Shadcn Tabs List Inside Overview Card -->
					<Tabs bind:value={activeGuideTab} class="w-auto">
						<TabsList>
							<TabsTrigger value="workflow" class="text-xs">1. Alur Penggunaan</TabsTrigger>
							<TabsTrigger value="features" class="text-xs">2. Detail 6 Fitur Utama</TabsTrigger>
							<TabsTrigger value="shortcuts" class="text-xs">3. Pintasan Keyboard</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</CardHeader>

			<CardContent class="pt-6 space-y-8">
				{#if activeGuideTab === 'workflow'}
					<!-- TAB 1: VISUAL WORKFLOW CHART & STEP-BY-STEP GUIDE -->
					<div class="space-y-6">
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
							{#each workflowSteps as item}
								<div class="relative flex flex-col justify-between rounded-2xl border border-border bg-background/80 p-5 shadow-xs transition-all hover:border-indigo-500/40">
									<div>
										<div class="flex items-center justify-between mb-3">
											<span class="text-2xl font-black tracking-tight text-indigo-500/80 font-mono">
												{item.step}
											</span>
											<span class="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold {item.color}">
												{item.badge}
											</span>
										</div>
										<h3 class="text-sm font-bold text-foreground">
											{item.title}
										</h3>
										<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
											{item.desc}
										</p>
									</div>
								</div>
							{/each}
						</div>

						<!-- Detailed Visual Comparison: How to Record Documentation -->
						<div class="grid grid-cols-1 gap-6 lg:grid-cols-3 pt-2">
							<div class="rounded-2xl border border-border bg-muted/30 p-5">
								<div class="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
									<FolderTree class="h-4 w-4 text-indigo-500" />
									<span>Cara Mengelola Kategori & Sub-Kategori</span>
								</div>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span>Pilih <strong>Section</strong> (<code>SAP</code>, <code>SAC</code>, atau <code>WEB</code>) di sidebar kiri.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span>Saat menambah/mengedit dokumen, pilih <strong>Kategori Utama</strong> lalu isi kolom <strong>Sub-Kategori</strong> (atau klik saran cepat di bawahnya).</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span>Dokumen yang memiliki Sub-Kategori otomatis dikelompokkan ke dalam <strong>Sub-Folder bertingkat</strong> di bawah Kategori Utama.</span>
									</li>
								</ul>
							</div>

							<div class="rounded-2xl border border-border bg-muted/30 p-5">
								<div class="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
									<Wand2 class="h-4 w-4 text-purple-500" />
									<span>3 Cara Cepat Menulis Dokumentasi</span>
								</div>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span><strong>Pakai Template 1-Klik:</strong> Klik <em>Template SAC Story</em>, <em>SAP/ABAP</em>, <em>Web/API</em>, atau <em>SOP</em> di dalam editor untuk langsung mendapatkan kerangka tabel & bab.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span><strong>Paste Catatan Kasar + Rapikan AI:</strong> Tempel catatan mentah dari Notepad/WhatsApp lalu klik tombol <strong>✨ Rapikan Format</strong>.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span><strong>Import File (.md / .txt):</strong> Klik tombol <em>Import File</em> atau seret file langsung ke kotak editor.</span>
									</li>
								</ul>
							</div>

							<div class="rounded-2xl border border-border bg-muted/30 p-5">
								<div class="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
									<Sparkles class="h-4 w-4 text-amber-500" />
									<span>Perbedaan 2 Sistem AI di Portal Ini</span>
								</div>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span><strong>AI Assistant Dokumen (<code>Ctrl+I</code>):</strong> Muncul sebagai Modal di menu Document. Lingkupnya <strong>100% terkunci hanya pada 1 dokumen aktif</strong> (untuk merangkum, membedah rumus/kode, & menyematkan ringkasan di atas artikel).</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
										<span><strong>Chat AI Copilot Global (<code>Ctrl+J</code>):</strong> Muncul sebagai Drawer di sisi kanan untuk menjawab pertanyaan lintas seluruh dokumen & 7 aplikasi enterprise.</span>
									</li>
								</ul>
							</div>
						</div>
					</div>
				{:else if activeGuideTab === 'features'}
					<!-- TAB 2: DETAILED 6 CORE FEATURES GRID -->
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{#each detailedFeatures as feat}
							<div class="flex flex-col justify-between rounded-2xl border border-border bg-background/80 p-5 shadow-xs">
								<div>
									<div class="flex items-center justify-between mb-3">
										<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
											<feat.icon class="h-4 w-4" />
										</div>
										<Badge variant="outline" class="text-[10px]">{feat.category}</Badge>
									</div>
									<h3 class="text-sm font-bold text-foreground mb-2.5">
										{feat.title}
									</h3>
									<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
										{#each feat.points as pt}
											<li class="flex items-start gap-2">
												<span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>
												<span>{pt}</span>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<!-- TAB 3: KEYBOARD SHORTCUTS & GESTURES TABLE -->
					<div class="overflow-hidden rounded-2xl border border-border bg-background">
						<div class="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
							{#each shortcutsList as item, idx}
								<div class="flex items-center justify-between gap-4 p-4 border-b border-border/60">
									<span class="text-xs text-muted-foreground leading-snug">
										{item.action}
									</span>
									<kbd class="shrink-0 rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-xs font-bold text-foreground shadow-2xs">
										{item.keys}
									</kbd>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Bottom CTA Bar inside Overview Guide Card -->
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-muted/40 p-4">
					<div class="flex items-center gap-3 text-xs text-muted-foreground">
						<Layers class="h-4 w-4 text-emerald-500 shrink-0" />
						<span>
							Ingin membuka daftar aplikasi operasional seperti <strong>Fuel Management System (FMS)</strong>, <strong>SAC Production</strong>, <strong>Marketing</strong>, atau <strong>KPI Safety</strong>?
						</span>
					</div>
					<div class="flex items-center gap-2.5 shrink-0">
						<a href="/apps">
							<Button variant="outline" size="sm" class="gap-1.5 text-xs">
								<Layers class="h-3.5 w-3.5 text-emerald-500" />
								<span>Buka Program Navigator</span>
							</Button>
						</a>
						<a href="/docs/sap/overview">
							<Button size="sm" class="gap-1.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700">
								<FileText class="h-3.5 w-3.5" />
								<span>Mulai Mencatat Dokumentasi</span>
								<ArrowRight class="h-3.5 w-3.5" />
							</Button>
						</a>
					</div>
				</div>
			</CardContent>
		</Card>
	</section>
</div>
