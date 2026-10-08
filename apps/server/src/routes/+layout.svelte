<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
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

<svelte:head>
	<title>{m.appName()}</title>
	<meta name="description" content={m.tagline()} />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<SiteHeader user={data.user} isTeam={data.isTeam} isAdmin={data.isAdmin} />
	<main class="flex-1">
		{@render children()}
	</main>
	<SiteFooter loggedIn={!!data.user} />
</div>
