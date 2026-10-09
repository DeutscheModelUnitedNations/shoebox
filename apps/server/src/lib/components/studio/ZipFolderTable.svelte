<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import type { CategoryOption } from '$lib/studio/categories';
	import { folderTree, type Mapping, type Match, type ZipFolder } from '$lib/studio/zipMapping';
	import ZipFolderName from './ZipFolderName.svelte';

	interface Props {
		folders: ZipFolder[];
		mapping: Record<string, Mapping>;
		options: CategoryOption[];
		onChoose: (folderKey: string, target: string) => void;
	}

	let { folders, mapping = $bindable(), options, onChoose }: Props = $props();

	const badge: Record<Match, { label: () => string; class: string }> = {
		exact: { label: m.zipExisting, class: 'badge-ghost' },
		similar: { label: m.zipSimilar, class: 'badge-ghost' },
		new: { label: m.zipNew, class: 'badge-neutral' },
		manual: { label: m.zipAssigned, class: 'badge-ghost' },
		none: { label: () => '', class: 'hidden' }
	};

	const tree = $derived(folderTree(folders));
	const collapsed = new SvelteSet<string>();
	const visible = $derived(
		folders.filter((f) => ![...collapsed].some((key) => f.key.startsWith(`${key}/`)))
	);
</script>

{#snippet target(folder: ZipFolder, map: Mapping)}
	<div class="flex flex-col gap-2">
		<select
			class="select select-sm w-full"
			value={map.target}
			onchange={(e) => onChoose(folder.key, e.currentTarget.value)}
		>
			{#if folder.key !== ''}
				<option value="NEW">{m.zipNewCategory()}</option>
			{/if}
			{#each options as option (option.id)}
				<option value={option.id}>{option.label}</option>
			{/each}
			<option value="NONE">{m.manageNoCategory()}</option>
		</select>
		{#if map.target === 'NEW'}
			<input
				class="input input-sm w-full"
				bind:value={mapping[folder.key].newName}
				aria-label={m.zipNewCategoryName()}
			/>
		{/if}
	</div>
{/snippet}

<div class="overflow-x-auto">
	<table class="table">
		<thead>
			<tr>
				<th>{m.zipFolder()}</th>
				<th class="text-right">{m.factPhotos()}</th>
				<th>{m.zipCategory()}</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each visible as folder (folder.key)}
				{@const map = mapping[folder.key]}
				{@const row = tree[folder.key]}
				{@const open = !collapsed.has(folder.key)}
				<tr>
					<ZipFolderName
						{folder}
						{row}
						{open}
						onToggle={() => (open ? collapsed.add(folder.key) : collapsed.delete(folder.key))}
					/>
					<td class="text-right">
						{folder.count || '–'}
						{#if row?.hasChildren}
							<span class="text-base-content/60 block text-xs whitespace-nowrap">
								{m.zipTotal({ count: formatNumber(row.total) })}
							</span>
						{/if}
					</td>
					<td class="min-w-64"
						>{#if map}{@render target(folder, map)}{/if}</td
					>
					<td class="text-right">
						{#if folder.tooDeep}
							<span class="badge badge-outline badge-sm uppercase">{m.zipTooDeep()}</span>
						{:else if map}
							<span class={['badge badge-sm uppercase', badge[map.match].class]}>
								{badge[map.match].label()}
							</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
