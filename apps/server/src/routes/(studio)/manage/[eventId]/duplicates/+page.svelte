<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { mutate } from '$lib/api/mutate';
	import { formatBytes, formatDate, formatNumber } from '$lib/gallery/format';
	import StudioHeading from '$lib/components/studio/StudioHeading.svelte';
	import { m } from '$lib/paraglide/messages';
	import { eventPageCrumbs } from '$lib/studio/crumbs';
	import { attempt } from '$lib/studio/toast.svelte';
	import type { StudioMedia } from '$lib/studio/types';

	let { data } = $props();

	type Keep = 'LEFT' | 'RIGHT' | 'BOTH';
	let decisions = $state<Record<string, Keep>>({});
	const decided = $derived(Object.keys(decisions).length);
	const manageHref = $derived(resolve('/(studio)/manage/[eventId]', { eventId: data.event.id }));

	async function apply() {
		const list = Object.entries(decisions).map(([candidateId, keep]) => ({ candidateId, keep }));
		await attempt(
			() => mutate('resolveDuplicates', { eventId: data.event.id, decisions: list }),
			m.dupApplied({ count: list.length })
		);
		decisions = {};
		await invalidateAll();
		if (data.pairs.length === 0) goto(manageHref);
	}
</script>

<svelte:head>
	<title>{m.dupTitle()} · {data.event.name} {data.event.edition} · {m.appName()}</title>
</svelte:head>

{#snippet side(media: StudioMedia, category: string | null)}
	<figure class="flex flex-col gap-3">
		<div class="bg-base-200 aspect-3/2 overflow-hidden">
			{#if media.largeUrl}
				<img src={media.largeUrl} alt={media.title} class="size-full object-cover" />
			{:else}
				<div class="text-base-content/60 grid size-full place-items-center text-sm">
					{m.manageProcessing()}
				</div>
			{/if}
		</div>
		<figcaption class="text-sm leading-snug">
			<span class="font-bold">{media.filename}</span>
			·
			{#if media.status === 'HELD'}
				{m.dupHeldInUpload()}
			{:else if category}
				{category}
			{:else}
				{m.manageNoCategory()}
			{/if}
			<br />
			<span class="text-base-content/60">
				{#if media.width && media.height}
					{formatNumber(media.width)} × {formatNumber(media.height)} px ·
				{/if}
				{#if media.bytes}{formatBytes(media.bytes)} ·{/if}
				{media.photographer}
				{#if media.takenAt}· {formatDate(media.takenAt)}{/if}
			</span>
		</figcaption>
	</figure>
{/snippet}

<section class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 lg:px-12">
	<StudioHeading crumbs={eventPageCrumbs(data.event, m.dupBreadcrumb())} title={m.dupTitle()}>
		<p class="text-base-content/70 max-w-[66ch] leading-snug">
			{m.dupIntro({ count: data.pairs.length })}
		</p>
	</StudioHeading>

	{#if data.pairs.length === 0}
		<div class="bg-base-200 flex flex-wrap items-center justify-between gap-4 p-6">
			<p>{m.dupNone()}</p>
			<a href={manageHref} class="btn btn-outline">{m.dupBack()}</a>
		</div>
	{:else}
		{#each data.pairs as pair (pair.id)}
			<div class="border-base-content grid gap-6 border-t pt-6 lg:grid-cols-[1fr_1fr_14rem]">
				{@render side(pair.left, pair.leftCategory)}
				{@render side(pair.right, pair.rightCategory)}
				<fieldset class="flex flex-col gap-3">
					<span
						class={['badge uppercase', pair.similarity >= 98 ? 'badge-neutral' : 'badge-ghost']}
					>
						{m.dupSimilarity({ percent: pair.similarity })}
					</span>
					{#each [['LEFT', m.dupKeepLeft()], ['RIGHT', m.dupKeepRight()], ['BOTH', m.dupKeepBoth()]] as [value, label] (value)}
						<label class="flex cursor-pointer items-center gap-3">
							<input
								type="radio"
								class="radio radio-primary radio-sm"
								name={`pair-${pair.id}`}
								checked={decisions[pair.id] === value}
								onchange={() => (decisions[pair.id] = value as Keep)}
							/>
							{label}
						</label>
					{/each}
					{#if pair.similarity < 98}
						<p class="text-base-content/60 text-sm">{m.dupEditedHint()}</p>
					{/if}
				</fieldset>
			</div>
		{/each}

		<div
			class="border-base-content flex flex-wrap items-center justify-between gap-4 border-t pt-6"
		>
			<p class="text-base-content/70 text-sm">
				{m.dupDecided({ decided, total: data.pairs.length })}
			</p>
			<div class="flex gap-3">
				<a href={manageHref} class="btn btn-outline">{m.dupLater()}</a>
				<button class="btn btn-primary" disabled={decided === 0} onclick={apply}>
					{m.dupApply()}
				</button>
			</div>
		</div>
	{/if}
</section>
