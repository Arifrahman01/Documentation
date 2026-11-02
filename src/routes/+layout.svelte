<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { navigating } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import SearchModal from '$lib/components/SearchModal.svelte';
	import AiCopilot from '$lib/components/AiCopilot.svelte';
	import SyncDocsModal from '$lib/components/SyncDocsModal.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	$effect.pre(() => {
		if (data?.userName) {
			auth.init(data.userName);
		}
	});

	$effect(() => {
		ui.applyTheme();

		// Register PWA Service Worker for offline support & installability
		if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch((err) => {
				console.warn('PWA Service Worker registration:', err);
			});
		}
	});

	onMount(() => {
		// Dismiss initial loading screen smoothly once Svelte is fully hydrated and interactive
		const dismissLoader = () => {
			const loader = document.getElementById('app-loading-screen');
			if (loader) {
				loader.classList.add('is-loaded');
				setTimeout(() => {
					if (loader.parentNode) loader.parentNode.removeChild(loader);
				}, 450);
			}
		};

		// 220ms grace period so all child components runes & listeners are completely ready
		const timer = setTimeout(dismissLoader, 220);

		// Handle any queued action triggered right before hydration completed
		if ((window as any).__pendingAiOpen) {
			(window as any).__pendingAiOpen = false;
			ui.openAi();
		}
		if ((window as any).__pendingSearchOpen) {
			(window as any).__pendingSearchOpen = false;
			ui.openSearch();
		}

		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Portal Dokumentasi & Navigator Sistem</title>
	<meta name="description" content="Portal dokumentasi teknis SAP, SAC, arsitektur web, dan direktori aplikasi enterprise." />
</svelte:head>

<!-- Route Navigation Top Progress Bar -->
{#if navigating.to}
	<div class="fixed top-0 left-0 right-0 z-[99999] h-1 bg-muted/40 overflow-hidden pointer-events-none" aria-hidden="true">
		<div class="h-full bg-primary animate-nav-bar w-full"></div>
	</div>
{/if}

<div class="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
	<Header />

	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-border bg-muted/30 py-8">
		<div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
			<div class="flex items-center gap-3 text-xs text-muted-foreground">
				<span>Portal Dokumentasi Enterprise</span>
				<span>•</span>
				<span>SAP ERP, SAC & Web Stack</span>
				<span>•</span>
				<span>AI Copilot Terintegrasi</span>
			</div>
			<div class="flex items-center gap-4 text-xs text-muted-foreground">
				<a href="/" class="hover:underline">Beranda</a>
				<a href="/docs/sap/overview" class="hover:underline">Dokumentasi</a>
				<a href="/apps" class="hover:underline">Apps</a>
				<a href="/my-docs" class="hover:underline">My Docs</a>
			</div>
		</div>
	</footer>

	<!-- Global Dialogs & Drawers -->
	<SearchModal />
	<AiCopilot />
	<SyncDocsModal />
</div>
