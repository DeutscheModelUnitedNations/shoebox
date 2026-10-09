<script lang="ts">
	import FolderIcon from 'phosphor-svelte/lib/FolderIcon';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpenIcon';
	import ImagesIcon from 'phosphor-svelte/lib/ImagesIcon';
	import { m } from '$lib/paraglide/messages';
	import { guideLines, treeIndent, type TreeRow, type ZipFolder } from '$lib/studio/zipMapping';

	interface Props {
		folder: ZipFolder;
		/** Missing for the photos without folder */
		row: TreeRow | undefined;
		open: boolean;
		onToggle: () => void;
	}

	let { folder, row, open, onToggle }: Props = $props();

	const level = $derived(Math.max(folder.depth - 1, 0));
	const Icon = $derived(
		folder.key === '' ? ImagesIcon : row?.hasChildren && open ? FolderOpenIcon : FolderIcon
	);
	const name = $derived(folder.key === '' ? m.zipNoFolder() : folder.name);

	const lines = $derived(row ? guideLines(row, level, open) : []);
</script>

<td class="relative" style:padding-left={`${treeIndent(level)}rem`}>
	{#each lines as style, i (i)}
		<span class="bg-base-content/20 absolute w-px" {style}></span>
	{/each}
	<span class={['flex items-center gap-2', folder.depth === 1 && 'font-bold']}>
		{#if row?.hasChildren}
			<button
				class="text-primary shrink-0 cursor-pointer"
				aria-expanded={open}
				aria-label={m.zipToggleSubfolders({ folder: folder.name })}
				onclick={onToggle}
			>
				<Icon weight="duotone" size="1rem" />
			</button>
		{:else}
			<Icon weight="duotone" size="1rem" class="shrink-0" />
		{/if}
		{name}
	</span>
</td>
