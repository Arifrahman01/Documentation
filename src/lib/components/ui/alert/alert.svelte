<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: "default" | "destructive";
		children?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	role="alert"
	class={cn(
		"relative w-full rounded-lg border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
		variant === "default" && "bg-background text-foreground border-border",
		variant === "destructive" && "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/5",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
