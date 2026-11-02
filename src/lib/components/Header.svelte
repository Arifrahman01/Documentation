<script lang="ts">
	import { page } from '$app/state';
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Search, 
		Sparkles, 
		Sun, 
		Moon, 
		BookOpen, 
		Layers, 
		Home,
		Menu,
		X,
		ChevronDown,
		Building2,
		BarChart3,
		Globe,
		User,
		BookUser,
		RefreshCw,
		CheckCircle2,
		AlertCircle
	} from '@lucide/svelte';

	let mobileMenuOpen = $state(false);
	let isArifRahman = $derived(
		Boolean(auth.userName && auth.userName.toLowerCase().trim() === 'arif rahman')
	);

	const docSections = [
		{ name: 'SAP Enterprise', desc: 'ERP, S/4HANA, ABAP, RFC & BAPI', href: '/docs/sap/overview', icon: Building2 },
		{ name: 'SAC Analytics', desc: 'Stories, Dashboards & Live Data', href: '/docs/sac/overview', icon: BarChart3 },
		{ name: 'WEB Stack', desc: 'SvelteKit, REST APIs & Security', href: '/docs/web/architecture', icon: Globe }
	];

	function isActive(href: string) {
		const currentPath = page.url.pathname;
		if (href === '/') return currentPath === '/';
		if (href.startsWith('/docs')) return currentPath.startsWith('/docs');
		return currentPath.startsWith(href);
	}
</script>

<header class="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Brand & Logo -->
		<div class="flex items-center gap-6">
			<a href="/" class="group flex items-center gap-3 transition-opacity hover:opacity-90">
				<div class="relative flex size-9 items-center justify-center rounded-xl border border-border/80 bg-card/90 text-foreground shadow-2xs overflow-hidden transition-all group-hover:border-foreground/40 group-hover:shadow-xs">
					<div class="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-foreground/10 pointer-events-none"></div>
					<!-- Bold Monochrome BookUser Logo with Grey Gradient -->
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="relative size-5.5 transition-transform duration-200 group-hover:scale-105" aria-hidden="true">
						<defs>
							<!-- Dark Theme: Bold Silver / Platinum Metallic Gradient -->
							<linearGradient id="headerLogoSilver" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#ffffff"/>
								<stop offset="50%" stop-color="#e2e8f0"/>
								<stop offset="100%" stop-color="#94a3b8"/>
							</linearGradient>
							<!-- Light Theme: Bold Charcoal Grey Gradient -->
							<linearGradient id="headerLogoCharcoal" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#09090b"/>
								<stop offset="50%" stop-color="#27272a"/>
								<stop offset="100%" stop-color="#52525b"/>
							</linearGradient>
						</defs>
						<!-- Book Cover & Spine -->
						<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" 
							fill="none" 
							class="stroke-[url(#headerLogoCharcoal)] dark:stroke-[url(#headerLogoSilver)]" 
							stroke-width="2.25" 
							stroke-linecap="round" 
							stroke-linejoin="round" />
						<!-- User Head (Solid filled for bold iconic presence) -->
						<circle cx="12" cy="8" r="2.2" 
							class="fill-[url(#headerLogoCharcoal)] dark:fill-[url(#headerLogoSilver)]" />
						<!-- User Shoulders -->
						<path d="M15.5 13.5a3.5 3.5 0 1 0-7 0" 
							fill="none" 
							class="stroke-[url(#headerLogoCharcoal)] dark:stroke-[url(#headerLogoSilver)]" 
							stroke-width="2.25" 
							stroke-linecap="round" />
					</svg>
				</div>
				<div class="flex flex-col">
					<div class="flex items-center gap-2">
						<span class="text-base font-bold tracking-tight text-foreground">Documentation</span>
						<Badge variant="secondary" class="h-5 px-1.5 text-[10px]">v1.0</Badge>
					</div>
				</div>
			</a>

			<!-- Desktop Nav Links -->
			<nav class="hidden md:flex items-center gap-1 pl-4">
				<Button
					variant={isActive('/') ? 'secondary' : 'ghost'}
					size="sm"
					href="/"
					class="h-8 gap-2 px-3 text-sm font-medium"
				>
					<Home class="h-4 w-4 text-muted-foreground" />
					<span>Overview</span>
				</Button>

				<!-- Documentation Dropdown Menu (SAP, SAC, WEB) -->
				<div class="relative group">
					<Button
						variant={isActive('/docs') ? 'secondary' : 'ghost'}
						size="sm"
						href="/docs/sap/overview"
						class="h-8 gap-1.5 px-3 text-sm font-medium"
					>
						<BookOpen class="h-4 w-4 text-muted-foreground" />
						<span>Documentation</span>
						<ChevronDown class="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:rotate-180" />
					</Button>

					<!-- Dropdown Flyout Panel -->
					<div class="invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150 absolute top-full left-0 pt-1.5 w-80 z-50">
						<div class="rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
							<div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
								Bagian Utama Dokumentasi
							</div>
							<div class="mt-1 space-y-1">
								{#each docSections as sec}
									<a
										href={sec.href}
										onclick={(e) => (e.currentTarget as HTMLElement).blur()}
										class="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted"
									>
										<div class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-foreground">
											<sec.icon class="h-4 w-4" />
										</div>
										<div class="flex-1">
											<div class="text-xs font-semibold text-foreground flex items-center justify-between">
												<span>{sec.name}</span>
												<span class="text-[9px] text-muted-foreground">Buka</span>
											</div>
											<div class="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sec.desc}</div>
										</div>
									</a>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<Button
					variant={isActive('/apps') ? 'secondary' : 'ghost'}
					size="sm"
					href="/apps"
					class="h-8 gap-1.5 px-3 text-sm font-medium"
				>
					<Layers class="h-4 w-4 text-muted-foreground" />
					<span>Apps</span>
				</Button>

				<Button
					variant={isActive('/my-docs') ? 'secondary' : 'ghost'}
					size="sm"
					href="/my-docs"
					class="h-8 gap-1.5 px-3 text-sm font-medium"
				>
					<BookUser class="h-4 w-4 text-muted-foreground" />
					<span>My Docs</span>
				</Button>
			</nav>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2 sm:gap-2.5">
			<!-- Global Search Trigger with Shadcn Button -->
			<Button
				variant="outline"
				size="sm"
				onclick={() => ui.openSearch()}
				class="h-9 w-9 p-0 sm:w-52 md:w-64 sm:px-3 sm:justify-between text-xs text-muted-foreground shrink-0 cursor-pointer"
				title="Cari dokumentasi (Ctrl+K)"
				aria-label="Cari dokumentasi"
			>
				<span class="flex items-center gap-2 truncate pointer-events-none">
					<Search class="h-3.5 w-3.5 shrink-0" />
					<span class="hidden sm:inline truncate">Cari dokumentasi...</span>
				</span>
				<Badge variant="secondary" class="hidden sm:inline-flex px-1.5 py-0 text-[10px] font-mono pointer-events-none">
					Ctrl K
				</Badge>
			</Button>

			<!-- AI Copilot Button with Shadcn Button -->
			<Button
				size="sm"
				onclick={() => ui.openAi()}
				class="h-9 gap-1.5 text-xs font-semibold shadow-2xs px-2.5 sm:px-3 shrink-0 cursor-pointer"
				title="AI Copilot (Ctrl+J)"
				aria-label="Buka AI Copilot"
			>
				<Sparkles class="h-3.5 w-3.5 pointer-events-none" />
				<span class="hidden sm:inline pointer-events-none">AI Copilot</span>
				<span class="sm:hidden font-medium pointer-events-none">AI</span>
				<Badge variant="secondary" class="hidden lg:inline-flex px-1 py-0 text-[9px] font-mono pointer-events-none">
					Ctrl J
				</Badge>
			</Button>

			<!-- Manual Auto-Sync Button for Arif Rahman -->
			{#if isArifRahman}
				<Button
					variant="outline"
					size="sm"
					onclick={() => ui.openSyncModal(false)}
					class="h-9 gap-1.5 text-xs font-semibold px-2.5 sm:px-3 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 shadow-2xs shrink-0 cursor-pointer transition-all active:scale-95"
					title="Buka Detail & Jalankan Sinkronisasi Dokumen Eksternal"
					aria-label="Detail Sinkronisasi Dokumen Eksternal"
				>
					<RefreshCw class="h-3.5 w-3.5 pointer-events-none" />
					<span class="hidden lg:inline pointer-events-none">
						Sync Dokumen
					</span>
				</Button>
			{/if}

			<!-- User Avatar & Name Badge (Session User / Helpdesk) -->
			<a
				href="/my-docs"
				class="inline-flex items-center gap-2 h-9 rounded-lg border border-border bg-card/80 hover:bg-muted/80 px-2 sm:px-2.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 shadow-2xs shrink-0 cursor-pointer"
				title={auth.userName ? `Pengguna Aktif: ${auth.userName} (Buka My Docs)` : 'Belum ada sesi login Helpdesk — Silakan login di Helpdesk terlebih dahulu'}
			>
				<div class="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full {auth.userName ? 'bg-primary/15 text-primary ring-1 ring-primary/25' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'} pointer-events-none">
					<User class="h-3.5 w-3.5" />
					<span class="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full {auth.userName ? 'bg-emerald-500' : 'bg-amber-500'} ring-1 ring-background"></span>
				</div>
				<span class="max-w-[75px] xs:max-w-[105px] sm:max-w-[130px] md:max-w-[160px] truncate font-medium pointer-events-none {auth.userName ? '' : 'text-amber-600 dark:text-amber-400'}">
					{auth.userName || 'Belum Login'}
				</span>
			</a>

			<!-- Theme Toggle with Shadcn Button -->
			<Button
				variant="outline"
				size="icon"
				onclick={() => ui.toggleTheme()}
				aria-label="Ubah tema warna"
				class="h-9 w-9 text-muted-foreground shrink-0 cursor-pointer"
			>
				{#if ui.isDark}
					<Sun class="h-4 w-4 pointer-events-none" />
				{:else}
					<Moon class="h-4 w-4 pointer-events-none" />
				{/if}
			</Button>

			<!-- Mobile Menu Button -->
			<Button
				variant="outline"
				size="icon"
				aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
				aria-expanded={mobileMenuOpen}
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				class="h-9 w-9 md:hidden text-muted-foreground shrink-0 cursor-pointer"
			>
				{#if mobileMenuOpen}
					<X class="h-4 w-4 pointer-events-none" />
				{:else}
					<Menu class="h-4 w-4 pointer-events-none" />
				{/if}
			</Button>
		</div>
	</div>

	<!-- Mobile Menu Dropdown -->
	{#if mobileMenuOpen}
		<div class="border-b border-border bg-background p-4 md:hidden space-y-3">
			<a
				href="/my-docs"
				onclick={() => (mobileMenuOpen = false)}
				class="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
			>
				<div class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full {auth.userName ? 'bg-primary/15 text-primary ring-1 ring-primary/25' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'}">
					<User class="h-4 w-4" />
					<span class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full {auth.userName ? 'bg-emerald-500' : 'bg-amber-500'} ring-1.5 ring-background"></span>
				</div>
				<div class="flex flex-col truncate">
					<span class="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sesi Helpdesk</span>
					<span class="truncate font-semibold {auth.userName ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'}">{auth.userName || 'Belum Login (Login di Helpdesk)'}</span>
				</div>
			</a>

			<div class="flex flex-col gap-1">
				<Button
					variant={isActive('/') ? 'secondary' : 'ghost'}
					size="sm"
					href="/"
					onclick={() => (mobileMenuOpen = false)}
					class="justify-start gap-2.5 text-sm font-medium"
				>
					<Home class="h-4 w-4" />
					<span>Overview</span>
				</Button>

				<!-- Mobile Documentation Section (SAP, SAC, WEB) -->
				<div class="pt-1 pb-1">
					<div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
						Documentation
					</div>
					<div class="space-y-0.5 pl-2">
						{#each docSections as sec}
							<Button
								variant="ghost"
								size="sm"
								href={sec.href}
								onclick={() => (mobileMenuOpen = false)}
								class="w-full justify-start gap-2.5 text-xs font-medium"
							>
								<sec.icon class="h-3.5 w-3.5 text-muted-foreground" />
								<span>{sec.name}</span>
							</Button>
						{/each}
					</div>
				</div>

				<Button
					variant={isActive('/apps') ? 'secondary' : 'ghost'}
					size="sm"
					href="/apps"
					onclick={() => (mobileMenuOpen = false)}
					class="justify-start gap-2.5 text-sm font-medium"
				>
					<Layers class="h-4 w-4" />
					<span>Apps</span>
				</Button>

				<Button
					variant={isActive('/my-docs') ? 'secondary' : 'ghost'}
					size="sm"
					href="/my-docs"
					onclick={() => (mobileMenuOpen = false)}
					class="justify-start gap-2.5 text-sm font-medium"
				>
					<BookUser class="h-4 w-4" />
					<span>My Docs</span>
				</Button>

				{#if isArifRahman}
					<div class="pt-2 border-t border-border/50">
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								mobileMenuOpen = false;
								ui.openSyncModal(false);
							}}
							class="w-full justify-center h-9 gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 shadow-2xs cursor-pointer active:scale-95 transition-transform"
						>
							<RefreshCw class="h-3.5 w-3.5 pointer-events-none" />
							<span>Detail Sync Dokumen Eksternal</span>
						</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</header>
