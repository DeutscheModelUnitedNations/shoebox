<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import { blockPhotoDrag } from '$lib/imageDrag';
	import { initialSetTheme } from '$lib/utils/theme.svelte';
	import { m } from '$lib/paraglide/messages';

	let { children, data } = $props();

	onMount(() => {
		initialSetTheme();
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => initialSetTheme();
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});
</script>

<svelte:window ondragstart={blockPhotoDrag} />

<svelte:head>
	<title>{m.appName()}</title>
	<meta name="description" content={m.tagline()} />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<SiteHeader
		user={data.user}
		isTeam={data.isTeam}
		isAdmin={data.isAdmin}
		isPhotographer={data.isPhotographer}
	/>
	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
	<!-- Upload, manage and admin are work screens without the gallery footer -->
	{#if !page.route.id?.startsWith('/(studio)')}
		<SiteFooter loggedIn={!!data.user} />
	{/if}
</div>
