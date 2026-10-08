<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<section class="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-24 lg:px-12">
	<AccentStripe class="w-30" />
	<h1 class="text-6xl leading-none font-extralight lg:text-7xl">
		<span class="font-bold">{page.status}</span>
	</h1>
	<p class="text-lg">{page.error?.message}</p>
	<div>
		<a class="btn btn-primary" href={resolve('/')}>{m.backToGallery()}</a>
	</div>
</section>
