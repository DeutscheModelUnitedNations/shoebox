<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { StudioMedia } from '$lib/studio/types';

	interface Props {
		media: StudioMedia;
		selected: boolean;
		/** Drop marker before this tile while reordering */
		dropBefore: boolean;
		dragged: boolean;
		/** Click, Space or Enter, with shift for a range */
		onToggle: (shiftKey: boolean) => void;
		onPreview: () => void;
		onDragStart: (event: DragEvent) => void;
		onDragEnd: () => void;
		/** Undefined when the current order cannot be changed */
		onDragOver?: () => void;
		onDragLeave: () => void;
		onDrop: () => void;
	}

	let {
		media,
		selected,
		dropBefore,
		dragged,
		onToggle,
		onPreview,
		onDragStart,
		onDragEnd,
		onDragOver,
		onDragLeave,
		onDrop
	}: Props = $props();

	function keydown(event: KeyboardEvent) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		onToggle(event.shiftKey);
	}
</script>

{#snippet badges()}
	{#if media.isCover}
		<span class="badge badge-neutral badge-sm uppercase">{m.manageCover()}</span>
	{/if}
	{#if media.visibility === 'TEAM'}
		<span class="badge badge-neutral badge-sm uppercase">{m.manageTeamOnly()}</span>
	{/if}
	{#if media.status === 'HELD'}
		<span class="badge badge-neutral badge-sm uppercase">{m.uploadHeld()}</span>
	{:else if media.duplicate}
		<span class="badge badge-ghost badge-sm uppercase">{m.manageDuplicateBadge()}</span>
	{/if}
{/snippet}

<div
	role="button"
	tabindex="0"
	aria-pressed={selected}
	class={[
		'bg-base-200 relative aspect-square cursor-pointer overflow-hidden outline-offset-2',
		selected && 'outline-primary outline-3',
		dropBefore && 'border-primary border-l-4',
		dragged && 'opacity-40'
	]}
	draggable="true"
	ondragstart={onDragStart}
	ondragend={onDragEnd}
	ondragover={(e) => {
		if (!onDragOver) return;
		e.preventDefault();
		onDragOver();
	}}
	ondragleave={onDragLeave}
	ondrop={(e) => {
		e.preventDefault();
		onDrop();
	}}
	onclick={(e) => onToggle(e.shiftKey)}
	ondblclick={onPreview}
	onkeydown={keydown}
>
	{#if media.thumbUrl}
		<img
			src={media.thumbUrl}
			alt={media.title}
			loading="lazy"
			draggable="false"
			class="size-full object-cover"
		/>
	{:else}
		<div class="text-base-content/60 grid size-full place-items-center p-3 text-center text-xs">
			{media.status === 'FAILED' ? m.manageFailed() : m.manageProcessing()}
		</div>
	{/if}
	<input
		type="checkbox"
		class="checkbox checkbox-primary checkbox-sm not-checked:bg-base-100 absolute top-2 left-2"
		checked={selected}
		tabindex="-1"
		aria-label={m.manageSelect()}
		onclick={(e) => {
			e.stopPropagation();
			onToggle(e.shiftKey);
		}}
	/>
	<div class="absolute bottom-2 left-2 flex flex-wrap gap-1">{@render badges()}</div>
</div>
