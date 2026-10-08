<script lang="ts">
	import BlurImage from '$lib/components/BlurImage.svelte';
	import { invalidateAll } from '$app/navigation';
	import { mutate } from '$lib/api/mutate';
	import { formatDate } from '$lib/gallery/format';
	import StudioHeading from '$lib/components/studio/StudioHeading.svelte';
	import { m } from '$lib/paraglide/messages';
	import { eventPageCrumbs } from '$lib/studio/crumbs';
	import { attempt } from '$lib/studio/toast.svelte';

	let { data } = $props();

	let selected = $state<string[]>([]);
	let confirmDelete = $state(false);

	/** Purged automatically 30 days after deletion. */
	function purgeDate(deletedAt: string) {
		return formatDate(new Date(new Date(deletedAt).getTime() + 30 * 864e5).toISOString());
	}

	async function restore() {
		const count = selected.length;
		await attempt(
			() => mutate('restoreMedia', { eventId: data.event.id, mediaIds: selected }),
			m.trashRestored({ count })
		);
		selected = [];
		await invalidateAll();
	}

	async function remove() {
		confirmDelete = false;
		const count = selected.length;
		await attempt(
			() => mutate('deleteMediaForever', { eventId: data.event.id, mediaIds: selected }),
			m.trashDeleted({ count })
		);
		selected = [];
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{m.manageTrash()} · {data.event.name} {data.event.edition} · {m.appName()}</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 lg:px-12">
	<StudioHeading crumbs={eventPageCrumbs(data.event, m.manageTrash())} title={m.manageTrash()}>
		<p class="text-base-content/70 max-w-[66ch] leading-snug">{m.trashIntro()}</p>
	</StudioHeading>

	{#if data.media.length === 0}
		<div class="bg-base-200 p-6">{m.trashEmpty()}</div>
	{:else}
		<div class="border-base-content flex flex-wrap items-center gap-3 border-b pb-4">
			<span class="font-bold">{m.manageSelected({ count: selected.length })}</span>
			<button class="btn btn-outline btn-sm" disabled={selected.length === 0} onclick={restore}>
				{m.trashRestore()}
			</button>
			<button
				class="btn btn-outline btn-sm"
				disabled={selected.length === 0}
				onclick={() => (confirmDelete = true)}
			>
				{m.trashDeleteForever()}
			</button>
			<button
				class="btn btn-link btn-sm ml-auto"
				onclick={() =>
					(selected = selected.length === data.media.length ? [] : data.media.map((x) => x.id))}
			>
				{selected.length === data.media.length ? m.manageClearSelection() : m.trashSelectAll()}
			</button>
		</div>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
			{#each data.media as media (media.id)}
				<label class="flex cursor-pointer flex-col gap-2">
					<div class="bg-base-200 relative aspect-square overflow-hidden">
						{#if media.thumbUrl}
							<BlurImage
								src={media.thumbUrl}
								placeholder={media.placeholder}
								alt={media.title}
								class="size-full object-cover"
								wrapperClass="size-full opacity-70"
							/>
						{/if}
						<input
							type="checkbox"
							class="checkbox checkbox-primary checkbox-sm not-checked:bg-base-100 absolute top-2 left-2"
							value={media.id}
							bind:group={selected}
						/>
					</div>
					<span class="text-base-content/60 text-xs">
						{m.trashPurgedOn({ date: purgeDate(media.deletedAt!) })}
					</span>
				</label>
			{/each}
		</div>
	{/if}
</section>

{#if confirmDelete}
	<div class="modal modal-open" role="dialog" aria-modal="true">
		<div class="modal-box flex flex-col gap-4">
			<h3 class="text-lg font-bold">{m.trashConfirmTitle({ count: selected.length })}</h3>
			<p>{m.trashConfirmText()}</p>
			<div class="modal-action">
				<button class="btn btn-outline" onclick={() => (confirmDelete = false)}>{m.cancel()}</button
				>
				<button class="btn btn-error" onclick={remove}>{m.trashDeleteForever()}</button>
			</div>
		</div>
		<button class="modal-backdrop" onclick={() => (confirmDelete = false)} aria-label={m.close()}
		></button>
	</div>
{/if}
