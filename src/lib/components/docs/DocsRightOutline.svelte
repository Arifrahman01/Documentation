<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { OutlineNode } from '$lib/utils/markdown';

	interface Props {
		outlineTree: OutlineNode[];
		activeHeadingId: string;
		onSelectHeading: (id: string) => void;
		onContextMenu?: (e: MouseEvent) => void;
	}

	let {
		outlineTree,
		activeHeadingId,
		onSelectHeading,
		onContextMenu
	}: Props = $props();
</script>

{#snippet renderNode(node: OutlineNode, depth: number)}
	{@const hasChildren = node.children && node.children.length > 0}
	{@const isActive = activeHeadingId === node.id}

	<div>
		<Button
			variant="ghost"
			size="sm"
			aria-current={isActive ? 'location' : undefined}
			onclick={() => onSelectHeading(node.id)}
			oncontextmenu={(e: MouseEvent) => onContextMenu?.(e)}
			class="h-7 w-full justify-start truncate px-2 text-left text-xs {isActive
				? 'bg-secondary font-semibold text-foreground'
				: 'font-normal text-muted-foreground hover:text-foreground'}"
			style="padding-left: {8 + depth * 12}px;"
			title={node.text}
		>
			<span class="truncate">{node.text}</span>
		</Button>

		{#if hasChildren}
			<div class="space-y-0.5">
				{#each node.children as child}
					{@render renderNode(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#if outlineTree.length > 0}
	<nav aria-label="Daftar isi halaman" class="border-l border-border/60 pl-3 py-1">
		<div class="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
			Daftar Isi
		</div>

		<div class="space-y-0.5 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
			{#each outlineTree as node}
				{@render renderNode(node, 0)}
			{/each}
		</div>
	</nav>
{/if}
