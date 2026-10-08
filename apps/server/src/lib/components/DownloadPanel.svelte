<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatBytes, formatNumber } from '$lib/gallery/format';
	import type { Download, DownloadVariant, Photo } from '$lib/gallery/types';
	import { m } from '$lib/paraglide/messages';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import LockSimpleIcon from 'phosphor-svelte/lib/LockSimpleIcon';

	let { photo, isTeam }: { photo: Photo; isTeam: boolean } = $props();

	let selected = $state<DownloadVariant>('large');
	let noWatermark = $state(false);

	const available = $derived(photo.downloads.filter((d) => (isTeam ? d.team : d.guests)));
	// Sizes only the team may fetch are shown locked to guests, as an invitation to sign in
	const locked = $derived(photo.downloads.filter((d) => !isTeam && d.team && !d.guests));
	const chosen = $derived(
		available.find((d) => d.variant === selected) ??
			available.find((d) => d.variant === 'large') ??
			available[0]
	);
	/** Team members choose when the size allows it, GUESTS sizes come clean for them anyway. */
	const canChooseClean = $derived(isTeam && chosen?.watermark === 'OPTIONAL');
	const clean = $derived(
		isTeam && (chosen?.watermark === 'GUESTS' || (canChooseClean && noWatermark))
	);
	const href = $derived(chosen && `${chosen.href}${clean ? '&clean=1' : ''}`);

	const variantLabels = {
		medium: m.variantMedium,
		large: m.variantLarge,
		original: m.variantOriginal
	} satisfies Record<DownloadVariant, unknown>;
	const buttonLabels = {
		medium: m.downloadMedium,
		large: m.downloadLarge,
		original: m.downloadOriginal
	} satisfies Record<DownloadVariant, unknown>;

	const variantLabel = (d: Download) =>
		variantLabels[d.variant]({ width: formatNumber(Math.max(d.width, d.height)) });
	const buttonLabel = (d: Download) => {
		const label = buttonLabels[d.variant]({ size: formatBytes(d.bytes) });
		return clean ? `${label} · ${m.withoutWatermark()}` : label;
	};
</script>

<section class="border-base-content flex flex-col gap-3 border-t pt-5">
	<div class="flex items-baseline justify-between">
		<h3 class="leading-none font-bold">{m.download()}</h3>
		{#if isTeam}
			<span class="badge badge-neutral badge-sm uppercase">{m.teamMember()}</span>
		{/if}
	</div>

	<div class="flex flex-col">
		{#each available as download (download.variant)}
			<label
				class="border-base-300 flex cursor-pointer items-center justify-between gap-3 border-b py-2.5 text-sm"
			>
				<span class="flex items-center gap-3">
					<input
						type="radio"
						name="download-variant"
						class="radio radio-primary radio-sm"
						value={download.variant}
						bind:group={selected}
					/>
					{variantLabel(download)}
				</span>
				<span class="text-base-content/60">{formatBytes(download.bytes)}</span>
			</label>
		{/each}
		{#each locked as download (download.variant)}
			<div
				class="border-base-300 text-base-content/60 flex cursor-help items-center justify-between gap-3 border-b py-2.5 text-sm"
				title={m.lockedHint()}
			>
				<span class="flex items-center gap-3">
					<LockSimpleIcon size={18} weight="duotone" />
					{variantLabel(download)}
				</span>
				<span class="badge badge-ghost badge-sm uppercase">{m.locked()}</span>
			</div>
		{/each}
		{#if canChooseClean}
			<label class="flex cursor-pointer items-center gap-3 pt-3 text-sm">
				<input
					type="checkbox"
					class="checkbox checkbox-primary checkbox-sm"
					bind:checked={noWatermark}
				/>
				{m.withoutWatermark()}
			</label>
		{/if}
	</div>

	{#if chosen}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a file download, not a route -->
		<a {href} download class="btn btn-primary btn-block">
			<DownloadSimpleIcon size={20} weight="duotone" />
			{buttonLabel(chosen)}
		</a>
	{/if}

	{#if !isTeam}
		<p class="text-base-content/60 text-sm leading-snug">
			{m.guestNote()}
			<a href={resolve('/login')} class="link link-primary" data-sveltekit-reload>
				{m.guestNoteLogin()}
			</a>
		</p>
	{/if}
</section>
