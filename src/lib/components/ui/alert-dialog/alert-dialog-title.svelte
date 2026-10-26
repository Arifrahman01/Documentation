<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLHeadingElement>> & { children?: Snippet } = $props();
</script>

<h2
	bind:this={ref}
	class={cn("text-lg font-semibold tracking-tight text-foreground flex items-center gap-2", className)}
	{...restProps}
>
	{@render children?.()}
</h2>
