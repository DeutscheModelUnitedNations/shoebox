<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- links are resolve() routes with a query parameter appended */
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { BlobReader, ZipReader } from '@zip.js/zip.js';
	import { commonRootFolder, isIgnoredZipEntry } from '@shoebox/shared';
	import { formatBytes, formatNumber } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import type { CategoryOption } from '$lib/studio/categories';
	import { toast } from '$lib/studio/toast.svelte';
	import { suggestMappings, summarizeFolders, type Mapping } from '$lib/studio/zipMapping';
	import { uploadArchive } from '$lib/studio/zipUpload';
	import ZipFolderTable from './ZipFolderTable.svelte';

	interface Props {
		events: { id: string; label: string }[];
		categories: Record<string, CategoryOption[]>;
		eventId: string;
		photographer: string;
		visibility: 'PUBLIC' | 'TEAM';
	}

	let { events, categories, eventId = $bindable(), photographer, visibility }: Props = $props();

	let file = $state<File | null>(null);
	let paths = $state<string[]>([]);
	let ignored = $state(0);
	let skipRoot = $state(true);
	let hideNew = $state(false);
	let mapping = $state<Record<string, Mapping>>({});
	let progress = $state<number | null>(null);
	let finishedBatch = $state<string | null>(null);
	let input = $state<HTMLInputElement>();

	const options = $derived(categories[eventId] ?? []);
	const root = $derived(commonRootFolder(paths));
	const rootToSkip = $derived(skipRoot ? root : null);
	const folders = $derived(summarizeFolders(paths, rootToSkip));
	const total = $derived(folders.reduce((sum, f) => sum + f.count, 0));
	const counts = $derived({
		existing: folders.filter((f) => mapping[f.key]?.match === 'exact').length,
		created: folders.filter((f) => mapping[f.key]?.target === 'NEW').length,
		merged: folders.filter((f) => f.tooDeep).length
	});

	// Re-suggest when the archive, the event or the root handling changes, keeping manual picks
	$effect(() => {
		const [f, o] = [folders, options];
		mapping = untrack(() => suggestMappings(f, o, mapping));
	});

	async function read(selected: File | undefined) {
		if (!selected) return;
		finishedBatch = null;
		const reader = new ZipReader(new BlobReader(selected));
		try {
			const entries = await reader.getEntries();
			const files = entries.filter((e) => !e.directory).map((e) => e.filename);
			paths = files.filter((f) => !isIgnoredZipEntry(f));
			ignored = files.length - paths.length;
			skipRoot = commonRootFolder(paths) !== null;
			mapping = {};
			file = selected;
		} catch {
			toast(m.zipUnreadable(), 'error');
		} finally {
			await reader.close();
		}
	}

	function choose(folderKey: string, target: string) {
		const folder = folders.find((f) => f.key === folderKey);
		const newName = target === 'NEW' ? (folder?.name ?? '') : '';
		mapping[folderKey] = { target, newName, match: 'manual' };
	}

	async function upload() {
		if (!file) return;
		progress = 0;
		const options = { eventId, folders, mapping, rootToSkip, visibility, photographer };
		try {
			finishedBatch = await uploadArchive(
				file,
				{ ...options, hideNewCategories: hideNew },
				(fraction) => (progress = fraction)
			);
			toast(m.zipQueued());
		} catch (error) {
			toast(error instanceof Error ? error.message : String(error), 'error', 8000);
		} finally {
			progress = null;
		}
	}
</script>

<label class="fieldset">
	<span class="fieldset-legend">{m.uploadEvent()}</span>
	<select class="select w-full" bind:value={eventId}>
		{#each events as event (event.id)}
			<option value={event.id}>{event.label}</option>
		{/each}
	</select>
</label>

<input
	bind:this={input}
	type="file"
	accept=".zip,application/zip"
	class="hidden"
	onchange={(e) => read(e.currentTarget.files?.[0])}
/>

{#if !file}
	<div
		class="bg-base-200 border-base-content/30 flex flex-col items-center gap-3 border border-dashed px-6 py-12 text-center"
	>
		<p class="text-xl font-bold">{m.zipChoose()}</p>
		<p class="text-base-content/70 text-sm">{m.zipAccepted()}</p>
		<button class="btn btn-outline" onclick={() => input?.click()}>{m.uploadChoose()}</button>
	</div>
{:else}
	<div class="bg-base-200 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
		<div>
			<p class="font-bold">{file.name}</p>
			<p class="text-base-content/70 text-sm">
				{formatBytes(file.size)} · {m.zipSummary({
					photos: formatNumber(total),
					folders: folders.filter((f) => f.key !== '').length
				})}
				{#if ignored > 0}· {m.zipIgnored({ count: ignored })}{/if}
			</p>
		</div>
		<button class="btn btn-link" onclick={() => input?.click()}>{m.zipOther()}</button>
	</div>

	<div class="flex flex-col">
		<div
			class="border-base-content flex flex-wrap items-baseline justify-between gap-2 border-b pb-3"
		>
			<h2 class="font-bold">{m.zipFoldersAndCategories()}</h2>
			<span class="text-base-content/70 text-sm">{m.zipCounts(counts)}</span>
		</div>
		<ZipFolderTable {folders} bind:mapping {options} onChoose={choose} />
		<p class="text-base-content/60 pt-3 text-sm leading-snug">{m.zipRules()}</p>
	</div>

	<div class="bg-base-200 flex flex-col gap-3 p-5">
		{#if root}
			<label class="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					class="checkbox checkbox-primary checkbox-sm mt-0.5"
					bind:checked={skipRoot}
				/>
				<span>{m.zipSkipRoot({ folder: root })}</span>
			</label>
		{/if}
		<label class="flex cursor-pointer items-start gap-3">
			<input
				type="checkbox"
				class="checkbox checkbox-primary checkbox-sm mt-0.5"
				bind:checked={hideNew}
			/>
			<span>{m.zipHideNew()}</span>
		</label>
		{#if progress !== null}
			<progress class="progress progress-primary w-full" value={progress} max="1"></progress>
		{/if}
		{#if finishedBatch}
			<div class="alert alert-success">
				<span>{m.zipQueued()}</span>
				<a
					class="btn btn-sm"
					href={`${resolve('/(studio)/manage/[eventId]', { eventId })}?batch=${encodeURIComponent(finishedBatch)}`}
				>
					{m.zipOpenImported()}
				</a>
			</div>
		{:else}
			<button
				class="btn btn-primary self-start"
				disabled={progress !== null || total === 0}
				onclick={upload}
			>
				{m.zipUpload({ count: formatNumber(total) })}
			</button>
		{/if}
		<p class="text-base-content/60 text-sm leading-snug">{m.zipServerNote()}</p>
	</div>
{/if}
