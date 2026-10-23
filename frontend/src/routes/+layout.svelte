<script lang="ts">
	import './layout.css';
	import Header from '$lib/components/Header.svelte';
	import SearchModal from '$lib/components/SearchModal.svelte';
	import AiCopilot from '$lib/components/AiCopilot.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		ui.applyTheme();
	});
</script>

<svelte:head>
	<title>Documentation & System Navigator</title>
	<meta name="description" content="Enterprise technical documentation, API reference, and system navigator." />
</svelte:head>

<div class="min-h-screen flex flex-col bg-white text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white dark:bg-zinc-950 dark:text-zinc-50 dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
	<Header />

	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-zinc-200 bg-zinc-50/50 py-8 dark:border-zinc-800 dark:bg-zinc-950/60">
		<div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
			<div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
				<span>Documentation Portal</span>
				<span>•</span>
				<span>Powered by SvelteKit & Shadcn UI</span>
				<span>•</span>
				<span>AI Copilot (Gemini 3.8 Flash Medium)</span>
			</div>
			<div class="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
				<a href="/docs/get-started/quick-start" class="hover:underline">Documentation</a>
				<a href="/api-reference" class="hover:underline">API Reference</a>
				<a href="/apps" class="hover:underline">Apps Navigator</a>
			</div>
		</div>
	</footer>

	<!-- Global Dialogs & Drawers -->
	<SearchModal />
	<AiCopilot />
</div>
