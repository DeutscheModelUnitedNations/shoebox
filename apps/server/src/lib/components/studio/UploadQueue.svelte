<script lang="ts">
	import { formatBytes } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import {
		uploads,
		uploadStats,
		type QueueItem,
		type QueueStatus
	} from '$lib/studio/uploads.svelte';

	const stats = $derived(uploadStats());
	const visibleItems = $derived(uploads.items.slice(-12).reverse());

	const labels: Record<QueueStatus, (item: QueueItem) => string> = {
		done: () => m.uploadOnline(),
		uploading: (item) => `${Math.round(item.progress * 100)} %`,
		hashing: () => m.uploadChecking(),
		waiting: () => m.uploadWaiting(),
		held: () => '',
		error: (item) => item.error ?? m.uploadFailed()
	};

	const isHeld = (item: QueueItem) =>
		item.status === 'held' || (!!item.duplicateOfName && item.status !== 'error');
</script>

{#snippet progress(item: QueueItem)}
	{#if item.duplicateOfName}
		<span class="text-sm leading-tight">{m.uploadMatches({ name: item.duplicateOfName })}</span>
	{:else if item.status !== 'error'}
		<progress
			class="progress progress-primary w-full"
			value={item.status === 'done' ? 1 : item.progress}
			max="1"
		></progress>
	{/if}
{/snippet}

<div class="flex flex-col">
	<div class="border-base-content flex items-baseline justify-between border-b pb-3">
		<h2 class="font-bold">{m.uploadQueue()}</h2>
		<span class="text-base-content/70 text-sm">
			{m.uploadProgress({ done: stats.done, total: stats.total })}
			{#if stats.held > 0}· {m.uploadPossibleDuplicates({ count: stats.held })}{/if}
		</span>
	</div>
	{#each visibleItems as item (item.key)}
		<div
			class="border-base-300 grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 border-b py-3 sm:grid-cols-[4.5rem_1fr_12rem_8rem]"
		>
			<img src={item.previewUrl} alt="" class="h-12 w-18 object-cover" />
			<span class="truncate text-sm">
				{item.file.name}
				<span class="text-base-content/60">· {formatBytes(item.file.size)}</span>
			</span>
			<div class="hidden sm:block">{@render progress(item)}</div>
			<span class="justify-self-end text-right text-sm">
				{#if isHeld(item)}
					<span class="badge badge-neutral uppercase">{m.uploadHeld()}</span>
				{:else}
					<span class={item.status === 'error' ? 'text-error' : ''}
						>{labels[item.status](item)}</span
					>
				{/if}
			</span>
		</div>
	{/each}
	<p class="text-base-content/60 pt-3 text-sm">
		{#if uploads.items.length > visibleItems.length}
			{m.uploadMoreFiles({ count: uploads.items.length - visibleItems.length })} ·
		{/if}
		{m.uploadHeldNote()}
	</p>
</div>
