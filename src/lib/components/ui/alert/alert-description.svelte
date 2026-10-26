<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLParagraphElement>> & { children?: Snippet } = $props();
</script>

<div
	bind:this={ref}
	class={cn("text-xs [&_p]:leading-relaxed", className)}
	{...restProps}
>
	{@render children?.()}
</div>
