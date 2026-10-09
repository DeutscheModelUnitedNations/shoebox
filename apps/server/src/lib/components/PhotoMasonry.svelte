<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import BlurImage from '$lib/components/BlurImage.svelte';
	import { page } from '$app/state';
	import { withPhoto } from '$lib/gallery/links';
	import type { Photo } from '$lib/gallery/types';
	import { m } from '$lib/paraglide/messages';

	let {
		photos,
		pageSize = 24,
		class: className = 'columns-2 gap-2.5 md:columns-3 lg:gap-4 xl:columns-4 2xl:columns-5'
	}: {
		photos: Photo[];
		pageSize?: number;
		class?: string;
	} = $props();

	// ?limit= renders more on the server (the link below without JS), the observer grows it in place
	const initial = $derived(Number(page.url.searchParams.get('limit')) || pageSize);
	let limit = $derived.by(() => {
		void photos;
		return initial;
	});
	const visible = $derived(photos.slice(0, limit));
	const hasMore = $derived(visible.length < photos.length);

	const moreHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.set('limit', String(limit + pageSize));
		url.searchParams.delete('photo');
		return `${url.pathname}${url.search}`;
	});

	const more = () => (limit += pageSize);

	// Loads the next page while the link is still a screen below the viewport
	const nearBottom: Attachment<HTMLElement> = (node) => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) more();
			},
			{ rootMargin: '0px 0px 100% 0px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	};
</script>

<div class={className}>
	{#each visible as photo (photo.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the current page.url with ?photo= set -->
		<a
			href={withPhoto(page.url, photo.id)}
			class="mb-2.5 block break-inside-avoid transition-opacity hover:opacity-80 lg:mb-4"
			data-sveltekit-noscroll
		>
			<BlurImage
				src={photo.thumbUrl}
				placeholder={photo.placeholder}
				alt={photo.alt}
				loading="lazy"
				width={photo.width}
				height={photo.height}
				class="block h-auto w-full"
			/>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
</div>

{#if hasMore}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- the current page.url with ?limit= raised -->
	{#key limit}
		<a
			href={moreHref}
			class="btn btn-outline btn-block lg:btn-wide lg:self-center"
			data-sveltekit-noscroll
			onclick={(e) => {
				e.preventDefault();
				more();
			}}
			{@attach nearBottom}
		>
			{m.loadMore()}
		</a>
	{/key}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}
