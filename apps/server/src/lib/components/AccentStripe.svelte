<script lang="ts">
	// The Akzentstreifen, the one rounded shape in the DMUN corporate design. White on dark grounds.
	interface Props {
		onDark?: boolean;
		vertical?: boolean;
		/** Length, e.g. `w-16` (or `h-…` when vertical) */
		class?: string;
	}

	let { onDark = false, vertical = false, class: className = '' }: Props = $props();
</script>

<div
	class={[
		'shrink-0 rounded-full',
		onDark ? 'bg-neutral-content' : 'bg-accent',
		vertical ? 'w-2 self-stretch' : ['h-2', className || 'w-16'],
		vertical && className
	]}
	aria-hidden="true"
></div>
