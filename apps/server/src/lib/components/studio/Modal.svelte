<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages';

	interface Props {
		title: string;
		onClose: () => void;
		/** Extra classes for the box, e.g. a wider max-width */
		class?: string;
		children: Snippet;
		actions?: Snippet;
	}

	let { title, onClose, class: boxClass = '', children, actions }: Props = $props();
	const id = $props.id();
</script>

<div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby={id}>
	<div class={['modal-box flex flex-col gap-4', boxClass]}>
		<h3 {id} class="text-primary text-2xl font-light">{title}</h3>
		{@render children()}
		{#if actions}
			<div class="modal-action">{@render actions()}</div>
		{/if}
	</div>
	<button class="modal-backdrop" onclick={onClose} aria-label={m.close()}></button>
</div>
