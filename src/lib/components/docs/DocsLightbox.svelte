<script lang="ts">
	import { X, ZoomIn, ExternalLink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		src: string | null;
		alt?: string;
		onClose: () => void;
	}

	let { src, alt = 'Pratinjau Gambar', onClose }: Props = $props();
</script>

{#if src}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-150"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- Top Controls -->
		<div class="mb-3 flex w-full max-w-6xl items-center justify-between px-2 text-white">
			<div class="flex items-center gap-2 text-xs font-medium text-zinc-300 truncate">
				<ZoomIn class="h-4 w-4 text-indigo-400 shrink-0" />
				<span class="truncate">{alt || 'Detail Gambar Dokumentasi'}</span>
			</div>

			<div class="flex items-center gap-2">
				<a
					href={src}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/90 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
				>
					<ExternalLink class="h-3.5 w-3.5" />
					<span>Buka Ukuran Asli</span>
				</a>
				<Button
					variant="ghost"
					size="icon"
					onclick={onClose}
					class="h-8 w-8 rounded-lg bg-zinc-800/90 text-white hover:bg-zinc-700"
				>
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Image Container -->
		<div class="relative flex max-h-[82vh] max-w-6xl items-center justify-center overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 shadow-2xl">
			<img
				{src}
				{alt}
				class="max-h-[78vh] w-auto max-w-full rounded-lg object-contain"
			/>
		</div>
	</div>
{/if}
