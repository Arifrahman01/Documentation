<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';
	import { 
		BookOpen, 
		Layers, 
		Terminal, 
		Sparkles, 
		ArrowRight, 
		CheckCircle2, 
		ExternalLink
	} from '@lucide/svelte';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';

	$effect(() => {
		ui.currentContext = { type: 'home', title: 'Overview & Portal Documentation' };
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
					<span class="font-medium">Dokumentasi & Sistem Terpadu</span>
					<Separator orientation="vertical" class="h-3" />
					<span class="text-zinc-500 dark:text-zinc-400">Arsitektur Enterprise & AI Copilot</span>
				</Badge>
			</div>

			<!-- Main Heading -->
			<h1 class="mt-6 text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
				Portal Dokumentasi Teknis & <br />
				<span class="bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 bg-clip-text text-transparent dark:from-white dark:via-zinc-200 dark:to-zinc-500">
					Program Navigator
				</span>
			</h1>

			<!-- Subtitle -->
			<p class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
				Pusat panduan arsitektur sistem enterprise, spesifikasi API & CDS Views, dokumentasi teknis mendalam, serta peluncuran 7 sistem aplikasi operasional.
			</p>

			<!-- Action Buttons with Shadcn Button -->
			<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
				<a href="/docs/get-started/quick-start">
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
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">7 Aplikasi</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Ekosistem Enterprise Aktif</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">9 Panduan</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Arsitektur & Kode Lengkap</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">AI Copilot</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Asisten Cerdas & Cepat</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-zinc-900 dark:text-white">&lt; 10 ms</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">Pencarian Semantik Instan</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Bento Feature Grid with Shadcn Card -->
	<section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
		<div class="mb-10 text-center sm:text-left">
			<h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Fitur & Arsitektur Portal</h2>
			<p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Kombinasi dokumentasi modern, navigator sistem operasional, dan asisten AI lokal.</p>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- Card 1: Core Docs -->
			<Card class="transition-all hover:shadow-md md:col-span-2">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white">
							<BookOpen class="h-5 w-5" />
						</div>
						<Badge variant="secondary">5 Topik Utama</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">Panduan Teknis Mendalam</CardTitle>
					<CardDescription>
						Mulai dari Quick Start, MVC architecture, XML component configuration, two-way data binding, security & CSRF protection, hingga automated testing dengan QUnit.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-wrap gap-2">
						<Badge variant="outline">manifest.json</Badge>
						<Badge variant="outline">Routing & Targets</Badge>
						<Badge variant="outline">XSS & CSRF</Badge>
						<Badge variant="outline">QUnit Test Runner</Badge>
					</div>
					<a href="/docs/get-started/quick-start" class="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline dark:text-white">
						Baca panduan awal <ArrowRight class="h-3 w-3" />
					</a>
				</CardContent>
			</Card>

			<!-- Card 2: AI Copilot -->
			<Card class="border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white dark:border-indigo-900/60 dark:from-indigo-950/20 dark:to-zinc-900/60">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
							<Sparkles class="h-5 w-5" />
						</div>
						<Badge class="bg-indigo-600 text-white">Enterprise</Badge>
					</div>
					<CardTitle class="mt-4 text-lg">AI Copilot Pintar</CardTitle>
					<CardDescription>
						Tanya jawab teknis, rangkuman dokumen otomatis, dan bantuan kode secara langsung dengan response cache cepat.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						variant="link"
						onclick={() => ui.openAi()}
						class="px-0 gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
					>
						Buka AI Copilot (Ctrl+J) <ArrowRight class="h-3 w-3" />
					</Button>
				</CardContent>
			</Card>

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
