<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { mutate } from '$lib/api/mutate';
	import AdminHeading from '$lib/components/studio/AdminHeading.svelte';
	import SelectField from '$lib/components/studio/SelectField.svelte';
	import { m } from '$lib/paraglide/messages';
	import { attempt, toast } from '$lib/studio/toast.svelte';
	import type { DownloadSettings, WatermarkPolicy, WatermarkSettings } from '@shoebox/shared';

	let { data } = $props();

	let watermark = $state<WatermarkSettings>(untrack(() => structuredClone(data.watermark)));
	let downloads = $state<DownloadSettings>(untrack(() => structuredClone(data.downloads)));
	$effect(() => {
		watermark = structuredClone(data.watermark);
		downloads = structuredClone(data.downloads);
	});

	const positions: [WatermarkSettings['position'], string][] = [
		['bottom-right', m.settingsBottomRight()],
		['bottom-left', m.settingsBottomLeft()],
		['top-right', m.settingsTopRight()],
		['top-left', m.settingsTopLeft()],
		['center', m.settingsCenter()]
	];
	const sizes: [number, string][] = [
		[8, m.settingsSizeSmall({ percent: 8 })],
		[12, m.settingsSizeMedium({ percent: 12 })],
		[16, m.settingsSizeLarge({ percent: 16 })],
		[24, m.settingsSizeXLarge({ percent: 24 })]
	];
	const opacities: [number, string][] = [40, 60, 80, 100].map((v) => [v, `${v} %`]);
	const audiences = [
		['guests', m.settingsGuests()],
		['team', m.settingsTeam()]
	] as const;
	const policies: [WatermarkPolicy, () => string][] = [
		['ALWAYS', m.settingsPolicyAlways],
		['GUESTS', m.settingsPolicyGuests],
		['OPTIONAL', m.settingsPolicyOptional]
	];

	/** Mirrors the processor: the visible logo is `size` % of the width, the file adds clear space. */
	const overlay = $derived({
		width: `${watermark.size / 0.62}%`,
		opacity: watermark.opacity / 100,
		place: {
			'bottom-right': 'bottom-0 right-0',
			'bottom-left': 'bottom-0 left-0',
			'top-right': 'top-0 right-0',
			'top-left': 'top-0 left-0',
			center: 'top-1/2 left-1/2 -translate-1/2'
		}[watermark.position]
	});

	async function save() {
		const queued = await attempt(() =>
			mutate('saveRenderSettings', {
				...watermark,
				preview: downloads.preview,
				web: downloads.web,
				original: downloads.original
			})
		);
		if (queued === undefined) return;
		toast(queued > 0 ? m.settingsSavedRerender({ count: queued }) : m.adminSaved());
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{m.adminSettings()} · {m.navAdmin()} · {m.appName()}</title>
</svelte:head>

{#snippet sizeRow(label: string, key: 'preview' | 'web' | 'original')}
	<tr>
		<td class="font-bold">{label}</td>
		<td>
			{#if key === 'original'}
				{m.settingsUnchanged()}
			{:else}
				<label class="input input-sm w-32">
					<input
						type="number"
						min="320"
						max="6000"
						step="10"
						bind:value={downloads[key].longEdge}
					/>
					<span class="opacity-60">px</span>
				</label>
			{/if}
		</td>
		{#each audiences as [audience, audienceLabel] (audience)}
			<td>
				<input
					type="checkbox"
					class="checkbox checkbox-primary checkbox-sm"
					bind:checked={downloads[key][audience]}
					aria-label={`${label} · ${audienceLabel}`}
				/>
			</td>
		{/each}
		<td>
			<select class="select select-sm w-40" bind:value={downloads[key].watermark}>
				{#each policies as [value, text] (value)}
					<option {value}>{text()}</option>
				{/each}
			</select>
		</td>
	</tr>
{/snippet}

<div class="flex flex-col gap-10">
	<AdminHeading title={m.adminSettings()}>
		<button class="btn btn-primary" onclick={save}>{m.adminSave()}</button>
	</AdminHeading>

	<div class="grid gap-8 xl:grid-cols-[1fr_20rem]">
		<div class="bg-neutral relative overflow-hidden">
			{#if data.sampleUrl}
				<img src={data.sampleUrl} alt="" class="block w-full" />
				<div
					class={['absolute flex flex-col items-center', overlay.place]}
					style:width={overlay.width}
					style:opacity={overlay.opacity}
				>
					<img src="https://cdn.dmun.de/cdn/logos/dmun-lang-darkmode.svg" alt="" class="w-full" />
					{#if watermark.credit}
						<span class="-mt-[18%] text-[0.6rem] text-white">{m.settingsCreditSample()}</span>
					{/if}
				</div>
			{:else}
				<p class="text-neutral-content p-8">{m.settingsNoSample()}</p>
			{/if}
		</div>
		<div class="flex flex-col gap-4">
			<h2 class="text-primary text-2xl font-light">{m.settingsWatermark()}</h2>
			<SelectField
				legend={m.settingsPosition()}
				bind:value={watermark.position}
				options={positions}
			/>
			<SelectField legend={m.settingsSize()} bind:value={watermark.size} options={sizes} />
			<SelectField
				legend={m.settingsOpacity()}
				bind:value={watermark.opacity}
				options={opacities}
			/>
			<label class="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					class="checkbox checkbox-primary checkbox-sm mt-0.5"
					bind:checked={watermark.credit}
				/>
				<span>{m.settingsCredit()}</span>
			</label>
			<p class="text-base-content/60 text-sm leading-snug">{m.settingsWatermarkHint()}</p>
		</div>
	</div>

	<section class="flex flex-col gap-3">
		<h2 class="text-primary text-2xl font-light">{m.settingsDownloads()}</h2>
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="border-base-content">
						<th>{m.settingsSizeColumn()}</th>
						<th>{m.settingsLongEdge()}</th>
						<th>{m.settingsGuests()}</th>
						<th>{m.settingsTeam()}</th>
						<th>{m.settingsWatermark()}</th>
					</tr>
				</thead>
				<tbody>
					{@render sizeRow(m.settingsPreview(), 'preview')}
					{@render sizeRow(m.settingsWeb(), 'web')}
					{@render sizeRow(m.original(), 'original')}
				</tbody>
			</table>
		</div>
		<p class="text-base-content/60 text-sm leading-snug">{m.settingsDownloadsHint()}</p>
	</section>
</div>
