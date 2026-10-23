<script lang="ts">
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

	<div
		oncontextmenu={(e) => onContextMenu?.(e)}
		role="treeitem"
		aria-selected={isActive}
		tabindex="0"
	>
		<button
			type="button"
			onclick={() => onSelectHeading(node.id)}
			class="block w-full truncate py-1 text-left text-xs transition-colors {isActive
				? 'font-semibold text-foreground'
				: 'text-muted-foreground hover:text-foreground'}"
			style="padding-left: {depth * 12}px;"
			title={node.text}
		>
			{node.text}
		</button>

		{#if hasChildren}
			<div>
				{#each node.children as child}
					{@render renderNode(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#if outlineTree.length > 0}
	<div class="border-l border-border/60 pl-4 py-1">
		<div class="mb-2.5 text-[11px] font-semibold text-muted-foreground">
			Daftar Isi
		</div>

		<div class="space-y-0.5 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
			{#each outlineTree as node}
				{@render renderNode(node, 0)}
			{/each}
		</div>
	</div>
{/if}
