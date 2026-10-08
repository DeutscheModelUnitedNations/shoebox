<script lang="ts">
	import { blurhash } from '$lib/blurhash';
	import { formatDateRange } from '$lib/gallery/format';
	import { eventHref } from '$lib/gallery/links';
	import type { EventSummary } from '$lib/gallery/types';
	import { m } from '$lib/paraglide/messages';
	import LeafWatermark from './LeafWatermark.svelte';

	let { event, showCategories = true }: { event: EventSummary; showCategories?: boolean } =
		$props();

	const meta = $derived(
		[
			formatDateRange(event.dates),
			m.photoCount({ count: event.photoCount }),
			showCategories && event.categoryCount > 1 && m.categoryCount({ count: event.categoryCount })
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<!-- A row with a small thumbnail on phones, a tile from sm upwards -->
<a
	href={eventHref(event)}
	class="text-base-content grid grid-cols-[8rem_1fr] items-center gap-4 transition-opacity hover:opacity-80 sm:flex sm:flex-col sm:items-stretch sm:gap-3"
>
	<div class="aspect-3/2 overflow-hidden">
		{#if event.cover}
			<img
				src={event.cover.thumbUrl}
				{@attach blurhash(event.cover.blurhash, event.cover)}
				alt=""
				loading="lazy"
				class="size-full object-cover"
				width={event.cover.width}
				height={event.cover.height}
			/>
		{:else}
			<LeafWatermark />
		{/if}
	</div>
	<div>
		<p class="leading-none font-bold">{event.name} {event.edition}</p>
		<p class="text-base-content/60 mt-1.5 text-sm">{meta}</p>
	</div>
</a>
