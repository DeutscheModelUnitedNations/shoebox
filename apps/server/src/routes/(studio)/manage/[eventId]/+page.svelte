<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { mutate } from '$lib/api/mutate';
	import BulkBar from '$lib/components/studio/BulkBar.svelte';
	import CategoryNav from '$lib/components/studio/CategoryNav.svelte';
	import EditPanel from '$lib/components/studio/EditPanel.svelte';
	import ManageHeader from '$lib/components/studio/ManageHeader.svelte';
	import MediaTile from '$lib/components/studio/MediaTile.svelte';
	import PreviewModal from '$lib/components/studio/PreviewModal.svelte';
	import ViewBar from '$lib/components/studio/ViewBar.svelte';
	import { m } from '$lib/paraglide/messages';
	import { categoryTitle, flattenCategories } from '$lib/studio/categories';
	import type { editInput } from '$lib/studio/editForm';
	import { runAndReload } from '$lib/studio/toast.svelte';
	import type { StudioMedia } from '$lib/studio/types';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';

	let { data } = $props();

	const event = $derived(data.event);
	const categories = $derived(flattenCategories(data.tree));
	const active = $derived(data.filter.batch ? null : data.filter.category);

	// ── Filter and order ────────────────────────────────────────────────────────────────

	function withParams(params: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === null) url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		return `${url.pathname}${url.search}`;
	}

	const categoryHref = (category: string | null) => withParams({ category, batch: null });

	const fixedHeadings: Record<string, () => string> = {
		'': m.manageAllPhotos,
		none: m.manageNoCategory
	};

	const heading = $derived(
		data.filter.batch
			? m.manageThisUpload()
			: (fixedHeadings[data.filter.category ?? '']?.() ??
					categoryTitle(data.tree, data.filter.category!))
	);

	// ── Selection ────────────────────────────────────────────────────────────────────────

	let selected = $state<string[]>([]);
	let anchor = $state<number | null>(null);
	let preview = $state<StudioMedia | null>(null);

	// Photos that left the view drop out of the selection
	$effect(() => {
		const ids = new Set(data.media.map((media) => media.id));
		untrack(() => {
			if (selected.some((id) => !ids.has(id))) selected = selected.filter((id) => ids.has(id));
		});
	});

	const selection = $derived(data.media.filter((media) => selected.includes(media.id)));

	function toggle(index: number, shiftKey: boolean) {
		const id = data.media[index].id;
		if (shiftKey && anchor !== null) {
			const [from, to] = [Math.min(anchor, index), Math.max(anchor, index)];
			const range = data.media.slice(from, to + 1).map((media) => media.id);
			selected = [...new Set([...selected, ...range])];
			return;
		}
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
		anchor = index;
	}

	function clearSelection() {
		selected = [];
		anchor = null;
	}

	// ── Drag and drop ────────────────────────────────────────────────────────────────────

	const canReorder = $derived(data.filter.sort === 'custom' && !data.filter.batch);
	let dragged = $state<string[]>([]);
	let dropBefore = $state<string | null>(null);

	function dragStart(media: StudioMedia, e: DragEvent) {
		dragged = selected.includes(media.id) ? [...selected] : [media.id];
		e.dataTransfer?.setData('text/plain', dragged.join(','));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function dragEnd() {
		dragged = [];
		dropBefore = null;
	}

	async function dropOnTile(target: StudioMedia) {
		const moving = dragged;
		dragEnd();
		if (!canReorder || moving.includes(target.id)) return;
		const rest = data.media.map((media) => media.id).filter((id) => !moving.includes(id));
		rest.splice(rest.indexOf(target.id), 0, ...moving);
		await runAndReload(
			() => mutate('reorderMedia', { eventId: event.id, orderedIds: rest }),
			m.manageOrderSaved()
		);
	}

	async function moveTo(categoryId: string | null, ids = dragged.length ? dragged : selected) {
		dragEnd();
		if (ids.length === 0) return;
		await runAndReload(
			() =>
				mutate('updateMedia', { eventId: event.id, mediaIds: ids, moveCategory: true, categoryId }),
			m.manageMoved({ count: ids.length })
		);
	}

	// ── Bulk actions and edit panel ──────────────────────────────────────────────────────

	const setVisibility = (visibility: 'PUBLIC' | 'TEAM') =>
		runAndReload(
			() => mutate('updateMedia', { eventId: event.id, mediaIds: selected, visibility }),
			m.manageSaved()
		);

	async function trash() {
		const ids = selected;
		clearSelection();
		await runAndReload(
			() => mutate('trashMedia', { eventId: event.id, mediaIds: ids }),
			m.manageTrashed({ count: ids.length })
		);
	}

	const applyEdits = (input: ReturnType<typeof editInput>) =>
		runAndReload(() => mutate('updateMedia', { eventId: event.id, ...input }), m.manageSaved());

	const setCover = () =>
		runAndReload(
			() => mutate('setEventCover', { eventId: event.id, mediaId: selected[0] }),
			m.manageCoverSet()
		);

	function escape(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (preview) preview = null;
		else clearSelection();
	}
</script>

<svelte:head>
	<title>{event.name} {event.edition} · {m.navManage()} · {m.appName()}</title>
</svelte:head>

<svelte:window onkeydown={escape} />

<ManageHeader {event} stats={data.stats} />

<div class="grid flex-1 lg:grid-cols-[16rem_1fr_22rem]">
	<aside class="border-base-300 flex flex-col gap-6 border-r px-5 py-8 lg:px-8">
		<CategoryNav
			tree={data.tree}
			total={data.stats.total}
			uncategorized={data.uncategorized}
			{active}
			href={categoryHref}
			dragging={dragged.length > 0}
			onDrop={(categoryId) => moveTo(categoryId)}
		/>
		<p class="text-base-content/60 text-sm leading-snug">{m.manageDragHint()}</p>
		<a
			href={resolve('/(studio)/manage/[eventId]/trash', { eventId: event.id })}
			class="link link-hover text-base-content/70 flex items-center gap-2 text-sm"
		>
			<TrashIcon size={18} weight="duotone" />
			{m.manageTrash()} ({data.stats.trash})
		</a>
	</aside>

	<section class="flex min-w-0 flex-col gap-5 px-5 py-8 lg:px-8">
		{#if selected.length > 0}
			<BulkBar
				count={selected.length}
				{categories}
				onMove={(categoryId) => moveTo(categoryId, selected)}
				onVisibility={setVisibility}
				onTrash={trash}
				onClear={clearSelection}
			/>
		{/if}

		<ViewBar
			{heading}
			count={data.media.length}
			{canReorder}
			sort={data.filter.sort}
			sortHref={(sort) => withParams({ sort: sort === 'taken' ? 'taken' : null })}
		/>

		{#if data.media.length === 0}
			<div class="bg-base-200 p-8 text-center">
				<p class="text-base-content/70">{m.manageEmpty()}</p>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
				{#each data.media as media, index (media.id)}
					<MediaTile
						{media}
						selected={selected.includes(media.id)}
						dropBefore={dropBefore === media.id}
						dragged={dragged.includes(media.id)}
						onToggle={(shiftKey) => toggle(index, shiftKey)}
						onPreview={() => (preview = media)}
						onDragStart={(e) => dragStart(media, e)}
						onDragEnd={dragEnd}
						onDragOver={canReorder ? () => (dropBefore = media.id) : undefined}
						onDragLeave={() => dropBefore === media.id && (dropBefore = null)}
						onDrop={() => dropOnTile(media)}
					/>
				{/each}
			</div>
			<p class="text-base-content/60 text-sm leading-snug">{m.manageGridHint()}</p>
		{/if}
	</section>

	<EditPanel {selection} {categories} onApply={applyEdits} onSetCover={setCover} />
</div>

{#if preview}
	<PreviewModal media={preview} onClose={() => (preview = null)} />
{/if}
