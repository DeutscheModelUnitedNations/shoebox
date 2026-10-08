<script lang="ts">
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import EventCard from '$lib/components/EventCard.svelte';
	import { eventHref, seriesHref } from '$lib/gallery/links';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const conferences = $derived(data.series.filter((s) => s.kind === 'conference'));
	const featured = $derived(conferences[0]?.events[0]);
</script>

<section
	class="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-9 pb-10 lg:grid-cols-2 lg:px-12 lg:pt-18 lg:pb-20"
>
	<div class="flex flex-col gap-4 lg:gap-5">
		<AccentStripe class="w-20 lg:w-30" />
		<p class="text-base leading-none font-bold lg:text-xl">{m.heroEyebrow()}</p>
		<h1 class="text-5xl leading-none font-extralight text-balance lg:text-7xl">
			<span class="font-bold">{m.heroTitleBold()}</span>
			{m.heroTitleLight()}
		</h1>
		<p class="max-w-[46ch] leading-snug lg:text-lg">{m.heroLead()}</p>
		<div class="mt-2 flex flex-col gap-3 sm:flex-row">
			{#if featured}
				<a href={eventHref(featured)} class="btn btn-primary">
					{m.viewEvent({ event: `${featured.name} ${featured.edition}` })}
				</a>
			{/if}
			<a href={resolve('/usage')} class="btn btn-outline hidden sm:inline-flex">{m.usage()}</a>
		</div>
		<div class="hidden gap-2 sm:flex">
			{#each conferences as series (series.slug)}
				<a href={seriesHref(series.slug)} class="badge badge-ghost">{series.shortName}</a>
			{/each}
		</div>
	</div>
	<div class="flex justify-end">
		<img
			src="/illustrations/images.svg"
			alt={m.illustrationAlt()}
			class="block w-full lg:max-w-130"
			width="800"
			height="469"
		/>
	</div>
</section>

{#each data.series as series (series.slug)}
	<section class="mx-auto flex max-w-7xl flex-col gap-4 px-5 pb-9 lg:gap-5 lg:px-12 lg:pb-16">
		<p class="text-base-content/60 text-xs tracking-widest uppercase">{series.region}</p>
		<div class="flex items-baseline justify-between gap-4">
			<h2 class="text-primary text-2xl leading-none font-bold lg:text-3xl">
				<span class="lg:hidden"
					>{series.kind === 'conference' ? series.shortName : series.name}</span
				>
				<span class="hidden lg:inline">{series.name}</span>
			</h2>
			<a
				href={seriesHref(series.slug)}
				class="link link-primary link-hover hidden shrink-0 sm:inline"
			>
				{series.kind === 'conference' ? m.allEditions() : m.allProjects()}
			</a>
		</div>
		<div class="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
			{#each series.events.slice(0, 3) as event (event.slug)}
				<EventCard {event} showCategories={series.kind === 'conference'} />
			{/each}
		</div>
		<a href={seriesHref(series.slug)} class="link link-primary link-hover sm:hidden">
			{series.kind === 'conference' ? m.allEditions() : m.allProjects()}
		</a>
	</section>
{/each}
