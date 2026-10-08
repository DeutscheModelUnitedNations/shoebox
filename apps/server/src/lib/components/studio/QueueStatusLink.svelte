<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { formatEta, type QueueState } from '$lib/studio/queue';
	import GearIcon from 'phosphor-svelte/lib/GearIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';

	interface Props {
		queue: { state: QueueState; count: number; etaSeconds: number | null };
	}

	let { queue }: Props = $props();

	const label = $derived.by(() => {
		if (queue.state === 'idle') return `${m.queueTitle()} · ${m.queueStateIdle()}`;
		const summary = m.queueSummary({ count: formatNumber(queue.count) });
		if (queue.state === 'stalled') return `${summary} · ${m.queueStateStalled()}`;
		return queue.etaSeconds === null
			? summary
			: `${summary} · ${m.queueEta({ duration: formatEta(queue.etaSeconds, getLocale()) })}`;
	});
</script>

<a
	href={resolve('/(studio)/manage/queue')}
	class={[
		'flex items-center gap-2 self-start text-sm hover:opacity-80',
		queue.state === 'stalled' ? 'text-error' : 'link link-primary'
	]}
>
	{#if queue.state === 'stalled'}
		<WarningIcon size={20} weight="duotone" />
	{:else}
		<GearIcon size={20} weight="duotone" />
	{/if}
	{label}
</a>
