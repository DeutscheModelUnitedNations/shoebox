<script lang="ts">
	// Status badges of a photo in the manage grid and preview
	import { m } from '$lib/paraglide/messages';
	import type { StudioMedia } from '$lib/studio/types';

	let { media }: { media: StudioMedia } = $props();
</script>

{#if media.isCover}
	<span class="badge badge-neutral badge-sm uppercase">{m.manageCover()}</span>
{/if}
{#if media.highlight}
	<span class="badge badge-primary badge-sm uppercase">{m.manageHighlightBadge()}</span>
{/if}
{#if media.visibility === 'TEAM'}
	<span class="badge badge-neutral badge-sm uppercase">{m.manageTeamOnly()}</span>
{/if}
{#if media.status === 'HELD'}
	<span class="badge badge-neutral badge-sm uppercase">{m.uploadHeld()}</span>
{:else if media.duplicate}
	<span class="badge badge-ghost badge-sm uppercase">{m.manageDuplicateBadge()}</span>
{/if}
