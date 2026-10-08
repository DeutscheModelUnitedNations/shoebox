<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { mutate } from '$lib/api/mutate';
	import CategoryEditorSection from '$lib/components/studio/CategoryEditorSection.svelte';
	import EventFields from '$lib/components/studio/EventFields.svelte';
	import PhotographerAccess from '$lib/components/studio/PhotographerAccess.svelte';
	import StudioHeading from '$lib/components/studio/StudioHeading.svelte';
	import { toEventDraft, type EventDraft } from '$lib/studio/drafts';
	import { m } from '$lib/paraglide/messages';
	import { attempt, runAndReload } from '$lib/studio/toast.svelte';

	let { data } = $props();

	const eventsHref = resolve('/(studio)/admin/events');
	// A form draft: bound fields mutate it deeply, which a writable $derived would not track
	// eslint-disable-next-line svelte/prefer-writable-derived
	let draft = $state<EventDraft>(untrack(() => toEventDraft(data.event)));
	// Fresh server data replaces the draft, e.g. after saving
	$effect(() => {
		draft = toEventDraft(data.event);
	});

	const save = () =>
		runAndReload(
			() =>
				mutate('updateEvent', {
					id: data.event.id,
					input: { ...draft, dateTo: draft.dateTo || null }
				}),
			m.adminSaved()
		);

	async function deleteEvent() {
		const ok = await attempt(() => mutate('deleteEvent', { id: data.event.id }), m.adminDeleted());
		if (ok !== undefined) goto(eventsHref);
	}
</script>

<svelte:head>
	<title>{data.event.name} {data.event.edition} · {m.navAdmin()} · {m.appName()}</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-10 lg:px-12">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<StudioHeading
			crumbs={[
				{ label: m.navAdmin(), href: resolve('/(studio)/admin') },
				{ label: m.adminEventsShort(), href: eventsHref },
				{ label: `${data.event.name} ${data.event.edition}` }
			]}
			title={data.event.name}
			emphasis={data.event.edition}
			suffix={m.adminEditSuffix()}
		/>
		<div class="flex gap-3">
			<a href={eventsHref} class="btn btn-outline">{m.cancel()}</a>
			<button class="btn btn-primary" onclick={save}>{m.adminSave()}</button>
		</div>
	</div>

	<div class="grid gap-12 lg:grid-cols-2">
		<div class="flex flex-col gap-6">
			<h2 class="text-primary text-2xl font-light">{m.adminDetails()}</h2>
			<EventFields bind:draft series={data.series} full />
			<div class="flex items-center gap-5">
				{#if data.cover?.thumbUrl}
					<img src={data.cover.thumbUrl} alt="" class="aspect-3/2 w-40 object-cover" />
				{:else}
					<div class="bg-base-200 aspect-3/2 w-40"></div>
				{/if}
				<div class="text-sm">
					<p class="font-bold">{m.manageCover()}</p>
					<p class="text-base-content/70">
						{m.adminCoverHint()}
						<a
							href={resolve('/(studio)/manage/[eventId]', { eventId: data.event.id })}
							class="link link-primary"
						>
							{m.navManage()}
						</a>
					</p>
				</div>
			</div>
			{#if !data.hasPhotos}
				<button class="btn btn-ghost text-error self-start" onclick={deleteEvent}>
					{m.adminDeleteEvent()}
				</button>
			{/if}
		</div>

		<div class="flex flex-col gap-10">
			<CategoryEditorSection eventId={data.event.id} tree={data.tree} previous={data.previous} />

			<PhotographerAccess
				eventId={data.event.id}
				assigned={data.assigned}
				photographers={data.photographers}
			/>
		</div>
	</div>
</section>
