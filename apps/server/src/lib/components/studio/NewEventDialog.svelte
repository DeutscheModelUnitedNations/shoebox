<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { mutate } from '$lib/api/mutate';
	import { m } from '$lib/paraglide/messages';
	import type { EventDraft } from '$lib/studio/drafts';
	import { attempt } from '$lib/studio/toast.svelte';
	import EventFields from './EventFields.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		draft: EventDraft;
		series: { id: string; name: string; shortName: string; kind: string }[];
		onClose: () => void;
	}

	let { draft = $bindable(), series, onClose }: Props = $props();

	async function create() {
		const input = { ...draft, dateTo: draft.dateTo || null };
		const id = await attempt(() => mutate('createEvent', { input }), m.adminEventCreated());
		if (!id) return;
		onClose();
		goto(resolve('/(studio)/admin/events/[id]', { id: String(id) }));
	}
</script>

<Modal title={m.adminNewEvent()} {onClose} class="max-w-2xl gap-5">
	<EventFields bind:draft {series} />
	<p class="text-base-content/60 text-sm">{m.adminNewEventHint()}</p>
	{#snippet actions()}
		<button class="btn btn-outline" onclick={onClose}>{m.cancel()}</button>
		<button class="btn btn-primary" onclick={create}>{m.adminCreate()}</button>
	{/snippet}
</Modal>
