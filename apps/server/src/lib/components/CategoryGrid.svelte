<script lang="ts">
	import { categoryHref } from '$lib/gallery/links';
	import type { EventDetail } from '$lib/gallery/types';
	import { m } from '$lib/paraglide/messages';
	import LeafWatermark from './LeafWatermark.svelte';

	let { event }: { event: Pick<EventDetail, 'seriesSlug' | 'slug' | 'categories'> } = $props();

	const maxChildLinks = 5;
</script>

<div class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
	{#each event.categories as category (category.slug)}
		{@const href = categoryHref(event, [category.slug])}
		<div class="flex flex-col gap-3">
			<a
				{href}
				class="relative block aspect-3/2 overflow-hidden transition-opacity hover:opacity-80"
			>
				{#if category.cover}
					<img
						src={category.cover.thumbUrl}
						alt=""
						loading="lazy"
						class="size-full object-cover"
						width={category.cover.width}
						height={category.cover.height}
					/>
				{:else}
					<LeafWatermark />
				{/if}
				<span class="badge badge-neutral absolute top-3 left-3 text-xs tracking-widest uppercase">
					{m.photoCount({ count: category.photoCount })}
				</span>
			</a>
			<a {href} class="text-base-content leading-none font-bold hover:opacity-80">
				{category.name}
			</a>
			{#if category.children.length > 0}
				<div class="flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
					{#each category.children.slice(0, maxChildLinks) as child (child.slug)}
						<a
							href={categoryHref(event, [category.slug, child.slug])}
							class="link link-primary link-hover">{child.name}</a
						>
					{/each}
					{#if category.children.length > maxChildLinks}
						<a {href} class="link link-hover text-base-content/60">
							{m.moreCount({ count: category.children.length - maxChildLinks })}
						</a>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
