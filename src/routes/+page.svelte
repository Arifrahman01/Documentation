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
			desc: 'Gunakan File Explorer di sisi kiri untuk memfilter modul (SAP, SAC, WEB). Buat Folder atau File Catatan baru secara instan seperti di Obsidian.',
			badge: 'File Explorer'
		},
		{
			step: '02',
			title: 'Klik Kanan atau Double-Click (Gaya Obsidian)',
			desc: 'Klik kanan di mana saja pada halaman dokumen atau pohon Explorer untuk membuka menu aksi: Buat File, Buat Folder, Edit Catatan, Duplikat, atau Hapus.',
			badge: 'Context Menu'
		},
		{
			step: '03',
			title: 'Tulis Langsung dengan Template & Paste Gambar',
			desc: 'Fokus menulis isi catatan saja (metadata modul & folder terisi otomatis). Gunakan Template 1-Klik, Split-View, atau tekan Ctrl+V untuk menempel screenshot.',
			badge: 'In-Page Editor'
		},
		{
			step: '04',
			title: 'Rapikan Catatan Mentah & Analisis dengan AI',
			desc: 'Tempel catatan kasar lalu klik "Rapikan Format". Gunakan "AI Assistant (Ctrl+I)" untuk analisis 1 dokumen aktif, atau "AI Copilot (Ctrl+J)" untuk tanya-jawab global.',
			badge: 'Dual AI System'
		}
	];

	const detailedFeatures = [
		{
			icon: MousePointerClick,
			title: 'Menu Klik Kanan & Double-Click Edit',
			category: 'Navigasi & Aksi',
			points: [
				'Klik kanan pada nama file/folder di Explorer atau isi artikel untuk membuka menu aksi cepat.',
				'Klik 2x (Double-Click) langsung pada paragraf artikel untuk masuk ke mode Edit.',
				'Mendukung fitur "Duplikat File Catatan" untuk menggandakan struktur dokumen yang mirip dalam 1 detik.'
			]
		},
		{
			icon: FolderTree,
			title: 'File Explorer Folder & Sub-Folder',
			category: 'Organisasi File',
			points: [
				'Kelompokkan dokumen ke dalam 3 pilar utama (SAP, SAC, WEB), Folder Kategori, hingga Sub-Folder.',
				'Klik tombol (+) di samping nama Folder untuk langsung menambah file catatan baru di dalam folder tersebut.',
				'Detail lokasi (SAP/SAC/WEB & Folder) terisi 100% otomatis sesuai tempat Anda membuat file.'
			]
		},
		{
			icon: LayoutTemplate,
			title: '4 Template Instan & Import File (.md / .txt)',
			category: 'Pencatatan Cepat',
			points: [
				'4 Template 1-Klik: Template SAC Story, Template SAP/ABAP, Template Web & API, serta Template SOP/Troubleshooting.',
				'Import file .md atau .txt dari komputer langsung ke dalam kotak ketik.',
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
				'Tombol "Rapikan Format" di Editor mengubah catatan mentah menjadi struktur Heading & Tabel rapi tanpa mengubah fakta.'
			]
		},
		{
			icon: Save,
			title: 'Ekspor Markdown & Integrasi Program Navigator',
			category: 'Keamanan Data',
			points: [
				'Setiap dokumentasi dapat disalin tautannya, disalin Raw Markdown-nya, atau diunduh sebagai file .md.',
				'Terhubung langsung dengan halaman Program Navigator untuk mendokumentasikan aplikasi operasional.',
				'Seluruh antarmuka menggunakan komponen standar Shadcn UI yang seragam dan bebas distraksi.'
			]
		}
	];

	const shortcutsList = [
		{ keys: 'Klik Kanan', action: 'Membuka menu konteks (Buat File/Folder, Edit, Duplikat, AI Dokumen, Unduh, Hapus)' },
		{ keys: 'Double-Click', action: 'Klik 2x pada teks artikel untuk langsung mengedit dokumen aktif' },
		{ keys: 'Alt + N / N', action: 'Membuat File Catatan Baru di File Explorer' },
		{ keys: 'Alt + F / F', action: 'Membuat Folder Baru di File Explorer' },
		{ keys: 'Ctrl + E / E', action: 'Membuka Editor untuk dokumen yang sedang aktif (Ctrl+S untuk Simpan)' },
		{ keys: 'Ctrl + I / I', action: 'Membuka Modal AI Assistant Khusus Dokumen Ini (Lingkup Terkunci 1 Dokumen)' },
		{ keys: 'Ctrl + J', action: 'Membuka laci Chat AI Copilot Global (SAP, SAC, Web & 7 Aplikasi)' },
		{ keys: 'Ctrl + K', action: 'Membuka Pencarian Cepat Global (Dokumen & Program Navigator)' },
		{ keys: 'Ctrl + V', action: 'Menempelkan (Paste) gambar/screenshot langsung ke dalam Editor' },
		{ keys: 'ESC', action: 'Menutup editor, AI Assistant, pencarian, atau pratinjau gambar' }
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
				Pusat pencatatan dokumentasi teknis SAP, SAC Analytics, dan Web Stack dengan pengalaman menulis cepat bergaya Obsidian & komponen Shadcn UI yang seragam.
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
					<span>Program Navigator (7 Apps)</span>
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
							<Badge variant="outline" class="text-[11px]">Obsidian Style</Badge>
						</div>
						<CardTitle class="text-2xl font-extrabold tracking-tight pt-1">
							Dokumentasi Penggunaan & Fitur Lengkap Portal
						</CardTitle>
						<CardDescription class="text-sm max-w-3xl">
							Program ini dirancang khusus untuk mempermudah pencatatan, pengorganisasian, dan pencarian dokumentasi teknis enterprise dengan menggabungkan kecepatan <strong>Obsidian File Explorer</strong> dan keseragaman <strong>Shadcn UI</strong>.
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
										<span>Pilih modul (<code>SAP</code>, <code>SAC</code>, atau <code>WEB</code>) di bagian atas.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span>Klik ikon <strong>Folder+</strong> atau <strong>File+</strong> di Explorer kiri untuk membuat folder atau catatan baru.</span>
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
										<span><strong>Pakai Template 1-Klik:</strong> Klik <em>Template SAC Story</em>, <em>SAP/ABAP</em>, <em>Web/API</em>, atau <em>SOP</em> di dalam editor.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>Paste Catatan Kasar + Rapikan AI:</strong> Tempel catatan mentah lalu klik tombol <strong>Rapikan Format</strong>.</span>
									</li>
									<li class="flex items-start gap-2">
										<CheckCircle2 class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
										<span><strong>Import File (.md / .txt):</strong> Klik tombol <em>Import (.md)</em> di bar atas editor.</span>
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
							<span>Buka Program Navigator</span>
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
