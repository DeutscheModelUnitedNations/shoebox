<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatBytes, formatDateRange, formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import type { StudioEvent } from '$lib/studio/types';

	let { event }: { event: StudioEvent } = $props();

	const isPublic = $derived(event.visibility === 'PUBLIC');
	const photographers = $derived(event.photographers.map((p) => p.name ?? p.email).join(', '));
</script>

<tr>
	<td class="font-bold">{event.name} {event.edition}</td>
	<td>{formatDateRange(event.dates)}</td>
	<td class="text-right">{formatNumber(event.photoCount)}</td>
	<td class="text-right">{event.storageBytes ? formatBytes(event.storageBytes) : '–'}</td>
	<td>
		{#if photographers}
			{photographers}
		{:else}
			<span class="text-base-content/60">{m.adminNobodyYet()}</span>
		{/if}
	</td>
	<td>
		<span class={['badge badge-sm uppercase', isPublic ? 'badge-ghost' : 'badge-outline']}>
			{isPublic ? m.visibilityPublic() : m.visibilityHidden()}
		</span>
	</td>
	<td class="text-right">
		<a href={resolve('/(studio)/admin/events/[id]', { id: event.id })} class="link link-primary">
			{m.adminEdit()}
		</a>
	</td>
</tr>
