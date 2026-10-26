<script lang="ts">
	import { Button, type ButtonProps } from "$lib/components/ui/button/index.js";
	import type { Snippet } from "svelte";

	let {
		variant = "destructive",
		size = "sm",
		onclick,
		class: className,
		children,
		...restProps
	}: ButtonProps & { onclick?: (e: MouseEvent) => void; children?: Snippet } = $props();
</script>

<Button
	{variant}
	{size}
	{onclick}
	class={className}
	{...restProps}
>
	{@render children?.()}
</Button>
