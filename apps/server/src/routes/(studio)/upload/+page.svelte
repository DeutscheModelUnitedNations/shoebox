<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- links are resolve() routes with a query parameter appended */
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import FileDropZone from '$lib/components/studio/FileDropZone.svelte';
	import UploadQueue from '$lib/components/studio/UploadQueue.svelte';
	import ZipUpload from '$lib/components/studio/ZipUpload.svelte';
	import { m } from '$lib/paraglide/messages';
	import { enqueue, finishBatch, uploads, uploadStats } from '$lib/studio/uploads.svelte';

	let { data } = $props();

	let mode = $state<'files' | 'zip'>('files');
	let eventId = $state(untrack(() => uploads.eventId ?? data.selectedEvent ?? ''));
	let categoryId = $state('');
	let photographer = $state(untrack(() => data.photographer));
	let visibility = $state<'PUBLIC' | 'TEAM'>('PUBLIC');
	let caption = $state('');

	const categories = $derived(data.categories[eventId] ?? []);
	const stats = $derived(uploadStats());

	function add(files: File[]) {
		if (!eventId) return;
		void enqueue(files, {
			eventId,
			categoryId: categoryId || null,
			visibility,
			photographer: photographer.trim(),
			caption: caption.trim()
		});
	}

	function done() {
		const batch = finishBatch();
		const target = uploads.eventId ?? eventId;
		goto(
			`${resolve('/(studio)/manage/[eventId]', { eventId: target })}?batch=${encodeURIComponent(batch)}`
		);
	}
</script>

<svelte:head>
	<title>{m.uploadPhotos()} · {m.appName()}</title>
</svelte:head>

<div class="grid flex-1 lg:grid-cols-[1fr_24rem]">
	<section class="flex flex-col gap-6 px-5 py-10 lg:px-12">
		<div class="flex flex-col gap-4">
			<AccentStripe />
			<h1 class="text-5xl leading-none font-extralight">{m.uploadPhotos()}</h1>
			<p class="text-base-content/70 max-w-[66ch] leading-snug">
				{mode === 'files' ? m.uploadIntro() : m.zipIntro()}
			</p>
		</div>

		<div role="tablist" class="tabs tabs-border">
			<button
				role="tab"
				class={['tab', mode === 'files' && 'tab-active font-bold']}
				onclick={() => (mode = 'files')}
			>
				{m.uploadSingleFiles()}
			</button>
			<button
				role="tab"
				class={['tab', mode === 'zip' && 'tab-active font-bold']}
				onclick={() => (mode = 'zip')}
			>
				{m.uploadZip()}
			</button>
		</div>

		{#if data.events.length === 0}
			<div class="bg-base-200 p-6">{m.manageNoEvents()}</div>
		{:else if mode === 'zip'}
			<ZipUpload
				events={data.events}
				categories={data.categories}
				bind:eventId
				{photographer}
				{visibility}
			/>
		{:else}
			<div class="grid gap-5 sm:grid-cols-2">
				<label class="fieldset">
					<span class="fieldset-legend">{m.uploadEvent()}</span>
					<select class="select w-full" bind:value={eventId} onchange={() => (categoryId = '')}>
						{#each data.events as event (event.id)}
							<option value={event.id}>{event.label}</option>
						{/each}
					</select>
				</label>
				<label class="fieldset">
					<span class="fieldset-legend">{m.uploadCategory()}</span>
					<select class="select w-full" bind:value={categoryId}>
						<option value="">{m.manageNoCategory()}</option>
						{#each categories as option (option.id)}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<FileDropZone onFiles={add} />

			{#if uploads.items.length > 0}
				<UploadQueue />
			{/if}
		{/if}
	</section>

	<aside class="bg-base-200 flex flex-col gap-5 px-5 py-10 lg:px-8">
		<h2 class="text-primary text-xl font-light">{m.uploadAppliesToAll()}</h2>
		<label class="fieldset">
			<span class="fieldset-legend">{m.photographer()}</span>
			<input class="input w-full" bind:value={photographer} />
		</label>
		<label class="fieldset">
			<span class="fieldset-legend">{m.visibility()}</span>
			<select class="select w-full" bind:value={visibility}>
				<option value="PUBLIC">{m.visibilityPublic()}</option>
				<option value="TEAM">{m.visibilityTeam()}</option>
			</select>
		</label>
		{#if mode === 'files'}
			<label class="fieldset">
				<span class="fieldset-legend">{m.uploadCaptionOptional()}</span>
				<input
					class="input w-full"
					bind:value={caption}
					placeholder={m.uploadCaptionPlaceholder()}
				/>
			</label>
			<div class="border-base-content flex flex-col gap-3 border-t pt-5">
				<button
					class="btn btn-primary btn-block h-auto py-3"
					disabled={stats.total === 0}
					onclick={done}
				>
					{m.uploadDone()}
				</button>
				<p class="text-base-content/60 text-sm leading-snug">{m.uploadBackground()}</p>
			</div>
		{/if}
	</aside>
</div>
