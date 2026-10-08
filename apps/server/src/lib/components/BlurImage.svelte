<script module lang="ts">
	/** Set once the server-rendered page has hydrated, later images are created on the client */
	let hydrated = false;
	/** How long a client-side image may take before it counts as loading, cached ones are faster */
	const CACHE_GRACE_MS = 100;
</script>

<script lang="ts">
	/**
	 * A photo with its blurhash on top until the image has fully loaded, then the photo fades
	 * in and sharpens while the blur fades out. `class` styles the image, `wrapperClass` the box
	 * around image and blur, which takes the image's place in the layout.
	 *
	 * Server-rendered images start blurred. Images created or switched on the client (lightbox,
	 * preview, client navigation) first show as they are: cached ones appear instantly, the
	 * others switch to the blur after CACHE_GRACE_MS and de-blur once loaded.
	 */
	import { onMount, untrack } from 'svelte';
	import type { ClassValue, HTMLImgAttributes } from 'svelte/elements';
	import { initialPhase, settledPhase, sourcePhase, type BlurPhase } from '$lib/blurPhase';

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
	let phase = $state<BlurPhase>(initialPhase(hydrated));
	let timer: ReturnType<typeof setTimeout> | undefined;

	function settle() {
		clearTimeout(timer);
		phase = settledPhase(phase);
	}

	let first = true;
	$effect(() => {
		void src;
		untrack(() => {
			const next = sourcePhase(phase, { changed: !first, complete: !!img?.complete });
			first = false;
			phase = next.phase;
			if (next.blurLater) timer = setTimeout(() => (phase = 'blurred'), CACHE_GRACE_MS);
		});
		return () => clearTimeout(timer);
	});

	onMount(() => {
		hydrated = true;
	});

	const imageClass: Record<BlurPhase, string> = {
		blurred: 'scale-105 opacity-0 blur-lg',
		waiting: '',
		revealing: 'transition-[opacity,filter,scale] duration-700 ease-out',
		shown: ''
	};

	const overlayClass: Record<BlurPhase, string> = {
		blurred: '',
		waiting: 'opacity-0',
		revealing: 'opacity-0 transition-opacity duration-700 ease-out',
		shown: 'opacity-0'
	};
</script>

<span class={['relative block overflow-hidden', wrapperClass]}>
	<img
		bind:this={img}
		{src}
		{...rest}
		class={[className, imageClass[phase]]}
		onload={settle}
		onerror={settle}
		data-blur-image
	/>
	{#if placeholder}
		<span
			aria-hidden="true"
			class={['pointer-events-none absolute inset-0 bg-no-repeat', overlayClass[phase]]}
			style:background-image="url({placeholder})"
			style:background-size={fit}
			style:background-position={position}
		></span>
	{/if}
</span>
