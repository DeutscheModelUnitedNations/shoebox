<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- links are resolve() routes with a query parameter appended */
	import { resolve } from '$app/paths';
	import AccentStripe from '$lib/components/AccentStripe.svelte';
	import { formatDateRange, formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import ImagesIcon from 'phosphor-svelte/lib/ImagesIcon';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.navManage()} · {m.appName()}</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 lg:px-12">
	<div class="flex flex-col gap-4">
		<AccentStripe />
		<h1 class="text-5xl leading-none font-extralight">{m.navManage()}</h1>
		<p class="text-base-content/70 max-w-[66ch] leading-snug">{m.manageIntro()}</p>
	</div>

	{#if data.events.length === 0}
		<div class="bg-base-200 flex flex-col items-start gap-3 p-6">
			<ImagesIcon size={40} weight="duotone" class="text-primary" />
			<p>{m.manageNoEvents()}</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="border-base-content">
						<th></th>
						<th>{m.adminName()}</th>
						<th>{m.factDates()}</th>
						<th class="text-right">{m.factPhotos()}</th>
						<th>{m.manageOpenTasks()}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.events as event (event.id)}
						{@const href = resolve('/(studio)/manage/[eventId]', { eventId: event.id })}
						<tr class="hover:bg-base-200">
							<td class="w-24">
								{#if event.coverUrl}
									<img src={event.coverUrl} alt="" class="aspect-3/2 w-20 object-cover" />
								{:else}
									<div class="bg-base-200 aspect-3/2 w-20"></div>
								{/if}
							</td>
							<td>
								<a {href} class="font-bold hover:opacity-80">{event.name} {event.edition}</a>
								{#if event.visibility === 'HIDDEN'}
									<span class="badge badge-outline badge-sm ml-2 uppercase"
										>{m.visibilityHidden()}</span
									>
								{/if}
							</td>
							<td>{formatDateRange(event.dates)}</td>
							<td class="text-right">{formatNumber(event.photoCount)}</td>
							<td>
								{#if event.duplicateCount > 0}
									<a
										href={resolve('/(studio)/manage/[eventId]/duplicates', { eventId: event.id })}
										class="link link-primary"
									>
										{m.manageDuplicatesToCheck({ count: event.duplicateCount })}
									</a>
								{:else}
									<span class="text-base-content/50">–</span>
								{/if}
							</td>
							<td class="text-right whitespace-nowrap">
								<a {href} class="btn btn-sm btn-outline">{m.navManage()}</a>
								<a
									href={`${resolve('/(studio)/upload')}?event=${event.id}`}
									class="btn btn-sm btn-primary"
								>
									{m.navUpload()}
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
