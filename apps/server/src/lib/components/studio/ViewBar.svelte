<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- hrefs are the current route with a query parameter */
	import { m } from '$lib/paraglide/messages';

	interface Props {
		heading: string;
		count: number;
		/** Drag and drop reorders the gallery order in this view */
		canReorder: boolean;
		sort: 'custom' | 'taken';
		sortHref: (sort: 'custom' | 'taken') => string;
	}

	let { heading, count, canReorder, sort, sortHref }: Props = $props();

	const sortLinks = $derived([
		{ sort: 'custom' as const, label: m.manageSortCustom() },
		{ sort: 'taken' as const, label: m.manageSortTaken() }
	]);
</script>

<div class="flex flex-wrap items-baseline justify-between gap-3 text-sm">
	<p>
		<span class="font-bold">{heading}</span>
		<span class="text-base-content/60">
			· {m.photoCount({ count })}
			{#if canReorder}· {m.manageOrderLikeGallery()}{/if}
		</span>
	</p>
	<p class="text-base-content/60">
		{m.manageSort()}:
		{#each sortLinks as link, i (link.sort)}
			{#if i > 0}·{/if}
			<a
				href={sortHref(link.sort)}
				class={['link', sort === link.sort ? 'link-primary' : 'link-hover']}
			>
				{link.label}
			</a>
		{/each}
	</p>
</div>
