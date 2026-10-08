import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db, schema } from '$api/db';
import { loadCategories, loadEventRow, toStudioMedia } from '$lib/server/studio/load';
import {
	allPhotographers,
	eventPhotographers,
	hasPhotos,
	previousEvent
} from '$lib/server/studio/pages';

async function coverOf(mediaId: string | null) {
	if (!mediaId) return null;
	const [row] = await db.select().from(schema.media).where(eq(schema.media.id, mediaId));
	return row ? toStudioMedia(row) : null;
}

export const load: PageServerLoad = async ({ params }) => {
	const row = await loadEventRow(params.id);
	if (!row) error(404, 'Not found');
	const { event } = row;

	const [{ tree }, series, assigned, photographers, previous, cover, photos] = await Promise.all([
		loadCategories(event.id),
		db.select().from(schema.series).orderBy(asc(schema.series.sortOrder)),
		eventPhotographers(event.id),
		allPhotographers(),
		previousEvent(event),
		coverOf(event.coverMediaId),
		hasPhotos(event.id)
	]);

	return {
		event: {
			id: event.id,
			seriesId: event.seriesId,
			name: event.name,
			edition: event.edition,
			subtitle: event.subtitle,
			location: event.location,
			description: event.description,
			dateFrom: event.dateFrom,
			dateTo: event.dateTo ?? '',
			datePrecision: event.datePrecision,
			visibility: event.visibility,
			rights: event.rights
		},
		hasPhotos: photos,
		cover,
		series: series.map((s) => ({ id: s.id, name: s.name, shortName: s.shortName, kind: s.kind })),
		tree,
		assigned,
		photographers,
		previous
	};
};
