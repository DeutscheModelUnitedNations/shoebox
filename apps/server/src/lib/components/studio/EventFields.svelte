<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { EventDraft } from '$lib/studio/drafts';

	interface Props {
		draft: EventDraft;
		series: { id: string; name: string; shortName: string; kind: string }[];
		/** Description, subtitle and rights, only on the edit page */
		full?: boolean;
	}

	let { draft = $bindable(), series, full = false }: Props = $props();

	/** A conference edition is named after its series, projects carry their own name. */
	function pickSeries(id: string) {
		const picked = series.find((s) => s.id === id);
		draft.seriesId = id;
		if (picked?.kind === 'CONFERENCE') {
			draft.name = picked.shortName;
			if (!draft.subtitle) draft.subtitle = picked.name;
		}
	}
</script>

<div class="grid gap-4 sm:grid-cols-2">
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminSeriesField()}</span>
		<select
			class="select w-full"
			value={draft.seriesId}
			onchange={(e) => pickSeries(e.currentTarget.value)}
		>
			{#each series as s (s.id)}
				<option value={s.id}>{s.shortName}</option>
			{/each}
		</select>
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminEdition()}</span>
		<input class="input w-full" bind:value={draft.edition} placeholder="2027" />
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminName()}</span>
		<input class="input w-full" bind:value={draft.name} />
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.factLocation()}</span>
		<input class="input w-full" bind:value={draft.location} placeholder="Landeshaus Kiel" />
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminDateFrom()}</span>
		<input type="date" class="input w-full" bind:value={draft.dateFrom} />
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminDateTo()}</span>
		<input type="date" class="input w-full" bind:value={draft.dateTo} />
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminDatePrecision()}</span>
		<select class="select w-full" bind:value={draft.datePrecision}>
			<option value="DAY">{m.adminPrecisionDay()}</option>
			<option value="MONTH">{m.adminPrecisionMonth()}</option>
			<option value="YEAR">{m.adminPrecisionYear()}</option>
		</select>
	</label>
	<label class="fieldset">
		<span class="fieldset-legend">{m.adminEventVisibility()}</span>
		<select class="select w-full" bind:value={draft.visibility}>
			<option value="PUBLIC">{m.visibilityPublic()}</option>
			<option value="HIDDEN">{m.visibilityHidden()}</option>
		</select>
	</label>
	{#if full}
		<label class="fieldset sm:col-span-2">
			<span class="fieldset-legend">{m.adminSubtitle()}</span>
			<input class="input w-full" bind:value={draft.subtitle} />
		</label>
		<label class="fieldset sm:col-span-2">
			<span class="fieldset-legend">{m.adminDescription()}</span>
			<textarea class="textarea h-32 w-full" bind:value={draft.description}></textarea>
		</label>
		<label class="fieldset sm:col-span-2">
			<span class="fieldset-legend">{m.factRights()}</span>
			<input
				class="input w-full"
				bind:value={draft.rights}
				placeholder="© DMUN e. V., alle Rechte vorbehalten"
			/>
		</label>
	{/if}
</div>
