<script lang="ts">
	import { blurhash } from '$lib/blurhash';
	import { m } from '$lib/paraglide/messages';
	import type { CategoryOption } from '$lib/studio/categories';
	import { editInput, formFromSelection, mixed, type EditForm } from '$lib/studio/editForm';
	import type { StudioMedia } from '$lib/studio/types';
	import FeatureActions from './FeatureActions.svelte';

	interface Props {
		selection: StudioMedia[];
		categories: CategoryOption[];
		onApply: (input: ReturnType<typeof editInput>) => void;
		onSetCover: () => void;
		onHighlight: (highlight: boolean) => void;
	}

	let { selection, categories, onApply, onSetCover, onHighlight }: Props = $props();

	// Refilled whenever the selection changes, edited freely in between. Bound fields mutate it
	// deeply, which a writable $derived would not track
	// eslint-disable-next-line svelte/prefer-writable-derived
	let form = $state<EditForm>(formFromSelection([]));
	$effect(() => {
		form = formFromSelection(selection);
	});

	const isMixed = (pick: (m: StudioMedia) => unknown) => mixed(selection, pick);
</script>

<aside class="bg-base-200 flex flex-col gap-5 px-5 py-8 lg:px-8">
	<h2 class="text-primary text-xl font-light">
		{m.manageEditTitle({ count: selection.length })}
	</h2>
	{#if selection.length === 0}
		<p class="text-base-content/70 text-sm leading-snug">{m.manageEditEmpty()}</p>
	{:else}
		<div class="flex flex-wrap gap-2">
			{#each selection.slice(0, 6).filter((s) => s.thumbUrl) as media (media.id)}
				<img
					src={media.thumbUrl}
					alt=""
					class="h-12 w-16 object-cover"
					{@attach blurhash(media.blurhash, media)}
				/>
			{/each}
		</div>
		<label class="fieldset">
			<span class="fieldset-legend">{m.uploadCaption()}</span>
			<input
				class="input w-full"
				bind:value={form.caption}
				placeholder={isMixed((s) => s.title) ? m.manageMixed() : ''}
			/>
		</label>
		<label class="fieldset">
			<span class="fieldset-legend">{m.uploadCategory()}</span>
			<select class="select w-full" bind:value={form.category}>
				{#if isMixed((s) => s.categoryId)}
					<option value="">{m.manageMixedKeep()}</option>
				{/if}
				{#each categories as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
				<option value="none">{m.manageNoCategory()}</option>
			</select>
		</label>
		<label class="fieldset">
			<span class="fieldset-legend">{m.visibility()}</span>
			<select class="select w-full" bind:value={form.visibility}>
				{#if isMixed((s) => s.visibility)}
					<option value="">{m.manageMixedKeep()}</option>
				{/if}
				<option value="PUBLIC">{m.visibilityPublic()}</option>
				<option value="TEAM">{m.visibilityTeam()}</option>
			</select>
		</label>
		<label class="fieldset">
			<span class="fieldset-legend">{m.photographer()}</span>
			<input
				class="input w-full"
				bind:value={form.photographer}
				placeholder={isMixed((s) => s.photographer) ? m.manageMixed() : ''}
			/>
		</label>
		<div class="border-base-content flex flex-col gap-3 border-t pt-5">
			<button class="btn btn-primary btn-block" onclick={() => onApply(editInput(form, selection))}>
				{m.manageApply()}
			</button>
		</div>
		<FeatureActions {selection} {onSetCover} {onHighlight} />
	{/if}
	<p class="text-base-content/60 text-sm leading-snug">{m.manageTrashNote()}</p>
</aside>
