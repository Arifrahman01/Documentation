<script lang="ts">
	import type { HTMLLabelAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		"data-slot": dataSlot = "label",
		...restProps
	}: WithElementRef<HTMLLabelAttributes> = $props();
</script>

<label
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		"flex items-center gap-2 text-xs leading-none font-semibold select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-foreground",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</label>
