<script lang="ts">
	import AdminHeading from '$lib/components/studio/AdminHeading.svelte';
	import EventRow from '$lib/components/studio/EventRow.svelte';
	import NewEventDialog from '$lib/components/studio/NewEventDialog.svelte';
	import SeriesDialog from '$lib/components/studio/SeriesDialog.svelte';
	import StorageBar from '$lib/components/studio/StorageBar.svelte';
	import { m } from '$lib/paraglide/messages';
	import {
		emptySeries,
		newEventDraft,
		toSeriesDraft,
		type EventDraft,
		type SeriesDraft
	} from '$lib/studio/drafts';

	let { data } = $props();

	const RECENT = 8;
	let showAll = $state(false);
	const shown = $derived(showAll ? data.events : data.events.slice(0, RECENT));

	let creating = $state<EventDraft | null>(null);
	let editingSeries = $state<SeriesDraft | null>(null);

	const startEvent = () => (creating = newEventDraft(data.series[0], new Date().getFullYear() + 1));
</script>

<svelte:head>
	<title>{m.adminEvents()} · {m.navAdmin()} · {m.appName()}</title>
</svelte:head>

<div class="flex flex-col gap-10">
	<AdminHeading title={m.adminEvents()}>
		<button class="btn btn-primary" onclick={startEvent}>{m.adminNewEvent()}</button>
	</AdminHeading>

	<StorageBar parts={data.storage} capacityBytes={data.capacityBytes} />

	<section class="overflow-x-auto">
		<table class="table">
			<thead>
				<tr class="border-base-content">
					<th>{m.adminName()}</th>
					<th>{m.factDates()}</th>
					<th class="text-right">{m.factPhotos()}</th>
					<th class="text-right">{m.adminStorageColumn()}</th>
					<th>{m.adminPhotographers()}</th>
					<th>{m.adminVisible()}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each shown as event (event.id)}
					<EventRow {event} />
				{/each}
			</tbody>
		</table>
		{#if data.events.length > RECENT && !showAll}
			<p class="text-base-content/70 pt-3 text-sm">
				{m.adminOlderEvents({ count: data.events.length - RECENT })} ·
				<button class="link link-primary" onclick={() => (showAll = true)}
					>{m.adminShowAll()}</button
				>
			</p>
		{/if}
	</section>

	<section class="flex flex-col gap-4">
		<div class="flex items-baseline justify-between gap-4">
			<h2 class="text-primary text-2xl font-light">{m.adminSeries()}</h2>
			<button class="btn btn-outline btn-sm" onclick={() => (editingSeries = emptySeries())}>
				{m.adminAddSeries()}
			</button>
		</div>
		<table class="table">
			<thead>
				<tr class="border-base-content">
					<th>{m.adminName()}</th>
					<th>{m.adminShortName()}</th>
					<th>{m.adminRegion()}</th>
					<th class="text-right">{m.adminEventCount()}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.series as series (series.id)}
					<tr>
						<td>{series.name}</td>
						<td>{series.shortName}</td>
						<td>{series.region}</td>
						<td class="text-right">{series.events}</td>
						<td class="text-right">
							<button
								class="link link-primary"
								onclick={() => (editingSeries = toSeriesDraft(series))}
							>
								{m.adminEdit()}
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>

{#if creating}
	<NewEventDialog bind:draft={creating} series={data.series} onClose={() => (creating = null)} />
{/if}

{#if editingSeries}
	<SeriesDialog bind:draft={editingSeries} onClose={() => (editingSeries = null)} />
{/if}
