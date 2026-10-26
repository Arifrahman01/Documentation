<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { children?: Snippet } = $props();
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
	aria-hidden="true"
></div>

<!-- Dialog Box -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<div
		bind:this={ref}
		role="dialog"
		aria-modal="true"
		class={cn(
			"bg-background text-foreground z-50 grid w-full max-w-lg gap-4 rounded-xl border border-border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 sm:max-w-[425px]",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</div>
</div>
