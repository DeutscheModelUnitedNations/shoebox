<script lang="ts">
	import { blurhash } from '$lib/blurhash';
	import { page } from '$app/state';
	import { withPhoto } from '$lib/gallery/links';
	import type { Photo } from '$lib/gallery/types';

	let {
		photos,
		class: className = 'columns-2 gap-2.5 lg:columns-3 lg:gap-4'
	}: {
		photos: Photo[];
		class?: string;
	} = $props();
</script>

<div class={className}>
	{#each photos as photo (photo.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the current page.url with ?photo= set -->
		<a
			href={withPhoto(page.url, photo.id)}
			class="mb-2.5 block break-inside-avoid transition-opacity hover:opacity-80 lg:mb-4"
			data-sveltekit-noscroll
		>
			<img
				src={photo.thumbUrl}
				{@attach blurhash(photo.blurhash, photo)}
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
