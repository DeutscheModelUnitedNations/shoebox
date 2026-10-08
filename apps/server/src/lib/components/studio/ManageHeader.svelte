<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- links are resolve() routes with a query parameter appended */
	import { resolve } from '$app/paths';
	import { eventHref } from '$lib/gallery/links';
	import { m } from '$lib/paraglide/messages';
	import StudioHeading from './StudioHeading.svelte';

	interface Props {
		event: { id: string; name: string; edition: string; slug: string; seriesSlug: string };
		stats: { total: number; categories: number; team: number; duplicates: number };
	}

	let { event, stats }: Props = $props();
</script>

<header class="border-base-300 border-b">
	<div class="flex flex-col gap-5 px-5 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-12">
		<StudioHeading
			crumbs={[
				{ label: m.navManage(), href: resolve('/(studio)/manage') },
				{ label: `${event.name} ${event.edition}` }
			]}
			title={event.name}
			emphasis={event.edition}
		>
			<p class="text-base-content/70 text-sm">
				{m.photoCount({ count: stats.total })} · {m.categoryCount({ count: stats.categories })}
				· {m.manageTeamOnlyCount({ count: stats.team })}
				{#if stats.duplicates > 0}
					·
					<a
						href={resolve('/(studio)/manage/[eventId]/duplicates', { eventId: event.id })}
						class="link link-primary"
					>
						{m.manageDuplicatesToCheck({ count: stats.duplicates })}
					</a>
				{/if}
			</p>
		</StudioHeading>
		<div class="flex flex-wrap gap-3">
			<a
				href={eventHref({ seriesSlug: event.seriesSlug, slug: event.slug })}
				class="btn btn-outline"
			>
				{m.manageViewInGallery()}
			</a>
			<a href={`${resolve('/(studio)/upload')}?event=${event.id}`} class="btn btn-primary">
				{m.uploadPhotos()}
			</a>
		</div>
	</div>
</header>
