<script lang="ts">
	import { mutate } from '$lib/api/mutate';
	import { m } from '$lib/paraglide/messages';
	import { flattenCategories } from '$lib/studio/categories';
	import { CategoryEditor } from '$lib/studio/categoryEditor.svelte';
	import { runAndReload } from '$lib/studio/toast.svelte';
	import type { StudioCategory } from '$lib/studio/types';
	import AddCategoryInput from './AddCategoryInput.svelte';
	import CategoryRow from './CategoryRow.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		eventId: string;
		tree: StudioCategory[];
		/** The previous edition of the series, to copy its categories */
		previous: { id: string; name: string; edition: string } | null;
	}

	let { eventId, tree, previous }: Props = $props();

	const editor = new CategoryEditor(() => eventId);
	const moveTargets = $derived(
		flattenCategories(tree).filter((o) => !editor.removedIds.includes(o.id))
	);

	const copyFrom = (fromEventId: string) =>
		runAndReload(
			() => mutate('copyCategories', { fromEventId, toEventId: eventId }),
			m.adminCategoriesCopied()
		);
</script>

<section class="flex flex-col gap-3">
	<div class="flex items-baseline justify-between gap-4">
		<h2 class="text-primary text-2xl font-light">{m.categories()}</h2>
		{#if previous}
			<button class="link link-primary text-sm" onclick={() => copyFrom(previous.id)}>
				{m.adminCopyFrom({ name: `${previous.name} ${previous.edition}` })}
			</button>
		{/if}
	</div>
	<ul class="border-base-300 border-t">
		{#each tree as node (node.id)}
			<CategoryRow {node} siblings={tree} {editor} />
		{/each}
	</ul>
	{#if editor.addingTo === null}
		<AddCategoryInput {editor} placeholder={m.adminNewMainCategory()} />
	{:else}
		<button class="link link-primary self-start text-sm" onclick={() => editor.startAdding(null)}>
			{m.adminAddMain()}
		</button>
	{/if}
	<p class="text-base-content/60 text-sm leading-snug">{m.adminCategoryDeleteHint()}</p>
</section>

{#if editor.removing}
	{@const removing = editor.removing}
	<Modal
		title={m.adminDeleteCategoryTitle({ name: removing.name })}
		onClose={() => (editor.removing = null)}
	>
		{#if removing.count > 0}
			<p>{m.adminDeleteCategoryMove({ count: removing.count })}</p>
			<select class="select w-full" bind:value={editor.moveTarget}>
				<option value="">{m.manageNoCategory()}</option>
				{#each moveTargets as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
		{:else}
			<p>{m.adminDeleteCategoryEmpty()}</p>
		{/if}
		{#snippet actions()}
			<button class="btn btn-outline" onclick={() => (editor.removing = null)}>{m.cancel()}</button>
			<button class="btn btn-error" onclick={() => editor.remove()}>{m.manageDelete()}</button>
		{/snippet}
	</Modal>
{/if}
