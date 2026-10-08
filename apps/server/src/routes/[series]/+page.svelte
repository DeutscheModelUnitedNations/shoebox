<script lang="ts">
	import { resolve } from '$app/paths';
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import EventCard from '$lib/components/EventCard.svelte';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
	const series = $derived(data.series);
</script>

<svelte:head>
	<title>{series.name} · {m.appName()}</title>
</svelte:head>

<section class="mx-auto flex max-w-7xl flex-col gap-5 px-5 pt-9 pb-10 lg:px-12 lg:pt-12 lg:pb-14">
	<div class="breadcrumbs text-base-content/60 py-0 text-sm">
		<ul>
			<li><a href={resolve('/')}>{m.gallery()}</a></li>
			<li class="text-base-content">{series.shortName}</li>
		</ul>
	</div>
	<AccentStripe class="w-30" />
	<p class="text-base-content/60 text-xs tracking-widest uppercase">{series.region}</p>
	<h1 class="text-4xl leading-none font-extralight lg:text-6xl">{series.name}</h1>
</section>

<section class="mx-auto max-w-7xl px-5 pb-16 lg:px-12 lg:pb-20">
	<div class="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
		{#each series.events as event (event.slug)}
			<EventCard {event} showCategories={series.kind === 'conference'} />
		{/each}
	</div>
</section>
