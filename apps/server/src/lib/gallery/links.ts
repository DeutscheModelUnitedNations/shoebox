import { resolve } from '$app/paths';
import type { EventSummary } from './types';

export function seriesHref(seriesSlug: string) {
	return resolve('/[series]', { series: seriesSlug });
}

export function eventHref(event: Pick<EventSummary, 'seriesSlug' | 'slug'>) {
	return resolve('/[series]/[event]', { series: event.seriesSlug, event: event.slug });
}

export function categoryHref(event: Pick<EventSummary, 'seriesSlug' | 'slug'>, path: string[]) {
	return resolve('/[series]/[event]/[...category]', {
		series: event.seriesSlug,
		event: event.slug,
		category: path.join('/')
	});
}

/** Lightbox state lives in `?photo=`, so every photo has a shareable URL. */
export function withPhoto(url: URL, photoId: string | null) {
	const next = new URL(url);
	if (photoId) next.searchParams.set('photo', photoId);
	else next.searchParams.delete('photo');
	return `${next.pathname}${next.search}`;
}
