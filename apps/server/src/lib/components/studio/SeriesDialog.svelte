<script lang="ts">
	import { mutate } from '$lib/api/mutate';
	import { m } from '$lib/paraglide/messages';
	import type { SeriesDraft } from '$lib/studio/drafts';
	import { runAndReload } from '$lib/studio/toast.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		draft: SeriesDraft;
		onClose: () => void;
	}

	let { draft = $bindable(), onClose }: Props = $props();

	async function save() {
		const { id, ...input } = draft;
		const saved = await runAndReload(
			(): Promise<unknown> =>
				id ? mutate('updateSeries', { id, input }) : mutate('createSeries', { input }),
			m.adminSaved()
		);
		if (saved) onClose();
	}

	async function remove(id: string) {
		if (await runAndReload(() => mutate('deleteSeries', { id }), m.adminDeleted())) onClose();
	}
</script>

<Modal title={draft.id ? m.adminEditSeries() : m.adminAddSeries()} {onClose}>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminName()}</span>
		<input class="input w-full" bind:value={draft.name} />
	</label>
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="fieldset">
			<span class="fieldset-legend">{m.adminShortName()}</span>
			<input class="input w-full" bind:value={draft.shortName} />
		</label>
		<label class="fieldset">
			<span class="fieldset-legend">{m.adminKind()}</span>
			<select class="select w-full" bind:value={draft.kind}>
				<option value="CONFERENCE">{m.adminKindConference()}</option>
				<option value="ASSOCIATION">{m.adminKindAssociation()}</option>
			</select>
		</label>
	</div>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminRegion()}</span>
		<input class="input w-full" bind:value={draft.region} placeholder="Kiel · Schleswig-Holstein" />
	</label>
	{#snippet actions()}
		{#if draft.id}
			{@const id = draft.id}
			<button class="btn btn-ghost text-error mr-auto" onclick={() => remove(id)}>
				{m.manageDelete()}
			</button>
		{/if}
		<button class="btn btn-outline" onclick={onClose}>{m.cancel()}</button>
		<button class="btn btn-primary" onclick={save}>{m.adminSave()}</button>
	{/snippet}
</Modal>
