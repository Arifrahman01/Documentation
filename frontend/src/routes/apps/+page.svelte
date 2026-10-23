<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import appsData from '$lib/data/apps.json';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		Search, 
		ExternalLink, 
		Sparkles, 
		Copy, 
		Check, 
		Layers,
		CheckCircle2,
		AlertCircle,
		Clock
	} from '@lucide/svelte';

	let searchQuery = $state('');
	let selectedCategory = $state('all');
	let copiedAppId = $state<string | null>(null);

	$effect(() => {
		ui.currentContext = { type: 'apps', title: 'Program Navigator (7 Apps Enterprise)' };
	});

	const categories = [
		{ id: 'all', label: 'Semua Aplikasi (7)' },
		{ id: 'operations', label: 'Operations & Logistics' },
		{ id: 'analytics', label: 'Analytics & BI' },
		{ id: 'commercial', label: 'Marketing & CRM' },
		{ id: 'safety', label: 'Safety & SHE' },
		{ id: 'finance', label: 'Finance & Plant' },
		{ id: 'storage', label: 'Storage & Infra' }
	];

	const filteredApps = $derived.by(() => {
		let list = appsData.programs;
		if (selectedCategory !== 'all') {
			list = list.filter((p) => p.category === selectedCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.subtitle.toLowerCase().includes(q) ||
					p.description.toLowerCase().includes(q) ||
					p.tags.some((t) => t.toLowerCase().includes(q))
			);
		}
		return list;
	});

	function copyUrl(app: typeof appsData.programs[0]) {
		navigator.clipboard.writeText(app.url);
		copiedAppId = app.id;
		setTimeout(() => (copiedAppId = null), 2000);
	}

	function askAiAboutApp(app: typeof appsData.programs[0]) {
		ui.openAi(`Jelaskan fitur utama, manfaat, dan alur integrasi dari ${app.title} (${app.subtitle}).`, {
			type: 'apps',
			title: app.title
		});
	}
</script>

<svelte:head>
	<title>Program Navigator - Ekosistem Aplikasi Enterprise</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
	<!-- Hero Section -->
	<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
		<div>
			<div class="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
				<span class="flex h-2 w-2 rounded-full bg-emerald-500"></span>
				<span>Enterprise Application Suite</span>
			</div>
			<h1 class="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
				Program Navigator
			</h1>
			<p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
				Katalog dan portal peluncuran 7 sistem enterprise terintegrasi. Akses lingkungan operasional, analytics BI, CRM, K3 keselamatan kerja, dan manajemen berkas.
			</p>
		</div>

		<!-- Status Pills -->
		<div class="flex items-center gap-2">
			<Badge variant="outline" class="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
				<span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
				6 Operational
			</Badge>
			<Badge variant="outline" class="border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
				<span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"></span>
				1 Development
			</Badge>
		</div>
	</div>

	<Separator class="my-8" />

	<!-- Filter Controls -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<!-- Category Tabs -->
		<div class="flex flex-wrap gap-1.5">
			{#each categories as cat}
				<button
					type="button"
					onclick={() => (selectedCategory = cat.id)}
					class="rounded-lg px-3 py-1.5 text-xs font-medium transition-all {selectedCategory === cat.id
						? 'bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-950'
						: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}"
				>
					{cat.label}
				</button>
			{/each}
		</div>

		<!-- Search Input -->
		<div class="relative w-full sm:w-72">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
			<Input
				type="text"
				bind:value={searchQuery}
				placeholder="Filter aplikasi atau tag..."
				class="pl-9 h-9 text-xs"
			/>
		</div>
	</div>

	<!-- App Cards Grid -->
	<div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each filteredApps as app}
			<Card class="flex flex-col justify-between transition-all hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700">
				<CardHeader class="pb-3">
					<div class="flex items-start justify-between gap-3">
						<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 shadow-xs ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700">
							<Layers class="h-5 w-5" />
						</div>

						<Badge variant={app.status === 'Production' || app.status === 'Active' ? 'default' : 'secondary'} class="text-[10px]">
							<span class="mr-1.5 h-1.5 w-1.5 rounded-full {app.status === 'Production' || app.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
							{app.status}
						</Badge>
					</div>

					<CardTitle class="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-50">
						{app.title}
					</CardTitle>
					<CardDescription class="text-xs font-medium text-zinc-500 dark:text-zinc-400">
						{app.subtitle}
					</CardDescription>
				</CardHeader>

				<CardContent class="pb-4">
					<p class="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
						{app.description}
					</p>

					<!-- Tags -->
					<div class="mt-4 flex flex-wrap gap-1.5">
						{#each app.tags as tag}
							<Badge variant="outline" class="text-[10px] text-zinc-500 dark:text-zinc-400">
								#{tag}
							</Badge>
						{/each}
					</div>
				</CardContent>

				<CardFooter class="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
					<div class="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onclick={() => copyUrl(app)}
							class="h-8 px-2 text-xs text-zinc-500"
							title="Salin tautan"
						>
							{#if copiedAppId === app.id}
								<Check class="h-3.5 w-3.5 text-emerald-500" />
							{:else}
								<Copy class="h-3.5 w-3.5" />
							{/if}
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onclick={() => askAiAboutApp(app)}
							class="h-8 gap-1 px-2 text-xs text-indigo-600 dark:text-indigo-400"
							title="Tanyakan AI Copilot"
						>
							<Sparkles class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">Tanya AI</span>
						</Button>
					</div>

					<a href={app.url} target="_blank" rel="noopener noreferrer">
						<Button size="sm" class="h-8 gap-1 text-xs">
							<span>Buka Aplikasi</span>
							<ExternalLink class="h-3 w-3 opacity-70" />
						</Button>
					</a>
				</CardFooter>
			</Card>
		{/each}
	</div>

	{#if filteredApps.length === 0}
		<div class="py-16 text-center">
			<Layers class="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700" />
			<h3 class="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tidak ada aplikasi yang cocok</h3>
			<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Coba kata kunci lain atau pilih tab kategori 'Semua Aplikasi'.</p>
			<Button variant="outline" size="sm" class="mt-4" onclick={() => { searchQuery = ''; selectedCategory = 'all'; }}>
				Reset Filter
			</Button>
		</div>
	{/if}
</div>
