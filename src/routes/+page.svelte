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
		Lock,
		Save,
		CheckCircle2,
		Compass,
		FileText,
		Wand2
	} from '@lucide/svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';

	let activeGuideTab = $state<string>('workflow');

	$effect(() => {
		ui.currentContext = { type: 'home', title: 'Overview & Panduan Portal Dokumentasi' };
	});

	const workflowSteps = [
		{
			step: '01',
			title: 'Pilih Modul, Folder & Sub-Folder',
			desc: 'Gunakan File Explorer di sisi kiri untuk memilih modul (SAP, SAC, WEB). Buat Folder atau File Catatan baru secara instan dan rapi.',
			badge: 'File Explorer'
		},
		{
			step: '02',
			title: 'Aksi Cepat Klik Kanan & Double-Click',
			desc: 'Klik kanan di mana saja pada daftar file atau artikel untuk menu aksi: Buat File, Buat Folder, Edit Catatan, Duplikat, atau Hapus.',
			badge: 'Menu Konteks'
		},
		{
			step: '03',
			title: 'Tulis Leluasa: Mode Penuh & Split Pratinjau',
			desc: 'Ruang tulis luas dan leluasa. Beralih instan antara mode [Tulis Penuh] untuk mengetik tanpa batas atau [Split Pratinjau] untuk melihat hasil Markdown.',
			badge: 'Editor Fleksibel'
		},
		{
			step: '04',
			title: 'Rapikan Otomatis & Instruksi Manual AI',
			desc: 'Tempel catatan mentah lalu klik "Rapikan Format", atau berikan instruksi manual khusus ke AI untuk memformat tabel, heading, atau kode.',
			badge: 'AI Assistant'
		}
	];

	const detailedFeatures = [
		{
			icon: MousePointerClick,
			title: 'Menu Klik Kanan & Double-Click Edit',
			category: 'Navigasi & Aksi',
			points: [
				'Klik kanan pada file/folder di Explorer atau artikel dokumen untuk membuka menu aksi cepat.',
				'Klik 2x (Double-Click) langsung pada paragraf artikel untuk masuk ke mode Edit seketika.',
				'Mendukung fitur "Duplikat File Catatan" untuk menggandakan struktur dokumen dalam 1 detik.'
			]
		},
		{
			icon: FolderTree,
			title: 'File Explorer Folder & Sub-Folder',
			category: 'Organisasi File',
			points: [
				'Kelompokkan dokumen ke dalam 3 pilar utama (SAP, SAC, WEB), Folder Kategori, hingga Sub-Folder bertingkat.',
				'Klik tombol (+) di samping nama Folder untuk langsung menambah file catatan baru di dalam folder tersebut.',
				'Detail lokasi modul dan folder terisi 100% otomatis sesuai tempat Anda membuat file.'
			]
		},
		{
			icon: LayoutTemplate,
			title: 'Editor Leluasa (Tulis Penuh & Split Pratinjau)',
			category: 'Pencatatan Fleksibel',
			points: [
				'Pilihan tampilan fleksibel: Mode [Tulis Penuh] untuk ruang menulis ekstra lega atau [Split Pratinjau] berdampingan.',
				'Template terpadu 1-klik yang bersih dan terstruktur untuk memulai dokumentasi tanpa kebingungan format.',
				'Toolbar Markdown lengkap untuk membuat Tabel otomatis, Checklist langkah kerja, Callout Box, dan Blok Kode.'
			]
		},
		{
			icon: ImageIcon,
			title: 'Sisipkan Gambar Instan (Ctrl+V) & Lightbox Zoom',
			category: 'Media & Visual',
			points: [
				'Tekan Ctrl+V langsung di dalam editor untuk menempelkan gambar atau screenshot dari clipboard.',
				'Mendukung Drag & Drop file gambar dari komputer atau klik tombol "+ Gambar" di toolbar.',
				'Setiap gambar di dalam artikel dapat diklik untuk diperbesar penuh (Full-Screen Lightbox Zoom).'
			]
		},
		{
			icon: Wand2,
			title: 'Perapian Format & Instruksi Manual AI',
			category: 'Kecerdasan Buatan',
			points: [
				'Tombol "Rapikan Format" merapikan catatan mentah menjadi struktur Heading & Tabel standar profesional.',
				'Fitur "Instruksi Manual AI" memungkinkan Anda memberi arahan bebas (misal: "Ubah ke format SOP", "Perjelas langkah solusi").',
				'Tersedia tombol "Urungkan AI" untuk mengembalikan draf asli jika ingin disesuaikan kembali.'
			]
		},
		{
			icon: Save,
			title: 'Aplikasi PWA, Ruang My Docs & Ekspor',
			category: 'Akses & Integrasi',
			points: [
				'Dapat diinstal langsung sebagai aplikasi desktop/mobile (PWA) dengan dukungan caching dan offline mode.',
				'Ruang catatan pribadi "My Docs" dengan kenyamanan editor dan manajemen file yang sama persis.',
				'Setiap dokumen dapat disalin tautannya, disalin Raw Markdown-nya, atau diunduh sebagai file .md.'
			]
		}
	];

	const shortcutsList = [
		{ keys: 'Klik Kanan', action: 'Membuka menu konteks (Buat File/Folder, Edit, Duplikat, AI Dokumen, Unduh, Hapus)' },
		{ keys: 'Double-Click', action: 'Klik 2x pada teks artikel untuk langsung mengedit dokumen aktif' },
		{ keys: 'Alt + N', action: 'Membuat File Catatan Baru di File Explorer' },
		{ keys: 'Alt + Shift + F', action: 'Membuat Folder Baru di File Explorer' },
		{ keys: 'Ctrl + E', action: 'Membuka / menutup Mode Editor untuk dokumen aktif (Ctrl+S untuk Simpan)' },
		{ keys: 'Ctrl + I', action: 'Membuka AI Assistant Khusus Dokumen Ini (Lingkup Terkunci 1 Dokumen)' },
		{ keys: 'Ctrl + J', action: 'Membuka Chat AI Copilot Global (SAP, SAC, Web, & Apps)' },
		{ keys: 'Ctrl + K', action: 'Membuka Pencarian Cepat Global (Dokumentasi, Apps & My Docs)' },
		{ keys: 'Ctrl + V', action: 'Menempelkan (Paste) gambar/screenshot langsung ke dalam Editor' },
		{ keys: 'ESC', action: 'Menutup editor, AI Assistant, modal pencarian, atau pratinjau gambar' }
	];
</script>

<div class="relative overflow-hidden">
	<!-- Hero Section -->
	<section class="mx-auto max-w-7xl px-4 pt-16 pb-16 sm:px-6 lg:px-8 lg:pt-20">
		<div class="text-center">
			<div class="inline-flex items-center gap-2">
				<Badge variant="outline" class="gap-2 px-3.5 py-1 text-xs">
					<span class="flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
					<span class="font-medium">Enterprise Knowledge & Documentation Workspace</span>
				</Badge>
			</div>

			<h1 class="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
				Documentation Portal
			</h1>

			<p class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
				Pusat pencatatan dokumentasi teknis SAP, SAC Analytics, dan Web Stack dengan pengalaman menulis leluasa, organisasi file terstruktur, dan asisten AI terintegrasi.
			</p>

			<div class="mt-10 flex flex-wrap items-center justify-center gap-3">
				<Button size="lg" href="/docs/sap/overview" class="gap-2">
					<BookOpen class="h-4 w-4" />
					<span>Buka Workspace Dokumentasi</span>
					<ArrowRight class="h-4 w-4 opacity-70" />
				</Button>

				<Button variant="outline" size="lg" href="#panduan-penggunaan" class="gap-2">
					<Compass class="h-4 w-4 text-muted-foreground" />
					<span>Panduan Penggunaan & Fitur</span>
				</Button>

				<Button variant="outline" size="lg" href="/apps" class="gap-2">
					<Layers class="h-4 w-4 text-muted-foreground" />
					<span>Apps (7 Apps)</span>
				</Button>
			</div>

			<!-- Quick Stats Banner -->
			<div class="mt-14 grid grid-cols-2 gap-4 border-y border-border py-6 sm:grid-cols-4">
				<div>
					<div class="text-2xl font-bold text-foreground">3 Pilar Modul</div>
					<div class="text-xs text-muted-foreground">SAP, SAC & Web Stack</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-foreground">File Explorer</div>
					<div class="text-xs text-muted-foreground">Folder & Sub-Folder</div>
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
			<Card class="flex flex-col justify-between transition-all hover:border-foreground/30">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
							<Building2 class="h-5 w-5" />
						</div>
						<Badge variant="secondary">SAP Enterprise</Badge>
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
					<Button variant="outline" size="sm" href="/docs/sap/overview" class="w-full justify-between text-xs">
						<span>Eksplorasi SAP</span>
						<ArrowRight class="h-3.5 w-3.5" />
					</Button>
				</CardContent>
			</Card>

			<!-- Pillar 2: SAC Analytics -->
			<Card class="flex flex-col justify-between transition-all hover:border-foreground/30">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
							<BarChart3 class="h-5 w-5" />
						</div>
						<Badge variant="secondary">SAC Analytics</Badge>
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
					<Button variant="outline" size="sm" href="/docs/sac/overview" class="w-full justify-between text-xs">
						<span>Eksplorasi SAC</span>
						<ArrowRight class="h-3.5 w-3.5" />
					</Button>
				</CardContent>
			</Card>

			<!-- Pillar 3: WEB Stack -->
			<Card class="flex flex-col justify-between transition-all hover:border-foreground/30">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
							<Globe class="h-5 w-5" />
						</div>
						<Badge variant="secondary">WEB Stack</Badge>
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
					<Button variant="outline" size="sm" href="/docs/web/architecture" class="w-full justify-between text-xs">
						<span>Eksplorasi WEB</span>
						<ArrowRight class="h-3.5 w-3.5" />
					</Button>
				</CardContent>
			</Card>
		</div>
	</section>

	<!-- COMPREHENSIVE USAGE GUIDE & FEATURE CHART SECTION ON OVERVIEW -->
	<section id="panduan-penggunaan" class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8 scroll-mt-20">
		<Card class="overflow-hidden border-border bg-card shadow-sm">
			<CardHeader class="border-b border-border pb-5">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div class="space-y-1.5">
						<div class="flex items-center gap-2">
							<div class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
								<Compass class="h-4 w-4" />
							</div>
							<Badge variant="secondary">Panduan Penggunaan Program</Badge>
							<Badge variant="outline" class="text-[11px]">Panduan Resmi</Badge>
						</div>
						<CardTitle class="text-2xl font-extrabold tracking-tight pt-1">
							Dokumentasi Penggunaan & Fitur Lengkap Portal
						</CardTitle>
						<CardDescription class="text-sm max-w-3xl">
							Program ini dirancang khusus untuk mempermudah pencatatan, pengorganisasian, dan pencarian dokumentasi teknis enterprise dengan File Explorer bertingkat, ruang editor luas yang fleksibel, serta asisten AI cerdas terintegrasi.
						</CardDescription>
					</div>

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
								<Card class="p-5 py-5 gap-2 bg-muted/20 shadow-none">
									<div class="flex items-center justify-between mb-1">
										<span class="text-xl font-bold tracking-tight text-foreground font-mono">
											{item.step}
										</span>
										<Badge variant="outline" class="text-[10px]">
											{item.badge}
										</Badge>
									</div>
									<h3 class="text-sm font-bold text-foreground">
										{item.title}
									</h3>
									<p class="text-xs leading-relaxed text-muted-foreground">
										{item.desc}
									</p>
								</Card>
							{/each}
						</div>

						<!-- Detailed Visual Comparison: How to Record Documentation -->
						<div class="grid grid-cols-1 gap-6 lg:grid-cols-3 pt-2">
							<Card class="p-5 py-5 gap-2 bg-muted/15 shadow-none">
								<div class="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
									<FolderTree class="h-4 w-4 text-muted-foreground" />
									<span>Cara Mengelola Folder & File</span>
								</div>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span>Pilih tab modul (<code>Semua</code>, <code>SAP</code>, <code>SAC</code>, atau <code>WEB</code>) di bagian atas File Explorer.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span>Klik tombol <strong>File</strong> atau <strong>Folder</strong> di Explorer kiri untuk membuat catatan atau folder baru.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span>Detail modul dan kategori terisi otomatis sesuai lokasi folder tempat Anda membuat file.</span>
									</li>
								</ul>
							</Card>

							<Card class="p-5 py-5 gap-2 bg-muted/15 shadow-none">
								<div class="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
									<Wand2 class="h-4 w-4 text-muted-foreground" />
									<span>3 Cara Cepat Menulis Dokumentasi</span>
								</div>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>Ruang Tulis Leluasa:</strong> Beralih instan antara mode <em>Tulis Penuh</em> (leluasa tanpa batasan) atau <em>Split Pratinjau</em> (pratinjau live berdampingan).</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>Rapikan Otomatis & Instruksi Manual:</strong> Tempel catatan kasar lalu klik <strong>Rapikan Format</strong>, atau berikan <em>Instruksi Manual AI</em> untuk perapian khusus.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>Tempel Gambar (Ctrl+V) & Import File:</strong> Tempel screenshot langsung dari clipboard atau import file (.md/.txt) dari komputer.</span>
									</li>
								</ul>
							</Card>

							<Card class="p-5 py-5 gap-2 bg-muted/15 shadow-none">
								<div class="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
									<Sparkles class="h-4 w-4 text-muted-foreground" />
									<span>Perbedaan 2 Sistem AI di Portal Ini</span>
								</div>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>AI Assistant Dokumen (<code>Ctrl+I</code>):</strong> Lingkupnya <strong>100% terkunci hanya pada 1 dokumen aktif</strong> (untuk merangkum, membedah rumus/kode, & menyematkan ringkasan di atas artikel).</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>Chat AI Copilot Global (<code>Ctrl+J</code>):</strong> Muncul sebagai Drawer di sisi kanan untuk menjawab pertanyaan lintas seluruh dokumen & 7 aplikasi enterprise.</span>
									</li>
								</ul>
							</Card>
						</div>
					</div>
				{:else if activeGuideTab === 'features'}
					<!-- TAB 2: DETAILED 6 CORE FEATURES GRID -->
					<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{#each detailedFeatures as feat}
							<Card class="p-5 py-5 gap-3 bg-muted/15 shadow-none">
								<div class="flex items-center justify-between">
									<div class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
										<feat.icon class="h-4 w-4" />
									</div>
									<Badge variant="outline" class="text-[10px]">{feat.category}</Badge>
								</div>
								<h3 class="text-sm font-bold text-foreground">
									{feat.title}
								</h3>
								<ul class="space-y-2 text-xs text-muted-foreground leading-relaxed">
									{#each feat.points as pt}
										<li class="flex items-start gap-2">
											<span class="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0"></span>
											<span>{pt}</span>
										</li>
									{/each}
								</ul>
							</Card>
						{/each}
					</div>
				{:else}
					<!-- TAB 3: KEYBOARD SHORTCUTS & GESTURES TABLE -->
					<div class="overflow-hidden rounded-xl border border-border bg-background">
						<div class="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
							{#each shortcutsList as item}
								<div class="flex items-center justify-between gap-4 p-4 border-b border-border/60">
									<span class="text-xs text-muted-foreground leading-snug">
										{item.action}
									</span>
									<Badge variant="secondary" class="shrink-0 px-2.5 py-1 font-mono text-xs font-semibold">
										{item.keys}
									</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Bottom CTA Bar inside Overview Guide Card -->
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
					<div class="flex items-center gap-3 text-xs text-muted-foreground">
						<Layers class="h-4 w-4 text-muted-foreground shrink-0" />
						<span>
							Ingin membuka daftar aplikasi operasional seperti <strong>Fuel Management System (FMS)</strong>, <strong>SAC Production</strong>, <strong>Marketing</strong>, atau <strong>KPI Safety</strong>?
						</span>
					</div>
					<div class="flex items-center gap-2.5 shrink-0">
						<Button variant="outline" size="sm" href="/apps" class="gap-1.5 text-xs">
							<Layers class="h-3.5 w-3.5" />
							<span>Buka Apps</span>
						</Button>
						<Button size="sm" href="/docs/sap/overview" class="gap-1.5 text-xs">
							<FileText class="h-3.5 w-3.5" />
							<span>Mulai Mencatat Dokumentasi</span>
							<ArrowRight class="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	</section>
</div>
