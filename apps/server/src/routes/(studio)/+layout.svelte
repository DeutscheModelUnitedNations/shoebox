<script lang="ts">
	import Toasts from '$lib/components/studio/Toasts.svelte';

	let { children } = $props();
</script>

{@render children()}
<Toasts />
