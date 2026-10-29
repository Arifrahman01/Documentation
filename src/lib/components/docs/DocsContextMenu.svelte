<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import {
		Edit3,
		FilePlus,
		FolderPlus,
		Sparkles,
		Copy,
		CopyPlus,
		FileText,
		Folder,
		Download,
		Trash2,
		PenLine,
		ArrowUp,
		ArrowDown
	} from '@lucide/svelte';

	interface Props {
		open: boolean;
		x: number;
		y: number;
		targetDoc: any;
		onEdit: (doc: any) => void;
		onCreate: (doc: any) => void;
		onCreateFolder?: (doc: any) => void;
		onRename?: (doc: any) => void;
		onMoveUp?: (doc: any) => void;
		onMoveDown?: (doc: any) => void;
		onDuplicate?: (doc: any) => void;
		onAskAi: (doc: any) => void;
		onCopyLink: (doc: any) => void;
		onCopyMarkdown: (doc: any) => void;
		onDownload: (doc: any) => void;
		onDelete: (doc: any) => void;
		onClose: () => void;
	}

	let {
		open,
		x,
		y,
		targetDoc,
		onEdit,
		onCreate,
		onCreateFolder,
		onRename,
		onMoveUp,
		onMoveDown,
		onDuplicate,
		onAskAi,
		onCopyLink,
		onCopyMarkdown,
		onDownload,
		onDelete,
		onClose
	}: Props = $props();

	const isFolderTarget = $derived(Boolean(targetDoc?.isFolder));
</script>

{#if open}
	<div
		class="fixed z-50 min-w-[245px] max-w-[285px] overflow-hidden rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg animate-in fade-in zoom-in-95 duration-100 select-none"
		style="left: {x}px; top: {y}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="menu"
		tabindex="-1"
	>
		{#if targetDoc?.title}
			<div class="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate max-w-[265px] flex items-center gap-1.5">
				{#if isFolderTarget}
					<Folder class="h-3 w-3 shrink-0 text-muted-foreground" />
				{:else}
					<FileText class="h-3 w-3 shrink-0 text-muted-foreground" />
				{/if}
				<span class="truncate">{targetDoc.title}</span>
			</div>
			<Separator class="my-1" />
		{/if}

		<div class="space-y-0.5">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onCreate(targetDoc)}
				class="h-8 w-full justify-between px-2.5 text-xs font-normal"
			>
				<div class="flex items-center gap-2">
					<FilePlus class="h-3.5 w-3.5 text-muted-foreground" />
					<span>{isFolderTarget ? 'Buat File Baru di Folder Ini' : 'Buat File Catatan Baru'}</span>
				</div>
				<Badge variant="secondary" class="px-1.5 py-0 text-[9px] font-mono">Alt+N</Badge>
			</Button>

			{#if onCreateFolder}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => onCreateFolder(targetDoc)}
					class="h-8 w-full justify-between px-2.5 text-xs font-normal"
				>
					<div class="flex items-center gap-2">
						<FolderPlus class="h-3.5 w-3.5 text-muted-foreground" />
						<span>
							{isFolderTarget && !targetDoc?.subcategory
								? 'Buat Sub-Folder di Sini'
								: 'Buat Folder Baru'}
						</span>
					</div>
					<Badge variant="secondary" class="px-1.5 py-0 text-[9px] font-mono">Alt+F</Badge>
				</Button>
			{/if}

			{#if isFolderTarget}
				{#if onRename}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => onRename(targetDoc)}
						class="h-8 w-full justify-between px-2.5 text-xs font-normal"
					>
						<div class="flex items-center gap-2">
							<PenLine class="h-3.5 w-3.5 text-muted-foreground" />
							<span>Ubah Nama Folder (Rename)</span>
						</div>
						<Badge variant="secondary" class="px-1.5 py-0 text-[9px] font-mono">F2</Badge>
					</Button>
				{/if}

				{#if onMoveUp || onMoveDown}
					<Separator class="my-1" />
					{#if onMoveUp}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => onMoveUp(targetDoc)}
							class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
						>
							<ArrowUp class="h-3.5 w-3.5 text-muted-foreground" />
							<span>Pindahkan Urutan ke Atas</span>
						</Button>
					{/if}
					{#if onMoveDown}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => onMoveDown(targetDoc)}
							class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
						>
							<ArrowDown class="h-3.5 w-3.5 text-muted-foreground" />
							<span>Pindahkan Urutan ke Bawah</span>
						</Button>
					{/if}
				{/if}
			{/if}

			{#if !isFolderTarget}
				<Separator class="my-1" />

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onEdit(targetDoc)}
					class="h-8 w-full justify-between px-2.5 text-xs font-normal"
				>
					<div class="flex items-center gap-2">
						<Edit3 class="h-3.5 w-3.5 text-muted-foreground" />
						<span>Tulis / Edit Isi Catatan</span>
					</div>
					<Badge variant="secondary" class="px-1.5 py-0 text-[9px] font-mono">Ctrl+E</Badge>
				</Button>

				{#if onRename}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => onRename(targetDoc)}
						class="h-8 w-full justify-between px-2.5 text-xs font-normal"
					>
						<div class="flex items-center gap-2">
							<PenLine class="h-3.5 w-3.5 text-muted-foreground" />
							<span>Ubah Nama File (Rename)</span>
						</div>
						<Badge variant="secondary" class="px-1.5 py-0 text-[9px] font-mono">F2</Badge>
					</Button>
				{/if}

				{#if onDuplicate && targetDoc}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => onDuplicate(targetDoc)}
						class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
					>
						<CopyPlus class="h-3.5 w-3.5 text-muted-foreground" />
						<span>Duplikat File Catatan</span>
					</Button>
				{/if}

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onAskAi(targetDoc)}
					class="h-8 w-full justify-between px-2.5 text-xs font-normal"
				>
					<div class="flex items-center gap-2">
						<Sparkles class="h-3.5 w-3.5 text-muted-foreground" />
						<span>AI Assistant (Catatan Ini)</span>
					</div>
					<Badge variant="secondary" class="px-1.5 py-0 text-[9px] font-mono">Ctrl+I</Badge>
				</Button>

				<Separator class="my-1" />

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onCopyLink(targetDoc)}
					class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
				>
					<Copy class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Salin Tautan</span>
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onCopyMarkdown(targetDoc)}
					class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
				>
					<FileText class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Salin Raw Markdown</span>
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onDownload(targetDoc)}
					class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal"
				>
					<Download class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Unduh File (.md)</span>
				</Button>
			{/if}

			{#if targetDoc}
				<Separator class="my-1" />

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onDelete(targetDoc)}
					class="h-8 w-full justify-start gap-2 px-2.5 text-xs font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 class="h-3.5 w-3.5" />
					<span>{isFolderTarget ? 'Hapus Folder' : 'Hapus File Catatan'}</span>
				</Button>
			{/if}
		</div>
	</div>
{/if}
