<script lang="ts">
	/**
	 * A photo with its blurhash on top until the image has fully loaded, then the photo fades
	 * in and sharpens while the blur fades out. `class` styles the image, `wrapperClass` the box
	 * around image and blur, which takes the image's place in the layout.
	 */
	import { onMount } from 'svelte';
	import type { ClassValue, HTMLImgAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLImgAttributes, 'class'> {
		/** Blurhash as data URL, from lib/server/placeholder.ts */
		placeholder?: string | null;
		/** Follows the image's object-fit and object-position */
		fit?: 'cover' | 'contain';
		position?: string;
		class?: ClassValue;
		wrapperClass?: ClassValue;
	}

	let {
		placeholder,
		fit = 'cover',
		position = 'center',
		class: className,
		wrapperClass,
		src,
		...rest
	}: Props = $props();

	let img = $state<HTMLImageElement>();
	// Keyed by src, so a new photo in the same component starts blurred again
	let loadedSrc = $state<string | null | undefined>(null);
	const loaded = $derived(loadedSrc === src);

	const reveal = () => (loadedSrc = src);

	// Loaded before hydration attached the handler
	onMount(() => {
		if (img?.complete) reveal();
	});
</script>

<span class={['relative block overflow-hidden', wrapperClass]}>
	<img
		bind:this={img}
		{src}
		{...rest}
		class={[
			className,
			loaded
				? 'transition-[opacity,filter,scale] duration-700 ease-out'
				: 'scale-105 opacity-0 blur-lg'
		]}
		onload={reveal}
		onerror={reveal}
		data-blur-image
	/>
	{#if placeholder}
		<span
			aria-hidden="true"
			class={[
				'pointer-events-none absolute inset-0 bg-no-repeat',
				loaded && 'opacity-0 transition-opacity duration-700 ease-out'
			]}
			style:background-image="url({placeholder})"
			style:background-size={fit}
			style:background-position={position}
		></span>
	{/if}
</span>
