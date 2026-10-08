<script lang="ts">
	import BlurImage from '$lib/components/BlurImage.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import PhotoMasonry from '$lib/components/PhotoMasonry.svelte';
	import { categoryHref, eventHref } from '$lib/gallery/links';
	import type { CategoryNode } from '$lib/gallery/types';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();

	const pageSize = 24;

	const event = $derived(data.category.event);
	const root = $derived(data.category.root);
	const trail = $derived(data.category.trail);
	const current = $derived(trail[trail.length - 1]);
	const eventTitle = $derived(`${event.name} ${event.edition}`);
	const heading = $derived(
		trail.length > 1
			? trail
					.slice(1)
					.map((c) => c.name)
					.join(' · ')
			: root.name
	);

	// Mobile chips: the children of the current category, or its siblings at a leaf
	const parent = $derived(trail.length > 1 ? trail[trail.length - 2] : undefined);
	const chipBase = $derived(current.children.length > 0 ? data.path : data.path.slice(0, -1));
	const chips = $derived(current.children.length > 0 ? current.children : (parent?.children ?? []));

	const limit = $derived(Number(page.url.searchParams.get('limit')) || pageSize);
	const visible = $derived(data.category.photos.slice(0, limit));
	const moreHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.set('limit', String(limit + pageSize));
		url.searchParams.delete('photo');
		return `${url.pathname}${url.search}`;
	});

	const pathTo = (index: number) => data.path.slice(0, index + 1);
	const isOpen = (node: CategoryNode, depth: number) => data.path[depth] === node.slug;
</script>

<svelte:head>
	<title>{heading} · {eventTitle} · {m.appName()}</title>
</svelte:head>

{#snippet crumbs()}
	<div class="breadcrumbs text-base-content/60 py-0 text-sm">
		<ul>
			<li><a href={resolve('/')}>{m.gallery()}</a></li>
			<li><a href={eventHref(event)}>{eventTitle}</a></li>
			{#each trail.slice(0, -1) as node, i (node.slug)}
				<li class="lg:hidden"><a href={categoryHref(event, pathTo(i))}>{node.name}</a></li>
			{/each}
		</ul>
	</div>
{/snippet}

{#snippet tree(nodes: CategoryNode[], depth: number)}
	{#each nodes as node (node.slug)}
		{@const path = [...data.path.slice(0, depth), node.slug]}
		{@const active = path.join('/') === data.path.join('/')}
		<li>
			<a
				href={categoryHref(event, path)}
				class={['justify-between', active && 'menu-active', isOpen(node, depth) && 'font-bold']}
			>
				<span>{node.name}</span>
				<span class="font-normal opacity-60">{node.photoCount}</span>
			</a>
			{#if isOpen(node, depth) && node.children.length > 0}
				<ul>
					{@render tree(node.children, depth + 1)}
				</ul>
			{/if}
		</li>
	{/each}
{/snippet}

<div class="lg:grid lg:min-h-225 lg:grid-cols-[20rem_1fr]">
	<aside class="bg-base-200 hidden flex-col gap-6 px-8 py-10 lg:flex">
		{@render crumbs()}
		<div class="flex flex-col gap-3">
			<AccentStripe />
			<h1 class="text-4xl leading-none font-extralight">{root.name}</h1>
			<p class="text-base-content/60 text-sm">
				{m.categorySummary({ count: root.photoCount, children: root.children.length })}
			</p>
		</div>
		{#if root.children.length > 0}
			<ul class="menu w-full p-0">
				{@render tree(root.children, 1)}
			</ul>
		{/if}
		<p class="text-base-content/60 text-sm leading-snug">
			{m.rightsNote({ holder: [...data.category.photographers, 'DMUN e. V.'].join(' / ') })}
		</p>
	</aside>

	<section class="flex flex-col gap-3.5 px-5 pt-6 pb-4 lg:hidden">
		{@render crumbs()}
		<AccentStripe />
		<h1 class="text-4xl leading-none font-extralight">{current.name}</h1>
		<p class="text-base-content/60 text-sm">
			{current.children.length > 0
				? m.categorySummary({ count: current.photoCount, children: current.children.length })
				: m.photoCount({ count: current.photoCount })}
		</p>
	</section>

	{#if chips.length > 0}
		<nav class="flex gap-2 overflow-x-auto px-5 pt-1 pb-5 lg:hidden">
			{#each chips as chip (chip.slug)}
				{@const href = categoryHref(event, [...chipBase, chip.slug])}
				<a
					{href}
					class={['btn flex-none', chip.slug === current.slug && 'btn-active']}
					aria-current={chip.slug === current.slug ? 'page' : undefined}
				>
					{#if chip.cover}
						<BlurImage
							src={chip.cover.thumbUrl}
							alt=""
							class="size-full object-cover"
							placeholder={chip.cover.placeholder}
							wrapperClass="-ml-2 size-8 shrink-0"
						/>
					{/if}
					{chip.name}
					<span class="badge badge-sm">{chip.photoCount}</span>
				</a>
			{/each}
		</nav>
	{/if}

	<section class="flex flex-col gap-6 px-5 pb-8 lg:px-12 lg:py-10">
		<div class="hidden items-baseline justify-between gap-4 lg:flex">
			<h2 class="text-primary text-3xl leading-none font-bold">{heading}</h2>
			<span class="text-base-content/60 text-sm">
				{m.photoCount({ count: current.photoCount })}
			</span>
		</div>
		<PhotoMasonry photos={visible} />
		{#if visible.length < data.category.photos.length}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- the current page.url with ?limit= raised -->
			<a
				href={moreHref}
				class="btn btn-outline btn-block lg:btn-wide lg:self-center"
				data-sveltekit-noscroll
			>
				{m.loadMore()}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</section>
</div>

<Lightbox
	photos={data.category.photos}
	crumbs={[
		{ label: eventTitle, href: eventHref(event) },
		...trail.map((node, i) => ({ label: node.name, href: categoryHref(event, pathTo(i)) }))
	]}
	rights={data.category.rights}
	isTeam={page.data.isTeam}
/>
