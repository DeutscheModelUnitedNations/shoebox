<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { CategoryEditor } from '$lib/studio/categoryEditor.svelte';
	import type { StudioCategory } from '$lib/studio/types';
	import DotsSixVerticalIcon from 'phosphor-svelte/lib/DotsSixVerticalIcon';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import AddCategoryInput from './AddCategoryInput.svelte';
	import CategoryRow from './CategoryRow.svelte';

	interface Props {
		node: StudioCategory;
		siblings: StudioCategory[];
		editor: CategoryEditor;
	}

	let { node, siblings, editor }: Props = $props();

	const hideLabel = $derived(node.hidden ? m.adminShowCategory() : m.adminHideCategory());
	const sameParent = $derived(editor.dragged?.parentId === node.parentId);
</script>

{#snippet renameForm(renaming: { id: string; name: string })}
	<input
		class="input input-sm flex-1"
		bind:value={renaming.name}
		onkeydown={(e) => e.key === 'Enter' && editor.rename()}
	/>
	<button class="btn btn-sm btn-primary" onclick={() => editor.rename()}>{m.adminSave()}</button>
	<button class="btn btn-sm btn-ghost" onclick={() => (editor.renaming = null)}>{m.cancel()}</button
	>
{/snippet}

{#snippet display()}
	<span class={['flex-1', node.depth === 1 && 'font-bold', node.hidden && 'opacity-50']}>
		{node.name}
	</span>
	<span class="text-base-content/60 text-sm">{node.count}</span>
	<button
		class="btn btn-ghost btn-xs btn-square"
		title={hideLabel}
		aria-label={hideLabel}
		onclick={() => editor.toggleHidden(node)}
	>
		{#if node.hidden}<EyeSlashIcon size={16} />{:else}<EyeIcon size={16} />{/if}
	</button>
	<button
		class="link link-primary text-sm"
		onclick={() => (editor.renaming = { id: node.id, name: node.name })}
	>
		{m.adminRename()}
	</button>
	{#if node.depth < 3}
		<button class="link link-primary text-sm" onclick={() => editor.startAdding(node.id)}>
			{m.adminAddSub()}
		</button>
	{/if}
	<button class="link text-error text-sm" onclick={() => editor.startRemoving(node)}>
		{m.manageDelete()}
	</button>
{/snippet}

<li class="border-base-300 border-b">
	<div
		role="listitem"
		class={['flex items-center gap-3 py-2', editor.dragged?.id === node.id && 'opacity-40']}
		style:padding-left={`${(node.depth - 1) * 1.25}rem`}
		draggable="true"
		ondragstart={() => (editor.dragged = { id: node.id, parentId: node.parentId })}
		ondragend={() => (editor.dragged = null)}
		ondragover={(e) => sameParent && e.preventDefault()}
		ondrop={(e) => {
			e.preventDefault();
			editor.reorder(siblings, node);
		}}
	>
		<DotsSixVerticalIcon size={18} class="text-base-content/50 cursor-grab" aria-hidden="true" />
		{#if editor.renaming?.id === node.id}
			{@render renameForm(editor.renaming)}
		{:else}
			{@render display()}
		{/if}
	</div>
	{#if editor.addingTo === node.id}
		<AddCategoryInput
			{editor}
			placeholder={m.adminNewSubcategory()}
			indent={node.depth * 1.25 + 1.5}
		/>
	{/if}
	{#if node.children.length > 0}
		<ul>
			{#each node.children as child (child.id)}
				<CategoryRow node={child} siblings={node.children} {editor} />
			{/each}
		</ul>
	{/if}
</li>
