<script lang="ts">
	import { page } from '$app/state';
	import { ui } from '$lib/stores/ui.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Search, 
		Sparkles, 
		Sun, 
		Moon, 
		BookOpen, 
		Layers, 
		Terminal, 
		Home,
		Menu,
		X,
		ChevronDown,
		Building2,
		BarChart3,
		Globe
	} from '@lucide/svelte';

	let mobileMenuOpen = $state(false);

	const docSections = [
		{ name: 'SAP Enterprise', desc: 'ERP, S/4HANA, ABAP, RFC & BAPI', href: '/docs/sap/overview', icon: Building2, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300' },
		{ name: 'SAC Analytics', desc: 'Stories, Dashboards & Live Data', href: '/docs/sac/overview', icon: BarChart3, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300' },
		{ name: 'WEB Stack', desc: 'SvelteKit, REST APIs & Security', href: '/docs/web/architecture', icon: Globe, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300' }
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
				<div class="relative flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-xs ring-1 ring-zinc-900/10 dark:bg-white dark:text-zinc-950">
					<img src="/logo.png" alt="Logo" class="h-6 w-6 object-contain" />
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
				<a
					href="/"
					class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isActive('/') 
						? 'bg-muted text-foreground' 
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
				>
					<Home class="h-4 w-4 opacity-70" />
					<span>Overview</span>
				</a>

				<!-- Documentation Dropdown Menu (SAP, SAC, WEB) -->
				<div class="relative group">
					<a
						href="/docs/sap/overview"
						class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isActive('/docs') 
							? 'bg-muted text-foreground' 
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
					>
						<BookOpen class="h-4 w-4 opacity-70" />
						<span>Documentation</span>
						<ChevronDown class="h-3.5 w-3.5 opacity-50 transition-transform group-hover:rotate-180" />
					</a>

					<!-- Dropdown Flyout Panel -->
					<div class="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 absolute top-full left-0 pt-1.5 w-80 z-50">
						<div class="rounded-xl border border-border bg-background/95 backdrop-blur-md p-2 shadow-xl">
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
										<div class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md {sec.color}">
											<sec.icon class="h-4 w-4" />
										</div>
										<div class="flex-1">
											<div class="text-xs font-semibold text-foreground flex items-center justify-between">
												<span>{sec.name}</span>
												<span class="text-[9px] opacity-70">Buka &rarr;</span>
											</div>
											<div class="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sec.desc}</div>
										</div>
									</a>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<a
					href="/apps"
					class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isActive('/apps') 
						? 'bg-muted text-foreground' 
						: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
				>
					<Layers class="h-4 w-4 opacity-70" />
					<span>Program Navigator</span>
				</a>
			</nav>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2.5">
			<!-- Global Search Trigger with Shadcn Button -->
			<Button
				variant="outline"
				size="sm"
				onclick={() => ui.openSearch()}
				class="h-9 w-56 justify-between px-3 text-xs text-muted-foreground sm:w-64"
			>
				<span class="flex items-center gap-2">
					<Search class="h-3.5 w-3.5" />
					<span>Search documentation...</span>
				</span>
				<kbd class="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
					Ctrl K
				</kbd>
			</Button>

			<!-- AI Copilot Button with Shadcn Button -->
			<Button
				size="sm"
				onclick={() => ui.openAi()}
				class="h-9 gap-1.5 text-xs font-semibold shadow-xs"
			>
				<Sparkles class="h-3.5 w-3.5 text-amber-300 dark:text-amber-500" />
				<span>AI Copilot</span>
				<kbd class="hidden lg:inline-flex items-center rounded bg-zinc-800 px-1 py-0.2 text-[9px] text-zinc-300 dark:bg-zinc-200 dark:text-zinc-700">
					Ctrl J
				</kbd>
			</Button>

			<!-- Theme Toggle with Shadcn Button -->
			<Button
				variant="outline"
				size="icon"
				onclick={() => ui.toggleTheme()}
				aria-label="Toggle theme"
				class="h-9 w-9 text-muted-foreground"
			>
				{#if ui.isDark}
					<Sun class="h-4 w-4" />
				{:else}
					<Moon class="h-4 w-4" />
				{/if}
			</Button>

			<!-- Mobile Menu Button -->
			<Button
				variant="outline"
				size="icon"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				class="h-9 w-9 md:hidden text-muted-foreground"
			>
				{#if mobileMenuOpen}
					<X class="h-4 w-4" />
				{:else}
					<Menu class="h-4 w-4" />
				{/if}
			</Button>
		</div>
	</div>

	<!-- Mobile Menu Dropdown -->
	{#if mobileMenuOpen}
		<div class="border-b border-border bg-background p-4 md:hidden space-y-3">
			<div class="flex flex-col gap-1">
				<a
					href="/"
					onclick={() => (mobileMenuOpen = false)}
					class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium {isActive('/') 
						? 'bg-muted text-foreground' 
						: 'text-muted-foreground'}"
				>
					<Home class="h-4 w-4" />
					<span>Overview</span>
				</a>

				<!-- Mobile Documentation Section (SAP, SAC, WEB) -->
				<div class="pt-1 pb-1">
					<div class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
						Documentation
					</div>
					<div class="space-y-0.5 pl-2">
						{#each docSections as sec}
							<a
								href={sec.href}
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
							>
								<sec.icon class="h-3.5 w-3.5 text-muted-foreground" />
								<span>{sec.name}</span>
							</a>
						{/each}
					</div>
				</div>

				<a
					href="/apps"
					onclick={() => (mobileMenuOpen = false)}
					class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium {isActive('/apps') 
						? 'bg-muted text-foreground' 
						: 'text-muted-foreground'}"
				>
					<Layers class="h-4 w-4" />
					<span>Program Navigator</span>
				</a>
			</div>
		</div>
	{/if}
</header>
