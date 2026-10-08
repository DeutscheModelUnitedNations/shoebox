<script lang="ts">
	import { blurhash } from '$lib/blurhash';
	/* eslint-disable svelte/no-navigation-without-resolve -- every link is the current, already resolved page.url with ?photo= swapped */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatBytes, formatDate, formatNumber } from '$lib/gallery/format';
	import { withPhoto } from '$lib/gallery/links';
	import type { Photo } from '$lib/gallery/types';
	import { m } from '$lib/paraglide/messages';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import AccentStripe from './AccentStripe.svelte';
	import CopyLinkButton from './CopyLinkButton.svelte';
	import DownloadPanel from './DownloadPanel.svelte';

	interface Props {
		/** The photos the lightbox pages through, in display order */
		photos: Photo[];
		/** Breadcrumb above the title */
		crumbs: { label: string; href: string }[];
		rights: string;
		isTeam: boolean;
	}

	let { photos, crumbs, rights, isTeam }: Props = $props();

	const index = $derived(photos.findIndex((p) => p.id === page.url.searchParams.get('photo')));
	const current = $derived(photos[index] as Photo | undefined);
	const prevHref = $derived(index > 0 ? withPhoto(page.url, photos[index - 1].id) : undefined);
	const nextHref = $derived(
		index >= 0 && index < photos.length - 1 ? withPhoto(page.url, photos[index + 1].id) : undefined
	);
	const closeHref = $derived(withPhoto(page.url, null));
	const shareUrl = $derived(current ? `${page.url.origin}${withPhoto(page.url, current.id)}` : '');
	const original = $derived(current?.downloads.find((d) => d.variant === 'original'));

	$effect(() => {
		if (!current) return;
		document.documentElement.classList.add('overflow-hidden');
		return () => document.documentElement.classList.remove('overflow-hidden');
	});

	const keyTargets = $derived<Record<string, string | undefined>>({
		Escape: closeHref,
		ArrowLeft: prevHref,
		ArrowRight: nextHref
	});

	function onKeydown(event: KeyboardEvent) {
		const href = current && keyTargets[event.key];
		if (href) goto(href, { replaceState: event.key !== 'Escape', noScroll: true, keepFocus: true });
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet step(href: string | undefined, label: string, forward: boolean)}
	{#snippet content()}
		{#if forward}
			<span class="hidden sm:inline">{label}</span>
			<CaretRightIcon size={20} weight="duotone" />
		{:else}
			<CaretLeftIcon size={20} weight="duotone" />
			<span class="hidden sm:inline">{label}</span>
		{/if}
	{/snippet}
	<!-- Always rendered, disabled at either end of the series -->
	{#if href}
		<a {href} class="btn" aria-label={label} data-sveltekit-replacestate data-sveltekit-noscroll>
			{@render content()}
		</a>
	{:else}
		<button class="btn" aria-label={label} disabled>{@render content()}</button>
	{/if}
{/snippet}

{#if current}
	<div class="modal modal-open" role="dialog" aria-modal="true" aria-label={current.title}>
		<div
			class="modal-box grid h-dvh max-h-none w-full max-w-none grid-cols-1 content-start rounded-none p-0 lg:grid-cols-[1fr_24rem] lg:content-stretch lg:overflow-hidden"
		>
			<!-- The stage stays dark in both themes, so it carries the dark theme itself -->
			<section
				data-theme="dark"
				class="bg-base-100 text-base-content flex min-w-0 flex-col lg:min-h-0"
			>
				<div class="flex items-center justify-between px-5 py-4 lg:px-8 lg:py-5">
					<a href={closeHref} class="btn btn-sm" data-sveltekit-noscroll>
						<XIcon size={20} weight="duotone" />
						{m.close()}
					</a>
					<span class="text-sm">{index + 1} / {photos.length}</span>
				</div>

				<div class="flex min-h-0 flex-1 items-center justify-center px-5 py-2 lg:px-8 lg:py-0">
					{#key current.id}
						<img
							src={current.url}
							{@attach blurhash(current.blurhash, current)}
							alt={current.alt}
							width={current.width}
							height={current.height}
							class="max-h-[70dvh] max-w-full object-contain lg:max-h-full"
						/>
					{/key}
				</div>

				<div class="flex items-center justify-between gap-4 px-5 py-4 lg:px-8 lg:py-5">
					{@render step(prevHref, m.previous(), false)}
					<AccentStripe onDark class="w-30" />
					{@render step(nextHref, m.next(), true)}
				</div>
			</section>

			<aside
				class="bg-base-100 border-base-300 flex flex-col gap-6 p-6 lg:overflow-y-auto lg:border-l lg:p-8"
			>
				<div class="flex flex-col gap-2.5">
					<div class="breadcrumbs text-base-content/60 py-0 text-sm">
						<ul>
							{#each crumbs as crumb (crumb.label)}
								<li><a href={crumb.href}>{crumb.label}</a></li>
							{/each}
						</ul>
					</div>
					<h2 class="text-xl leading-tight font-bold">{current.title}</h2>
				</div>

				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm leading-snug">
					<dt class="text-base-content/60">{m.photographer()}</dt>
					<dd>{current.photographer}</dd>
					<dt class="text-base-content/60">{m.date()}</dt>
					<dd>{formatDate(current.takenAt)}</dd>
					{#if original}
						<dt class="text-base-content/60">{m.original()}</dt>
						<dd>
							{m.originalValue({
								width: formatNumber(original.width),
								height: formatNumber(original.height),
								size: formatBytes(original.bytes),
								format: current.mimeType.split('/')[1].toUpperCase()
							})}
						</dd>
					{/if}
					<dt class="text-base-content/60">{m.rights()}</dt>
					<dd>{rights}</dd>
				</dl>

				<div class="bg-base-200 flex gap-4 p-4">
					<AccentStripe vertical />
					<p class="text-sm leading-snug">
						{m.copyrightNotice()}
						<strong>{m.copyrightCredit({ photographer: current.photographer })}</strong>
						{m.copyrightAccept()}
					</p>
				</div>

				<DownloadPanel photo={current} {isTeam} />

				<section class="border-base-content flex flex-col gap-2.5 border-t pt-5">
					<h3 class="leading-none font-bold">{m.share()}</h3>
					<div class="join w-full">
						<input
							type="text"
							readonly
							value={shareUrl}
							class="input join-item text-base-content/60 min-w-0 flex-1"
							aria-label={m.share()}
							onfocus={(e) => e.currentTarget.select()}
						/>
						<CopyLinkButton url={shareUrl} label={m.copyLink()} class="btn btn-neutral join-item" />
					</div>
				</section>
			</aside>
		</div>
	</div>
{/if}
