<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initialSetTheme } from '$lib/utils/theme.svelte';
	import { m } from '$lib/paraglide/messages';

	let { children } = $props();

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

{@render children()}
