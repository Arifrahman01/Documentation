<script lang="ts">
	import { getContext } from "svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";

	let {
		value,
		class: className = undefined,
		children,
		disabled = false,
		...restProps
	}: HTMLButtonAttributes & {
		value: string;
		children?: Snippet;
	} = $props();

	const tabs = getContext<{ getValue: () => string; setValue: (v: string) => void }>("tabs");
	const isSelected = $derived(tabs ? tabs.getValue() === value : false);
</script>

<button
	type="button"
	role="tab"
	aria-selected={isSelected}
	disabled={disabled}
	onclick={() => tabs?.setValue(value)}
	class={cn(
		"inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
		isSelected
			? "bg-background text-foreground shadow"
			: "hover:bg-background/50 hover:text-foreground",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</button>
