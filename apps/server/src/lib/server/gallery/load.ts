import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DerivativeResult } from '@shoebox/shared';
import { db, schema } from '$api/db';
import { buckets, presignDownload, publicDerivativeUrl } from '$api/services/storage';
import type { Photo } from '$lib/gallery/types';
import { assemble, toPhoto, type EventRow, type SeriesRow } from './assemble';
import type { RawSeries, Viewer } from './tree';

/** Presigned URLs for team-private derivatives outlive a long lightbox session. */
const PRIVATE_URL_TTL = 60 * 60;

function urlOf(derivative: DerivativeResult) {
	return derivative.public
		? publicDerivativeUrl(derivative.key)
		: presignDownload(buckets.originals, derivative.key, PRIVATE_URL_TTL);
}

function loadEvents(series: SeriesRow[], eventSlug?: string) {
	const conditions: SQL[] = [
		inArray(
			schema.event.seriesId,
			series.map((s) => s.id)
		)
	];
	if (eventSlug) conditions.push(eq(schema.event.slug, eventSlug));
	return db
		.select()
		.from(schema.event)
		.where(and(...conditions))
		.orderBy(desc(schema.event.dateFrom));
}

/** Categories and the READY media the viewer may see, team-private rows only for the team. */
async function loadContents(events: EventRow[], viewer: Viewer) {
	const eventIds = events.map((e) => e.id);
	if (eventIds.length === 0) return { categories: [], media: [] };
	const mediaConditions: SQL[] = [
		inArray(schema.media.eventId, eventIds),
		eq(schema.media.status, 'READY')
	];
	if (!viewer.isTeam) mediaConditions.push(eq(schema.media.visibility, 'PUBLIC'));
	const [categories, media] = await Promise.all([
		db
			.select()
			.from(schema.category)
			.where(inArray(schema.category.eventId, eventIds))
			.orderBy(asc(schema.category.sortOrder)),
		db
			.select()
			.from(schema.media)
			.where(and(...mediaConditions))
			.orderBy(asc(schema.media.sortOrder))
	]);
	return { categories, media };
}

/** Loads series with their events, category trees and the photos the viewer may see. */
export async function loadSeries(
	viewer: Viewer,
	filter: { series?: string; event?: string } = {}
): Promise<RawSeries[]> {
	const series = await db
		.select()
		.from(schema.series)
		.where(filter.series ? eq(schema.series.slug, filter.series) : undefined)
		.orderBy(asc(schema.series.sortOrder));
	if (series.length === 0) return [];

	const events = await loadEvents(series, filter.event);
	const { categories, media } = await loadContents(events, viewer);
	const photos = new Map<string, Photo>();
	await Promise.all(
		media.map(async (m) => {
			const photo = await toPhoto(m, urlOf);
			if (photo) photos.set(m.id, photo);
		})
	);
	return assemble({ series, events, categories, media, photos });
}
