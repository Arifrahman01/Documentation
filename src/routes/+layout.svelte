<script lang="ts">
	import './layout.css';
	import Header from '$lib/components/Header.svelte';
	import SearchModal from '$lib/components/SearchModal.svelte';
	import AiCopilot from '$lib/components/AiCopilot.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	$effect(() => {
		auth.init(data.userName);
		ui.applyTheme();
	});
</script>

<svelte:head>
	<title>Portal Dokumentasi & Navigator Sistem</title>
	<meta name="description" content="Portal dokumentasi teknis SAP, SAC, arsitektur web, dan direktori aplikasi enterprise." />
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
</div>
