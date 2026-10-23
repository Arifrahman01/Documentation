<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className = undefined,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
	} = $props();
</script>

<div
	role="tablist"
	class={cn(
		"inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
