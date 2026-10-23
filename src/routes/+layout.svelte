<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import SearchModal from '$lib/components/SearchModal.svelte';
	import AiCopilot from '$lib/components/AiCopilot.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		ui.applyTheme();
	});

	onMount(() => {
		const onGlobalKey = (e: KeyboardEvent) => {
			if (page.url.pathname.startsWith('/docs')) return;
			const target = e.target as HTMLElement | null;
			const isInput =
				target &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.tagName === 'SELECT' ||
					target.isContentEditable);
			if (isInput) return;

			const key = e.key.toLowerCase();
			const code = e.code;
			const hasCmdOrCtrl = e.ctrlKey || e.metaKey;
			const hasAlt = e.altKey;

			if ((hasCmdOrCtrl || hasAlt) && (key === 'e' || code === 'KeyE')) {
				e.preventDefault();
				e.stopPropagation();
				goto('/docs/sap/overview?shortcut=edit');
			} else if ((hasCmdOrCtrl || hasAlt) && (key === 'i' || code === 'KeyI')) {
				e.preventDefault();
				e.stopPropagation();
				goto('/docs/sap/overview?shortcut=ai');
			} else if (
				(hasAlt && (key === 'n' || code === 'KeyN')) ||
				(hasCmdOrCtrl && (key === 'm' || code === 'KeyM'))
			) {
				e.preventDefault();
				e.stopPropagation();
				goto('/docs/sap/overview?shortcut=new');
			} else if (hasAlt && (key === 'f' || code === 'KeyF')) {
				e.preventDefault();
				e.stopPropagation();
				goto('/docs/sap/overview?shortcut=folder');
			}
		};

		window.addEventListener('keydown', onGlobalKey, { capture: true });
		return () => window.removeEventListener('keydown', onGlobalKey, { capture: true });
	});
</script>

<svelte:head>
	<title>Documentation</title>
	<meta name="description" content="Technical documentation, API reference, and enterprise systems." />
</svelte:head>

<div class="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
	<Header />

	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-border bg-muted/30 py-8">
		<div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
			<div class="flex items-center gap-3 text-xs text-muted-foreground">
				<span>Documentation</span>
				<span>•</span>
				<span>Powered by SvelteKit & Shadcn UI</span>
				<span>•</span>
				<span>AI Copilot Enterprise</span>
			</div>
			<div class="flex items-center gap-4 text-xs text-muted-foreground">
				<a href="/" class="hover:underline">Overview</a>
				<a href="/docs/sap/overview" class="hover:underline">Documentation</a>
				<a href="/apps" class="hover:underline">Program Navigator</a>
			</div>
		</div>
	</footer>

	<!-- Global Dialogs & Drawers -->
	<SearchModal />
	<AiCopilot />
</div>
