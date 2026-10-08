<script lang="ts">
	import { formatBytes, formatDate, formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import type { StudioMedia } from '$lib/studio/types';
	import MediaBadges from './MediaBadges.svelte';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	interface Props {
		media: StudioMedia;
		/** 1-based place in the current view */
		index: number;
		total: number;
		category: string;
		onClose: () => void;
		/** Undefined at the start or end of the view */
		onPrevious?: () => void;
		onNext?: () => void;
		onSetCover: () => void;
		onHighlight: (highlight: boolean) => void;
	}

	let {
		media,
		index,
		total,
		category,
		onClose,
		onPrevious,
		onNext,
		onSetCover,
		onHighlight
	}: Props = $props();

	const details = $derived(
		[
			[m.managePreviewFile(), media.filename],
			[m.uploadCategory(), category],
			[m.photographer(), media.photographer],
			[m.visibility(), media.visibility === 'TEAM' ? m.visibilityTeam() : m.visibilityPublic()],
			[m.managePreviewTaken(), media.takenAt && formatDate(media.takenAt)],
			[
				m.managePreviewDimensions(),
				media.width && media.height
					? `${formatNumber(media.width)} × ${formatNumber(media.height)} px`
					: null
			],
			[m.managePreviewSize(), media.bytes && formatBytes(media.bytes)]
		].filter((row): row is [string, string] => !!row[1])
	);
</script>

<div class="modal modal-open" role="dialog" aria-modal="true" aria-label={media.title}>
	<div
		class="modal-box grid max-h-[92dvh] w-11/12 max-w-7xl gap-0 overflow-hidden p-0 lg:grid-cols-[1fr_20rem]"
	>
		<div class="bg-neutral relative flex min-h-64 items-center justify-center">
			{#if media.largeUrl}
				<img
					src={media.largeUrl}
					alt={media.title}
					class="max-h-[60dvh] w-full object-contain lg:max-h-[92dvh]"
				/>
			{:else}
				<p class="text-neutral-content/70 p-8">{m.manageProcessing()}</p>
			{/if}
			{#if onPrevious}
				<button
					class="btn btn-circle absolute top-1/2 left-3 -translate-y-1/2"
					onclick={onPrevious}
					aria-label={m.previous()}
				>
					<CaretLeftIcon size={20} weight="bold" />
				</button>
			{/if}
			{#if onNext}
				<button
					class="btn btn-circle absolute top-1/2 right-3 -translate-y-1/2"
					onclick={onNext}
					aria-label={m.next()}
				>
					<CaretRightIcon size={20} weight="bold" />
				</button>
			{/if}
		</div>

		<div class="flex flex-col gap-5 overflow-y-auto p-6">
			<div class="flex items-start justify-between gap-4">
				<div class="flex min-w-0 flex-col gap-1">
					<span class="text-base-content/60 text-sm">
						{m.managePreviewPosition({ index, total })}
					</span>
					<h3 class="text-lg leading-snug font-bold break-words">
						{media.title || media.filename}
					</h3>
				</div>
				<button class="btn btn-sm btn-ghost btn-square" onclick={onClose} aria-label={m.close()}>
					<XIcon size={18} weight="bold" />
				</button>
			</div>

			<div class="flex flex-wrap gap-1"><MediaBadges {media} /></div>

			<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm leading-snug">
				{#each details as [label, value] (label)}
					<dt class="text-base-content/60">{label}</dt>
					<dd class="min-w-0 break-words">{value}</dd>
				{/each}
			</dl>

			<div class="border-base-content mt-auto flex flex-col gap-2 border-t pt-5">
				<button class="btn btn-outline btn-block" onclick={() => onHighlight(!media.highlight)}>
					<StarIcon size={18} weight={media.highlight ? 'fill' : 'duotone'} />
					{media.highlight ? m.manageRemoveHighlight() : m.manageAddHighlight()}
				</button>
				<button class="btn btn-outline btn-block" disabled={media.isCover} onclick={onSetCover}>
					<ImageSquareIcon size={18} weight="duotone" />
					{media.isCover ? m.manageIsCover() : m.manageSetCover()}
				</button>
			</div>
		</div>
	</div>
	<button class="modal-backdrop" onclick={onClose} aria-label={m.close()}></button>
</div>
