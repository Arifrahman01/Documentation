<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		BookUser,
		Lock,
		ShieldAlert,
		FileText,
		FolderOpen,
		Sparkles,
		House,
		BookOpen,
		Layers,
		RotateCcw,
		CircleCheck,
		ArrowRight
	} from '@lucide/svelte';

	function handleReload() {
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}
</script>

<svelte:head>
	<title>My Docs - Ruang Catatan & Dokumentasi Pribadi</title>
	<meta
		name="description"
		content="Kelola catatan teknis, draf arsitektur, dan ringkasan kerja harian dalam ruang penyimpanan terisolasi aman."
	/>
</svelte:head>

<div class="relative min-h-[calc(100vh-14rem)] py-12 px-4 sm:px-6 lg:px-8">
	<!-- Background Ambient Glow -->
	<div
		class="pointer-events-none absolute inset-x-0 top-12 flex justify-center overflow-hidden"
		aria-hidden="true"
	>
		<div class="h-[380px] w-[620px] rounded-full bg-gradient-to-tr from-amber-500/15 via-primary/10 to-transparent blur-3xl"></div>
	</div>

	<div class="relative mx-auto max-w-4xl space-y-10">
		<!-- HERO SECTION -->
		<div class="text-center space-y-4">
			<div class="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3.5 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-xs shadow-2xs">
				<BookUser class="size-3.5 text-primary" />
				<span>Ruang Kerja Personal • My Docs</span>
			</div>

			<h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
				Ruang Catatan & Dokumentasi Pribadi
			</h1>

			<p class="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
				Pusat penulisan draf teknis, ringkasan arsitektur sistem, dan catatan harian Anda dalam ruang penyimpanan yang terisolasi aman untuk setiap akun pengguna.
			</p>
		</div>

		<!-- SESSION STATUS / AUTH CALLOUT -->
		<div class="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-6 sm:p-8 backdrop-blur-sm shadow-md">
			<div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
				<div class="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-inner">
					<Lock class="size-7 stroke-[2.2]" />
					<div class="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-background border border-amber-500/40 text-amber-500 shadow-2xs">
						<ShieldAlert class="size-3" />
					</div>
				</div>

				<div class="flex-1 space-y-1.5">
					<div class="flex items-center gap-2">
						<span class="inline-flex size-2 rounded-full bg-amber-500 animate-pulse"></span>
						<h2 class="text-base sm:text-lg font-bold text-foreground">
							Sesi Pengguna Belum Terdeteksi
						</h2>
					</div>
					<p class="text-xs sm:text-sm text-muted-foreground leading-relaxed">
						Untuk menjamin kerahasiaan dan privasi data kerja Anda, akses ke <strong>My Docs</strong> hanya terbuka bagi pengguna yang telah masuk melalui portal utama enterprise. Silakan login atau gunakan kredensial SSO akun Anda.
					</p>
				</div>

				<div class="shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
					<Button
						variant="outline"
						onclick={handleReload}
						class="w-full sm:w-auto h-9 gap-1.5 text-xs font-semibold border-amber-500/40 hover:bg-amber-500/10 hover:text-foreground text-amber-700 dark:text-amber-300"
					>
						<RotateCcw class="size-3.5" />
						<span>Cek Ulang Sesi</span>
					</Button>
				</div>
			</div>
		</div>

		<!-- FEATURE PREVIEW BENTO GRID -->
		<div class="space-y-4">
			<div class="text-center sm:text-left">
				<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground">
					Kapabilitas My Docs yang Siap Digunakan
				</h3>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<!-- Card 1 -->
				<div class="group relative rounded-2xl border border-border/80 bg-card/60 p-5 shadow-2xs backdrop-blur-xs transition-all hover:border-primary/40 hover:bg-muted/40">
					<div class="flex items-start gap-4">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
							<FileText class="size-5" />
						</div>
						<div class="space-y-1">
							<h4 class="text-sm font-bold text-foreground">Editor Markdown Instan & Mode Baca</h4>
							<p class="text-xs text-muted-foreground leading-relaxed">
								Tulis dan pratinjau catatan teknis dengan tabel data, blok kode bersintaks, checklist tugas, dan toggle Mode Baca satu klik.
							</p>
						</div>
					</div>
				</div>

				<!-- Card 2 -->
				<div class="group relative rounded-2xl border border-border/80 bg-card/60 p-5 shadow-2xs backdrop-blur-xs transition-all hover:border-primary/40 hover:bg-muted/40">
					<div class="flex items-start gap-4">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
							<FolderOpen class="size-5" />
						</div>
						<div class="space-y-1">
							<h4 class="text-sm font-bold text-foreground">Manajemen Folder & Kategori Hirarkis</h4>
							<p class="text-xs text-muted-foreground leading-relaxed">
								Organisasikan catatan Anda ke dalam folder kustom seperti Catatan Harian, Dokumentasi Modul, atau SOP Operasional.
							</p>
						</div>
					</div>
				</div>

				<!-- Card 3 -->
				<div class="group relative rounded-2xl border border-border/80 bg-card/60 p-5 shadow-2xs backdrop-blur-xs transition-all hover:border-primary/40 hover:bg-muted/40">
					<div class="flex items-start gap-4">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
							<Sparkles class="size-5" />
						</div>
						<div class="space-y-1">
							<h4 class="text-sm font-bold text-foreground">Bantuan AI Copilot Terintegrasi</h4>
							<p class="text-xs text-muted-foreground leading-relaxed">
								Rapikan format catatan mentah, buat ringkasan eksekutif, dan ajukan pertanyaan seputar dokumen aktif langsung ke AI.
							</p>
						</div>
					</div>
				</div>

				<!-- Card 4 -->
				<div class="group relative rounded-2xl border border-border/80 bg-card/60 p-5 shadow-2xs backdrop-blur-xs transition-all hover:border-primary/40 hover:bg-muted/40">
					<div class="flex items-start gap-4">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
							<CircleCheck class="size-5" />
						</div>
						<div class="space-y-1">
							<h4 class="text-sm font-bold text-foreground">Penyimpanan Terenkripsi & Terisolasi</h4>
							<p class="text-xs text-muted-foreground leading-relaxed">
								Setiap pengguna memiliki ruang penyimpanan terpisah yang aman dan tidak dapat diakses atau diubah oleh pengguna lain.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- ALTERNATIVE PUBLIC ACCESS -->
		<div class="rounded-2xl border border-border/80 bg-card/40 p-6 sm:p-8 text-center space-y-4">
			<h3 class="text-base sm:text-lg font-bold text-foreground">
				Ingin Mengakses Panduan Sistem atau Aplikasi Tanpa Login?
			</h3>
			<p class="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
				Seluruh dokumentasi teknis publik seputar SAP ERP, SAC, dan Arsitektur Web serta navigasi 7 aplikasi enterprise tetap dapat dibuka secara bebas.
			</p>

			<div class="flex flex-wrap items-center justify-center gap-3 pt-2">
				<Button
					variant="default"
					href="/docs/sap/overview"
					class="h-9 gap-2 px-4 text-xs font-semibold shadow-xs"
				>
					<BookOpen class="size-4" />
					<span>Buka Dokumentasi Publik</span>
				</Button>

				<Button
					variant="outline"
					href="/apps"
					class="h-9 gap-2 px-4 text-xs font-medium"
				>
					<Layers class="size-4 text-primary" />
					<span>Direktori Aplikasi</span>
				</Button>

				<Button
					variant="ghost"
					href="/"
					class="h-9 gap-2 px-4 text-xs text-muted-foreground hover:text-foreground"
				>
					<House class="size-4" />
					<span>Kembali ke Beranda</span>
				</Button>
			</div>
		</div>
	</div>
</div>
