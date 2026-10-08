<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	interface Props {
		/** `full` adds the written-out association name */
		variant?: 'full' | 'short';
		/** Always use the white artwork, e.g. on `bg-neutral` */
		onDark?: boolean;
		/** Height of the image box. The files carry their clear space, the artwork is ~60% of it. */
		class?: string;
	}

	let { variant = 'full', onDark = false, class: className = 'h-14' }: Props = $props();

	const base = 'https://cdn.dmun.de/cdn/logos';
	const file = $derived(variant === 'full' ? 'dmun-lang' : 'dmun');
</script>

{#if onDark}
	<img src="{base}/{file}-darkmode.svg" alt={m.logoAlt()} class={['w-auto', className]} />
{:else}
	<img src="{base}/{file}.svg" alt={m.logoAlt()} class={['w-auto dark:hidden', className]} />
	<img
		src="{base}/{file}-darkmode.svg"
		alt={m.logoAlt()}
		class={['hidden w-auto dark:block', className]}
	/>
{/if}
