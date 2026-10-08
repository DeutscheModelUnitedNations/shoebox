<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { StudioMedia } from '$lib/studio/types';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	interface Props {
		media: StudioMedia;
		onClose: () => void;
	}

	let { media, onClose }: Props = $props();
</script>

<div class="modal modal-open" role="dialog" aria-modal="true" aria-label={media.title}>
	<div class="modal-box flex max-w-5xl flex-col gap-4">
		<div class="flex items-center justify-between gap-4">
			<h3 class="font-bold">{media.title || media.filename}</h3>
			<button class="btn btn-sm btn-ghost btn-square" onclick={onClose} aria-label={m.close()}>
				<XIcon size={18} weight="bold" />
			</button>
		</div>
		{#if media.largeUrl}
			<img src={media.largeUrl} alt={media.title} class="max-h-[70dvh] w-full object-contain" />
		{/if}
		<p class="text-base-content/60 text-sm">{media.filename} · {media.photographer}</p>
	</div>
	<button class="modal-backdrop" onclick={onClose} aria-label={m.close()}></button>
</div>
