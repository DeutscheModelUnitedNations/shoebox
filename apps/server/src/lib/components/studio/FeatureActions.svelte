<script lang="ts">
	// Highlights and cover of the edit panel, for a non-empty selection
	import { m } from '$lib/paraglide/messages';
	import type { StudioMedia } from '$lib/studio/types';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';

	interface Props {
		selection: StudioMedia[];
		onSetCover: () => void;
		onHighlight: (highlight: boolean) => void;
	}

	let { selection, onSetCover, onHighlight }: Props = $props();

	const allHighlights = $derived(selection.every((s) => s.highlight));
</script>

<div class="border-base-content flex flex-col gap-3 border-t pt-5">
	<h3 class="font-bold">{m.highlights()}</h3>
	<p class="text-base-content/70 text-sm leading-snug">{m.manageHighlightHint()}</p>
	<button class="btn btn-outline btn-block" onclick={() => onHighlight(!allHighlights)}>
		<StarIcon size={20} weight={allHighlights ? 'fill' : 'duotone'} />
		{allHighlights ? m.manageRemoveHighlight() : m.manageAddHighlight()}
	</button>
</div>
<div class="border-base-content flex flex-col gap-3 border-t pt-5">
	<h3 class="font-bold">{m.manageCover()}</h3>
	<p class="text-base-content/70 text-sm leading-snug">{m.manageCoverHint()}</p>
	<button class="btn btn-outline btn-block" disabled={selection[0].isCover} onclick={onSetCover}>
		<ImageSquareIcon size={20} weight="duotone" />
		{#if selection[0].isCover}
			{m.manageIsCover()}
		{:else if selection.length > 1}
			{m.manageSetCoverFirst()}
		{:else}
			{m.manageSetCover()}
		{/if}
	</button>
</div>
