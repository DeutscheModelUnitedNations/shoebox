<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import LinkSimpleIcon from 'phosphor-svelte/lib/LinkSimpleIcon';

	interface Props {
		url: string;
		label: string;
		class?: string;
	}

	let { url, label, class: className = 'btn' }: Props = $props();

	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<button class={className} onclick={copy}>
	{#if copied}
		<CheckIcon size={18} weight="bold" />
		{m.linkCopied()}
	{:else}
		<LinkSimpleIcon size={18} weight="duotone" />
		{label}
	{/if}
</button>
