<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import {
		Lock,
		ShieldAlert,
		FileQuestionMark,
		TriangleAlert,
		House,
		BookOpen,
		Layers,
		RotateCcw,
		Sparkles,
		ArrowLeft
	} from '@lucide/svelte';

	const status = $derived(page.status);
	const message = $derived(
		page.error?.message ||
			(status === 401
				? 'Sesi pengguna tidak ditemukan. Silakan login melalui portal utama terlebih dahulu.'
				: status === 404
					? 'Halaman atau berkas yang Anda cari tidak dapat ditemukan.'
					: 'Terjadi kendala pada server saat memproses permintaan Anda.')
	);

	const isMyDocs = $derived(
		page.url.pathname.startsWith('/my-docs') || status === 401
	);

	function handleReload() {
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}
</script>

<svelte:head>
	<title>
		{status === 401
			? '401 - Sesi Tidak Ditemukan | My Docs'
			: status === 404
				? '404 - Halaman Tidak Ditemukan'
				: `${status} - Kendala Sistem`}
	</title>
</svelte:head>

<div class="relative min-h-[calc(100vh-12rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<!-- Ambient Background Glow -->
	<div
		class="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
		aria-hidden="true"
	>
		<div
			class="h-[360px] w-[500px] rounded-full blur-3xl opacity-20 dark:opacity-25"
			class:bg-amber-500={status === 401}
			class:bg-blue-500={status === 404}
			class:bg-red-500={status >= 500}
		></div>
	</div>

	<!-- Main Card Content -->
	<div class="relative w-full max-w-2xl text-center space-y-6">
		<!-- Icon & Badge Container -->
		<div class="flex flex-col items-center">
			{#if status === 401}
				<!-- 401 Unauthorized / Locked Session Badge & Icon -->
				<div class="mb-5 relative flex size-20 items-center justify-center rounded-3xl border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/10">
					<Lock class="size-9 stroke-[2.2]" />
					<div class="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-background border border-amber-500/30 text-amber-500 shadow-xs">
						<ShieldAlert class="size-3.5" />
					</div>
				</div>

				<div class="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
					<span class="size-1.5 rounded-full bg-amber-500 animate-pulse"></span>
					<span>Status 401 • Autentikasi Diperlukan</span>
				</div>
			{:else if status === 404}
				<!-- 404 Not Found -->
				<div class="mb-5 flex size-20 items-center justify-center rounded-3xl border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/10">
					<FileQuestionMark class="size-9 stroke-[2.2]" />
				</div>

				<div class="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
					<span class="size-1.5 rounded-full bg-blue-500"></span>
					<span>Status 404 • Halaman Tidak Ditemukan</span>
				</div>
			{:else}
				<!-- 500+ Server Error -->
				<div class="mb-5 flex size-20 items-center justify-center rounded-3xl border border-destructive/25 bg-destructive/10 text-destructive shadow-lg shadow-destructive/10">
					<TriangleAlert class="size-9 stroke-[2.2]" />
				</div>

				<div class="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3.5 py-1 text-xs font-semibold text-destructive">
					<span class="size-1.5 rounded-full bg-destructive animate-pulse"></span>
					<span>Status {status} • Kendala Sistem</span>
				</div>
			{/if}
		</div>

		<!-- Title & Subtitle -->
		<div class="space-y-2">
			<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
				{#if status === 401}
					Sesi Pengguna Tidak Ditemukan
				{:else if status === 404}
					Halaman Tidak Ditemukan
				{:else}
					Terjadi Kendala pada Sistem
				{/if}
			</h1>
			<p class="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
				{message}
			</p>
		</div>

		{#if isMyDocs && status === 401}
			<!-- Guidance Bento Box for 401 My Docs -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
				<div class="rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs backdrop-blur-xs space-y-1.5">
					<div class="flex items-center gap-2 text-xs font-bold text-foreground">
						<Lock class="size-3.5 text-amber-500 shrink-0" />
						<span>Ruang Catatan Pribadi</span>
					</div>
					<p class="text-xs text-muted-foreground leading-relaxed">
						Fitur <strong>My Docs</strong> menyimpan catatan unik per akun. Anda harus login di sistem utama enterprise untuk membuka ruang ini.
					</p>
				</div>

				<div class="rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs backdrop-blur-xs space-y-1.5">
					<div class="flex items-center gap-2 text-xs font-bold text-foreground">
						<BookOpen class="size-3.5 text-primary shrink-0" />
						<span>Dokumentasi Terbuka</span>
					</div>
					<p class="text-xs text-muted-foreground leading-relaxed">
						Seluruh panduan teknis <strong>SAP ERP, SAC, dan Web Stack</strong> tetap dapat dibaca secara publik tanpa memerlukan sesi login.
					</p>
				</div>

				<div class="rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs backdrop-blur-xs space-y-1.5">
					<div class="flex items-center gap-2 text-xs font-bold text-foreground">
						<Sparkles class="size-3.5 text-primary shrink-0" />
						<span>AI Copilot Aktif</span>
					</div>
					<p class="text-xs text-muted-foreground leading-relaxed">
						Anda tetap dapat berkonsultasi seputar troubleshooting dan arsitektur enterprise melalui tombol <strong>AI Copilot</strong>.
					</p>
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="flex flex-wrap items-center justify-center gap-2.5 pt-4">
			<Button
				variant="default"
				href="/"
				class="h-9 gap-2 px-4 text-xs font-semibold shadow-xs"
			>
				<House class="size-4" />
				<span>Kembali ke Beranda</span>
			</Button>

			<Button
				variant="outline"
				href="/docs/sap/overview"
				class="h-9 gap-2 px-4 text-xs font-medium"
			>
				<BookOpen class="size-4 text-primary" />
				<span>Buka Dokumentasi Publik</span>
			</Button>

			<Button
				variant="outline"
				href="/apps"
				class="h-9 gap-2 px-4 text-xs font-medium text-muted-foreground hover:text-foreground"
			>
				<Layers class="size-4" />
				<span>Ekosistem Aplikasi</span>
			</Button>

			<Button
				variant="ghost"
				onclick={handleReload}
				class="h-9 gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground"
				title="Muat ulang halaman"
			>
				<RotateCcw class="size-3.5" />
				<span>Muat Ulang</span>
			</Button>
		</div>

		<!-- Subtle Help Text -->
		<div class="pt-4 text-xs text-muted-foreground/80">
			<span>Butuh bantuan akses akun? Hubungi Administrator IT Enterprise atau gunakan SSO Portal Resmi.</span>
		</div>
	</div>
</div>
