<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { 
		BookOpen, 
		Layers, 
		Terminal, 
		Sparkles, 
		ArrowRight, 
		CheckCircle2, 
		ExternalLink,
		Building2,
		BarChart3,
		Globe
	} from '@lucide/svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';

	$effect(() => {
		ui.currentContext = { type: 'home', title: 'Documentation' };
	});
</script>

<div class="relative overflow-hidden">
	<!-- Ambient Background Glow -->
	<div class="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/10 via-sky-500/10 to-emerald-500/10 blur-3xl dark:from-indigo-950/30 dark:via-sky-950/20 dark:to-emerald-950/20"></div>

	<!-- Hero Section -->
	<section class="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-24">
		<div class="text-center">
			<!-- Pill Badge -->
			<div class="inline-flex items-center gap-2">
				<Badge variant="outline" class="gap-2 px-3.5 py-1 text-xs">
					<span class="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
					<span class="font-medium">Enterprise Knowledge</span>
				</Badge>
			</div>

			<!-- Main Heading -->
			<h1 class="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
				Documentation
			</h1>

			<!-- Subtitle -->
			<p class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
				Pusat panduan teknis, referensi sistem, arsitektur integrasi, serta standar operasional aplikasi enterprise.
			</p>

			<!-- Action Buttons with Shadcn Button -->
			<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
				<a href="/docs/sap/overview">
					<Button size="lg" class="gap-2 shadow-sm">
						<BookOpen class="h-4 w-4" />
						<span>Buka Dokumentasi</span>
						<ArrowRight class="h-4 w-4 opacity-70" />
					</Button>
				</a>

				<a href="/apps">
					<Button variant="outline" size="lg" class="gap-2 shadow-xs">
						<Layers class="h-4 w-4 text-emerald-500" />
						<span>Program Navigator (7 Apps)</span>
					</Button>
				</a>

				<Button
					variant="secondary"
					size="lg"
					onclick={() => ui.openAi()}
					class="gap-2 border border-indigo-200 bg-indigo-50/60 text-indigo-950 hover:bg-indigo-100/80 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/70"
				>
					<Sparkles class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
					<span>Tanya AI Copilot</span>
				</Button>
			</div>

			<!-- Quick Stats Banner -->
			<div class="mt-14 grid grid-cols-2 gap-4 border-y border-zinc-200/80 py-6 sm:grid-cols-4 dark:border-zinc-800/80">
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">3 Kategori</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Topik Terstruktur</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">11 Panduan</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Arsitektur & Kode Lengkap</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">7 Aplikasi</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Ekosistem Enterprise Aktif</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">AI Copilot</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Zero-Hallucination RAG</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Bento Feature Grid: 3 Main Documentation Pillars -->
	<section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
		<div class="mb-10 text-center sm:text-left">
			<h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">3 Bagian Utama Dokumentasi</h2>
			<p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Pilih bagian untuk mempelajari arsitektur teknis, integrasi sistem, dan implementasi kode.</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- Pillar 1: SAP Enterprise -->
			<Card class="transition-all hover:shadow-md border-blue-200/70 dark:border-blue-900/40 hover:border-blue-400">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
							<Building2 class="h-5 w-5" />
						</div>
						<Badge class="bg-blue-600 text-white">SAP Enterprise</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">SAP ERP & S/4HANA</CardTitle>
					<CardDescription>
						Fondasi arsitektur database in-memory HANA, modul bisnis FI/CO, MM, SD, PM, integrasi ABAP via RFC & BAPI, serta implementasi SAP Gateway OData.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-1.5 mb-5">
						<Badge variant="outline" class="text-[10px]">S/4HANA</Badge>
						<Badge variant="outline" class="text-[10px]">ABAP RFC</Badge>
						<Badge variant="outline" class="text-[10px]">BAPI</Badge>
						<Badge variant="outline" class="text-[10px]">CDS Views</Badge>
					</div>
					<a href="/docs/sap/overview" class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
						Eksplorasi SAP <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>

			<!-- Pillar 2: SAC Analytics -->
			<Card class="transition-all hover:shadow-md border-purple-200/70 dark:border-purple-900/40 hover:border-purple-400">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
							<BarChart3 class="h-5 w-5" />
						</div>
						<Badge class="bg-purple-600 text-white">SAC Analytics</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">SAP Analytics Cloud (SAC)</CardTitle>
					<CardDescription>
						Platform BI modern, perancangan Stories interaktif & responsif, pemodelan data multi-dimensi, konektivitas Live Data On-Premise, dan Data Access Control (DAC).
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-1.5 mb-5">
						<Badge variant="outline" class="text-[10px]">Stories BI</Badge>
						<Badge variant="outline" class="text-[10px]">Live Data</Badge>
						<Badge variant="outline" class="text-[10px]">Cloud Connector</Badge>
						<Badge variant="outline" class="text-[10px]">DAC Security</Badge>
					</div>
					<a href="/docs/sac/overview" class="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400">
						Eksplorasi SAC <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>

			<!-- Pillar 3: WEB Stack -->
			<Card class="transition-all hover:shadow-md border-emerald-200/70 dark:border-emerald-900/40 hover:border-emerald-400">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
							<Globe class="h-5 w-5" />
						</div>
						<Badge class="bg-emerald-600 text-white">WEB Stack</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">Modern Web Applications</CardTitle>
					<CardDescription>
						Arsitektur portal terpadu berbasis SvelteKit 5 runes, Tailwind CSS v4, Express REST API, sistem RAG anti-halusinasi, dan standar keamanan enterprise.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-1.5 mb-5">
						<Badge variant="outline" class="text-[10px]">SvelteKit 5</Badge>
						<Badge variant="outline" class="text-[10px]">REST APIs</Badge>
						<Badge variant="outline" class="text-[10px]">Fuse.js RAG</Badge>
						<Badge variant="outline" class="text-[10px]">CSRF & XSS</Badge>
					</div>
					<a href="/docs/web/architecture" class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
						Eksplorasi WEB <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>
		</div>
	</section>

	<!-- Additional Section: Ecosystem & API Reference -->
	<section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
		<div class="mb-10 text-center sm:text-left">
			<h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Ekosistem & Integrasi</h2>
			<p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Akses langsung ke 7 aplikasi operasional enterprise dan spesifikasi API terpadu.</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- Card 3: Program Navigator -->
			<Card class="transition-all hover:shadow-md">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
							<Layers class="h-5 w-5" />
						</div>
						<Badge variant="secondary">7 Sistem</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">Program Navigator</CardTitle>
					<CardDescription>
						Akses langsung ke Fuel Management System (FMS), SAC Analytics Cloud Dev & Prod, Marketing System, KPI SHE, PPPN, dan File Manager.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<a href="/apps" class="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline dark:text-white">
						Lihat daftar program <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>

			<!-- Card 4: REST API & Architecture -->
			<Card class="transition-all hover:shadow-md md:col-span-2">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white">
							<Terminal class="h-5 w-5" />
						</div>
						<Badge variant="secondary">REST Endpoints</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">Spesifikasi API & Integrasi Arsitektur</CardTitle>
					<CardDescription>
						Dokumentasi lengkap REST API backend, model query AI Copilot, indexing docs, serta arsitektur reverse proxy Nginx dan koneksi ke CDS Views.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<a href="/api-reference" class="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline dark:text-white">
						Buka referensi API <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>
		</div>
	</section>
</div>
