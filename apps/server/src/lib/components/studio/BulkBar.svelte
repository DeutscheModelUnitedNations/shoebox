<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { CategoryOption } from '$lib/studio/categories';

	interface Props {
		count: number;
		categories: CategoryOption[];
		onMove: (categoryId: string | null) => void;
		onVisibility: (visibility: 'PUBLIC' | 'TEAM') => void;
		onTrash: () => void;
		onClear: () => void;
	}

	let { count, categories, onMove, onVisibility, onTrash, onClear }: Props = $props();
</script>

<div class="border-base-content flex flex-wrap items-center gap-3 border-b pb-4">
	<span class="font-bold">{m.manageSelected({ count })}</span>
	<div class="dropdown">
		<div tabindex="0" role="button" class="btn btn-outline btn-sm">{m.manageMoveTo()}</div>
		<ul
			tabindex="-1"
			class="dropdown-content menu bg-base-100 z-20 mt-1 max-h-80 w-72 flex-nowrap overflow-y-auto p-2 shadow"
		>
			{#each categories as option (option.id)}
				<li><button onclick={() => onMove(option.id)}>{option.label}</button></li>
			{/each}
			<li><button onclick={() => onMove(null)}>{m.manageNoCategory()}</button></li>
		</ul>
	</div>
	<div class="dropdown">
		<div tabindex="0" role="button" class="btn btn-outline btn-sm">{m.visibility()}</div>
		<ul tabindex="-1" class="dropdown-content menu bg-base-100 z-20 mt-1 w-56 p-2 shadow">
			<li><button onclick={() => onVisibility('PUBLIC')}>{m.visibilityPublic()}</button></li>
			<li><button onclick={() => onVisibility('TEAM')}>{m.visibilityTeam()}</button></li>
		</ul>
	</div>
	<button class="btn btn-outline btn-sm" onclick={onTrash}>{m.manageDelete()}</button>
	<button class="btn btn-link btn-sm ml-auto" onclick={onClear}>{m.manageClearSelection()}</button>
</div>
