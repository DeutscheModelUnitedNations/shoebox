<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- hrefs come resolved from the parent, with query parameters */
	import { m } from '$lib/paraglide/messages';
	import type { StudioCategory } from '$lib/studio/types';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';

	interface Props {
		tree: StudioCategory[];
		total: number;
		uncategorized: number;
		highlights: number;
		/** Category id, `none` for photos without category, `highlights`, null for all photos */
		active: string | null;
		href: (category: string | null) => string;
		/** Photos dropped onto a category, null meaning "no category" */
		onDrop?: (categoryId: string | null) => void;
		/** True while photos are being dragged, so drop targets light up */
		dragging?: boolean;
	}

	let {
		tree,
		total,
		uncategorized,
		highlights,
		active,
		href,
		onDrop,
		dragging = false
	}: Props = $props();

	let over = $state<string | null | undefined>(undefined);

	function dropTarget(id: string | null) {
		return {
			ondragover: (event: DragEvent) => {
				if (!onDrop) return;
				event.preventDefault();
				over = id;
			},
			ondragleave: () => (over = undefined),
			ondrop: (event: DragEvent) => {
				event.preventDefault();
				over = undefined;
				onDrop?.(id);
			}
		};
	}
</script>

{#snippet item(node: StudioCategory)}
	<li>
		<a
			href={href(node.id)}
			class={[
				'flex justify-between gap-3',
				active === node.id && 'menu-active',
				dragging && over === node.id && 'outline-primary outline-2'
			]}
			{...dropTarget(node.id)}
		>
			<span class={['flex min-w-0 items-center gap-2', node.depth === 1 && 'font-bold']}>
				<span class="truncate" title={node.name}>{node.name}</span>
				{#if node.hidden}
					<EyeSlashIcon size={14} weight="duotone" aria-label={m.visibilityHidden()} />
				{/if}
			</span>
			<span class="shrink-0 font-normal tabular-nums opacity-60">{node.count}</span>
		</a>
		{#if node.children.length > 0}
			<ul>
				{#each node.children as child (child.id)}
					{@render item(child)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

<nav class="flex flex-col gap-4" aria-label={m.categories()}>
	<p class="text-base-content/60 text-xs tracking-widest uppercase">{m.categories()}</p>
	<ul class="menu w-full min-w-0 p-0">
		<li>
			<a href={href(null)} class={['flex justify-between gap-3', active === null && 'menu-active']}>
				<span>{m.manageAllPhotos()}</span>
				<span class="shrink-0 tabular-nums opacity-60">{total}</span>
			</a>
		</li>
		<li>
			<a
				href={href('highlights')}
				class={['flex justify-between gap-3', active === 'highlights' && 'menu-active']}
			>
				<span class="flex items-center gap-2">
					<StarIcon size={14} weight="duotone" />
					{m.highlights()}
				</span>
				<span class="shrink-0 tabular-nums opacity-60">{highlights}</span>
			</a>
		</li>
		{#each tree as node (node.id)}
			{@render item(node)}
		{/each}
		<li>
			<a
				href={href('none')}
				class={[
					'text-base-content/70 flex justify-between gap-3',
					active === 'none' && 'menu-active',
					dragging && over === null && 'outline-primary outline-2'
				]}
				{...dropTarget(null)}
			>
				<span>{m.manageNoCategory()}</span>
				<span class="shrink-0 tabular-nums opacity-60">{uncategorized}</span>
			</a>
		</li>
	</ul>
</nav>
