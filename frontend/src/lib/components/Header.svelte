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
		X
	} from '@lucide/svelte';

	let mobileMenuOpen = $state(false);

	const navItems = [
		{ name: 'Overview', href: '/', icon: Home },
		{ name: 'Documentation', href: '/docs/get-started/quick-start', icon: BookOpen },
		{ name: 'API Reference', href: '/api-reference', icon: Terminal },
		{ name: 'Program Navigator', href: '/apps', icon: Layers }
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
					<span class="text-[11px] text-muted-foreground">Enterprise Systems & Architecture</span>
				</div>
			</a>

			<!-- Desktop Nav Links -->
			<nav class="hidden md:flex items-center gap-1 pl-4">
				{#each navItems as item}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {active 
							? 'bg-muted text-foreground' 
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
					>
						<item.icon class="h-4 w-4 opacity-70" />
						{item.name}
					</a>
				{/each}
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
		<div class="border-b border-border bg-background p-4 md:hidden">
			<div class="flex flex-col gap-1">
				{#each navItems as item}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						onclick={() => (mobileMenuOpen = false)}
						class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium {active 
							? 'bg-muted text-foreground' 
							: 'text-muted-foreground'}"
					>
						<item.icon class="h-4 w-4" />
						{item.name}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</header>
