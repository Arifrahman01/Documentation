<script lang="ts">
	import { setContext } from "svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		value = $bindable(""),
		class: className = undefined,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		value?: string;
		children?: Snippet;
	} = $props();

	setContext("tabs", {
		getValue: () => value,
		setValue: (v: string) => { value = v; }
	});
</script>

<div class={cn("w-full", className)} {...restProps}>
	{@render children?.()}
</div>
