<script lang="ts">
	import { getContext } from "svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		value,
		class: className = undefined,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		value: string;
		children?: Snippet;
	} = $props();

	const tabs = getContext<{ getValue: () => string; setValue: (v: string) => void }>("tabs");
	const isSelected = $derived(tabs ? tabs.getValue() === value : false);
</script>

{#if isSelected}
	<div
		role="tabpanel"
		class={cn(
			"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</div>
{/if}
