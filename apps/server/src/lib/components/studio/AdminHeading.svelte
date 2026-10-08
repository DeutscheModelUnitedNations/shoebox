<script lang="ts">
	import type { Snippet } from 'svelte';
	import AccentStripe from '$lib/components/AccentStripe.svelte';

	interface Props {
		title: string;
		/** Buttons on the right */
		children?: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div class="flex flex-col gap-4">
		<AccentStripe />
		<h1 class="text-5xl leading-none font-extralight">{title}</h1>
	</div>
	{@render children?.()}
</div>
