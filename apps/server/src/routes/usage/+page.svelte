<script lang="ts">
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head>
	<title>{m.usage()} · {m.appName()}</title>
</svelte:head>

<article class="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-12 lg:px-12 lg:py-18">
	<AccentStripe class="w-30" />
	<h1 class="text-5xl leading-none font-extralight lg:text-7xl">{m.usage()}</h1>
	<p class="text-xl leading-none font-bold">{m.usageIntro()}</p>
	<div class="flex max-w-[66ch] flex-col gap-4 leading-snug">
		<p>{m.usageCopyright()}</p>
		<p>{m.usageAttribution()}</p>
		<p>{m.usagePermission()}</p>
		<p class="bg-base-200 p-5">{m.usageWatermark()}</p>
	</div>
</article>
