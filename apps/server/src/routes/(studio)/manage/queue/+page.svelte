<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import StudioHeading from '$lib/components/studio/StudioHeading.svelte';
	import { formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { formatElapsed, formatEta } from '$lib/studio/queue';
	import type { ProcessingJobType } from '@shoebox/shared';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import GearIcon from 'phosphor-svelte/lib/GearIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';

	let { data } = $props();
	const queue = $derived(data.queue);

	const REFRESH_MS = 5000;

	// Poll while the tab is visible, the queue moves on its own
	$effect(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidate('studio:queue');
		}, REFRESH_MS);
		return () => clearInterval(timer);
	});

	const typeLabel: Record<ProcessingJobType, () => string> = {
		PING: m.queueTypePING,
		IMAGE_DERIVATIVES: m.queueTypeIMAGE_DERIVATIVES,
		VIDEO_DERIVATIVES: m.queueTypeVIDEO_DERIVATIVES,
		ZIP_IMPORT: m.queueTypeZIP_IMPORT
	};

	const stateLabel = $derived(
		{
			idle: m.queueStateIdle(),
			working: m.queueStateWorking(),
			stalled: m.queueStateStalled()
		}[queue.state]
	);

	const eta = (seconds: number | null) =>
		seconds === null
			? m.queueEtaUnknown()
			: m.queueEta({ duration: formatEta(seconds, getLocale()) });
	const elapsed = (seconds: number) => formatElapsed(seconds, getLocale());
	const manageHref = (eventId: string) => resolve('/(studio)/manage/[eventId]', { eventId });
</script>

{#snippet eventCell(job: { event: { id: string; name: string } | null; otherEvent: boolean })}
	{#if job.event}
		<a href={manageHref(job.event.id)} class="link link-hover">{job.event.name}</a>
	{:else if job.otherEvent}
		<span class="text-base-content/50">{m.queueOtherEvent()}</span>
	{:else}
		–
	{/if}
{/snippet}

<svelte:head>
	<title>{m.queueTitle()} · {m.navManage()} · {m.appName()}</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 lg:px-12">
	<StudioHeading
		crumbs={[
			{ label: m.navManage(), href: resolve('/(studio)/manage') },
			{ label: m.queueTitle() }
		]}
		title={m.queueTitle()}
	>
		<p class="text-base-content/70 max-w-[66ch] leading-snug">
			{m.queueIntro()}
			{m.queueRefreshHint()}
		</p>
	</StudioHeading>

	<div class="bg-base-200 flex flex-col gap-2 p-6">
		<p class="flex items-center gap-3 text-2xl font-bold">
			{#if queue.state === 'idle'}
				<CheckCircleIcon size={32} weight="duotone" class="text-success" />
			{:else if queue.state === 'stalled'}
				<WarningIcon size={32} weight="duotone" class="text-error" />
			{:else}
				<GearIcon
					size={32}
					weight="duotone"
					class="text-primary animate-spin [animation-duration:3s]"
				/>
			{/if}
			{stateLabel}
		</p>
		{#if queue.state === 'stalled'}
			<p class="text-error">{m.queueStalledHint()}</p>
		{:else if queue.state === 'working'}
			<p>{eta(queue.etaSeconds)}</p>
			<p class="text-base-content/60 text-sm">{m.queueEtaNote()}</p>
		{:else}
			<p>{m.queueEmpty()}</p>
		{/if}
	</div>

	<div class="stats stats-vertical sm:stats-horizontal border-base-300 rounded-none border">
		<div class="stat">
			<div class="stat-title">{m.queueWaiting()}</div>
			<div class="stat-value font-light">{formatNumber(queue.ready)}</div>
			<div class="stat-desc">
				{Object.entries(queue.byType)
					.map(
						([type, count]) => `${typeLabel[type as ProcessingJobType]()} ${formatNumber(count)}`
					)
					.join(' · ')}
			</div>
		</div>
		<div class="stat">
			<div class="stat-title">{m.queueRunning()}</div>
			<div class="stat-value font-light">{formatNumber(queue.running)}</div>
		</div>
		<div class="stat">
			<div class="stat-title">{m.queueSpeed()}</div>
			<div class="stat-value font-light">
				{queue.perMinute === null ? '–' : formatNumber(Math.round(queue.perMinute * 10) / 10)}
			</div>
			<div class="stat-desc">
				{queue.perMinute === null ? m.queueSpeedUnknown() : m.queuePerMinute()}
			</div>
		</div>
		<div class="stat">
			<div class="stat-title">{m.queueRetrying()}</div>
			<div class="stat-value font-light">{formatNumber(queue.retrying)}</div>
		</div>
		<div class="stat">
			<div class="stat-title">{m.queueFailedRecently()}</div>
			<div class={['stat-value font-light', queue.failed > 0 && 'text-error']}>
				{formatNumber(queue.failed)}
			</div>
		</div>
	</div>

	{#if queue.events.length > 0}
		<div class="flex flex-col gap-3">
			<h2 class="text-primary text-xl font-bold">{m.queueYourEvents()}</h2>
			<ul class="flex flex-col">
				{#each queue.events as event (event.id)}
					<li
						class="border-base-300 flex flex-wrap items-baseline justify-between gap-2 border-b py-2"
					>
						<a href={manageHref(event.id)} class="link link-primary font-bold">{event.name}</a>
						<span class="text-base-content/70 text-sm">
							{m.queueTasks({ count: formatNumber(event.count) })} · {eta(event.etaSeconds)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if queue.jobs.length > 0}
		<div class="flex flex-col gap-3">
			<h2 class="text-primary text-xl font-bold">{m.queueNextInLine()}</h2>
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr class="border-base-content">
							<th class="text-right">#</th>
							<th>{m.queueTask()}</th>
							<th>{m.queueFile()}</th>
							<th>{m.queueConference()}</th>
							<th>{m.queueFor()}</th>
							<th class="text-right">{m.queueAttempt()}</th>
						</tr>
					</thead>
					<tbody>
						{#each queue.jobs as job (job.id)}
							<tr>
								<td class="text-right tabular-nums">{job.position}</td>
								<td class="whitespace-nowrap">
									{typeLabel[job.type]()}
									{#if job.running}
										<span class="badge badge-primary badge-sm ml-2 uppercase"
											>{m.queueRunning()}</span
										>
									{/if}
								</td>
								<td class="max-w-xs truncate">{job.filename ?? '–'}</td>
								<td>
									{@render eventCell(job)}
								</td>
								<td class="whitespace-nowrap tabular-nums">{elapsed(job.seconds)}</td>
								<td class="text-right tabular-nums">{job.attempts}/{job.maxAttempts}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if queue.more > 0}
				<p class="text-base-content/60 text-sm">
					{m.queueMore({ count: formatNumber(queue.more) })}
				</p>
			{/if}
		</div>
	{/if}

	{#if queue.failedJobs.length > 0}
		<div class="flex flex-col gap-3">
			<h2 class="text-primary text-xl font-bold">{m.queueRecentFailures()}</h2>
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr class="border-base-content">
							<th>{m.queueTask()}</th>
							<th>{m.queueFile()}</th>
							<th>{m.queueConference()}</th>
							<th>{m.queueError()}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each queue.failedJobs as job (job.id)}
							<tr>
								<td class="whitespace-nowrap">{typeLabel[job.type]()}</td>
								<td class="max-w-xs truncate">{job.filename ?? '–'}</td>
								<td>
									{@render eventCell(job)}
								</td>
								<td class="text-error max-w-md font-mono text-xs break-words">{job.error || '–'}</td
								>
								<td class="text-base-content/60 text-right text-sm whitespace-nowrap">
									{m.queueAgo({ duration: elapsed(job.seconds) })}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</section>
