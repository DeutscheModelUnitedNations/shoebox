<script lang="ts">
	import BlurImage from '$lib/components/BlurImage.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import CategoryGrid from '$lib/components/CategoryGrid.svelte';
	import CopyLinkButton from '$lib/components/CopyLinkButton.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import PhotoMasonry from '$lib/components/PhotoMasonry.svelte';
	import { formatDateRange } from '$lib/gallery/format';
	import { eventHref, seriesHref } from '$lib/gallery/links';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
	const event = $derived(data.event);
	const title = $derived(`${event.name} ${event.edition}`);
</script>

<svelte:head>
	<title>{title} · {m.appName()}</title>
</svelte:head>

{#if event.hero}
	<div class="h-64 overflow-hidden sm:h-80 lg:h-110">
		<BlurImage
			src={event.hero.url}
			placeholder={event.hero.placeholder}
			position="50% 40%"
			alt={event.hero.alt}
			class="size-full object-cover object-[50%_40%]"
			width={event.hero.width}
			height={event.hero.height}
			wrapperClass="size-full"
		/>
	</div>
{/if}

<section class="border-base-300 border-b">
	<div
		class="mx-auto grid max-w-7xl gap-10 px-5 pt-9 pb-10 lg:grid-cols-[1fr_22.5rem] lg:gap-16 lg:px-12 lg:pt-12 lg:pb-14"
	>
		<div class="flex flex-col gap-5">
			<div class="breadcrumbs text-base-content/60 py-0 text-sm">
				<ul>
					<li><a href={resolve('/')}>{m.gallery()}</a></li>
					<li><a href={seriesHref(data.series.slug)}>{data.series.shortName}</a></li>
					<li class="text-base-content">{event.edition}</li>
				</ul>
			</div>
			<AccentStripe class="w-30" />
			<h1 class="text-5xl leading-none font-extralight lg:text-7xl">
				{event.name} <span class="font-bold">{event.edition}</span>
			</h1>
			<p class="text-lg leading-tight font-bold lg:text-xl lg:leading-none">{event.subtitle}</p>
			<p class="max-w-[62ch] leading-snug">{event.description}</p>
			<div class="mt-1 flex flex-col gap-3 sm:flex-row">
				<a href="#categories" class="btn btn-primary">
					{m.allPhotos({ count: event.photoCount })}
				</a>
				<CopyLinkButton
					url={`${page.url.origin}${eventHref(event)}`}
					label={m.shareLink()}
					class="btn btn-outline"
				/>
			</div>
		</div>

		<dl
			class="bg-base-200 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 self-start px-7 py-6 leading-snug"
		>
			<dt class="text-base-content/60">{m.factLocation()}</dt>
			<dd>{event.location}</dd>
			<dt class="text-base-content/60">{m.factDates()}</dt>
			<dd>{formatDateRange(event.dates)}</dd>
			<dt class="text-base-content/60">{m.factPhotos()}</dt>
			<dd>{m.factPhotosValue({ count: event.photoCount, categories: event.categoryCount })}</dd>
			{#if event.photographers.length > 0}
				<dt class="text-base-content/60">{m.factPhotographers()}</dt>
				<dd>{event.photographers.join(', ')}</dd>
			{/if}
			<dt class="text-base-content/60">{m.factRights()}</dt>
			<dd>{event.rights}</dd>
		</dl>
	</div>
</section>

{#if event.highlights.length > 0}
	<section class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 pt-12 pb-6 lg:px-12 lg:pt-14">
		<div class="flex items-baseline justify-between gap-4">
			<h2 class="text-primary text-2xl leading-none font-bold lg:text-3xl">{m.highlights()}</h2>
			<span class="text-base-content/60 text-sm">{m.highlightsNote()}</span>
		</div>
		<PhotoMasonry photos={event.highlights} />
	</section>
{/if}

<section
	id="categories"
	class="mx-auto flex w-full max-w-7xl scroll-mt-6 flex-col gap-6 px-5 pt-10 pb-16 lg:px-12 lg:pb-20"
>
	<h2 class="text-primary text-2xl leading-none font-bold lg:text-3xl">{m.categories()}</h2>
	<CategoryGrid {event} />
</section>

<Lightbox
	photos={event.highlights}
	crumbs={[
		{ label: title, href: eventHref(event) },
		{ label: m.highlights(), href: eventHref(event) }
	]}
	rights={event.rights}
	isTeam={page.data.isTeam}
/>
