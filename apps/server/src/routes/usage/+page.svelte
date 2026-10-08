<script lang="ts">
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	/** The admin text in the visitor's language, German as fallback, the built-in text last. */
	const paragraphs = $derived.by(() => {
		const text = (getLocale() === 'en' ? data.usage.en : data.usage.de) || data.usage.de;
		return text
			.split(/\n\s*\n/)
			.map((p) => p.trim())
			.filter(Boolean);
	});
</script>

<svelte:head>
	<title>{m.usage()} · {m.appName()}</title>
</svelte:head>

<article class="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-12 lg:px-12 lg:py-18">
	<AccentStripe class="w-30" />
	<h1 class="text-5xl leading-none font-extralight lg:text-7xl">{m.usage()}</h1>
	<p class="text-xl leading-none font-bold">{m.usageIntro()}</p>
	<div class="flex max-w-[66ch] flex-col gap-4 leading-snug">
		{#if paragraphs.length > 0}
			{#each paragraphs as paragraph, i (i)}
				<p class="whitespace-pre-line">{paragraph}</p>
			{/each}
		{:else}
			<p>{m.usageCopyright()}</p>
			<p>{m.usageAttribution()}</p>
			<p>{m.usagePermission()}</p>
			<p class="bg-base-200 p-5">{m.usageWatermark()}</p>
		{/if}
	</div>
</article>
