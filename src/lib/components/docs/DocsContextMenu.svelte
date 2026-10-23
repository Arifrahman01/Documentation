<script lang="ts">
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
		Trash2
	} from '@lucide/svelte';

	interface Props {
		open: boolean;
		x: number;
		y: number;
		targetDoc: any;
		onEdit: (doc: any) => void;
		onCreate: (doc: any) => void;
		onCreateFolder?: (doc: any) => void;
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
		class="fixed z-50 min-w-[245px] max-w-[285px] overflow-hidden rounded-xl border border-border bg-popover/95 p-1.5 text-xs text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none ring-1 ring-black/5 dark:ring-white/10"
		style="left: {x}px; top: {y}px;"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="menu"
		tabindex="-1"
	>
		{#if targetDoc?.title}
			<div class="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border truncate max-w-[265px] flex items-center gap-1.5">
				{#if isFolderTarget}
					<Folder class="h-3 w-3 shrink-0 text-amber-500" />
				{:else}
					<FileText class="h-3 w-3 shrink-0 text-indigo-500" />
				{/if}
				<span class="truncate">{targetDoc.title}</span>
			</div>
		{/if}

		<div class="space-y-0.5 pt-1">
			<!-- File Explorer Actions: Create File & Create Folder -->
			<button
				type="button"
				onclick={() => onCreate(targetDoc)}
				class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-muted transition-colors"
			>
				<div class="flex items-center gap-2">
					<FilePlus class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
					<span>{isFolderTarget ? 'Buat File Baru di Folder Ini' : 'Buat File Catatan Baru'}</span>
				</div>
				<kbd class="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">Ctrl+N</kbd>
			</button>

			{#if onCreateFolder}
				<button
					type="button"
					onclick={() => onCreateFolder(targetDoc)}
					class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-muted transition-colors"
				>
					<div class="flex items-center gap-2">
						<FolderPlus class="h-3.5 w-3.5 text-amber-500" />
						<span>
							{isFolderTarget && !targetDoc?.subcategory
								? 'Buat Sub-Folder di Sini'
								: 'Buat Folder Baru'}
						</span>
					</div>
				</button>
			{/if}

			{#if !isFolderTarget}
				<div class="my-1 border-t border-border"></div>

				<button
					type="button"
					onclick={() => onEdit(targetDoc)}
					class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-muted transition-colors"
				>
					<div class="flex items-center gap-2">
						<Edit3 class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
						<span>Tulis / Edit Isi Catatan</span>
					</div>
					<kbd class="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">Ctrl+E</kbd>
				</button>

				{#if onDuplicate && targetDoc}
					<button
						type="button"
						onclick={() => onDuplicate(targetDoc)}
						class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-muted transition-colors"
					>
						<div class="flex items-center gap-2">
							<CopyPlus class="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
							<span>Duplikat File Catatan</span>
						</div>
					</button>
				{/if}

				<button
					type="button"
					onclick={() => onAskAi(targetDoc)}
					class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-medium hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200 transition-colors"
				>
					<div class="flex items-center gap-2">
						<Sparkles class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
						<span>AI Assistant (Catatan Ini)</span>
					</div>
					<kbd class="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">Ctrl+I</kbd>
				</button>

				<div class="my-1 border-t border-border"></div>

				<button
					type="button"
					onclick={() => onCopyLink(targetDoc)}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted transition-colors"
				>
					<Copy class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Salin Tautan</span>
				</button>

				<button
					type="button"
					onclick={() => onCopyMarkdown(targetDoc)}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted transition-colors"
				>
					<FileText class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Salin Raw Markdown</span>
				</button>

				<button
					type="button"
					onclick={() => onDownload(targetDoc)}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted transition-colors"
				>
					<Download class="h-3.5 w-3.5 text-muted-foreground" />
					<span>Unduh File (.md)</span>
				</button>
			{/if}

			{#if targetDoc}
				<div class="my-1 border-t border-border"></div>

				<button
					type="button"
					onclick={() => onDelete(targetDoc)}
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
				>
					<Trash2 class="h-3.5 w-3.5" />
					<span>{isFolderTarget ? 'Hapus Folder' : 'Hapus File Catatan'}</span>
				</button>
			{/if}
		</div>
	</div>
{/if}
