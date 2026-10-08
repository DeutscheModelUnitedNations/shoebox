import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db, schema } from '$api/db';
import { configPrivate } from '$config/private';
import { listStudioEvents } from '$lib/server/studio/load';

export const load: PageServerLoad = async ({ locals }) => {
	const [events, series] = await Promise.all([
		listStudioEvents(locals.roles),
		db.select().from(schema.series).orderBy(asc(schema.series.sortOrder))
	]);
	const storage = series.map((s) => ({
		id: s.id,
		shortName: s.shortName,
		bytes: events.filter((e) => e.seriesId === s.id).reduce((sum, e) => sum + e.storageBytes, 0)
	}));
	return {
		events,
		series: series.map((s) => ({
			id: s.id,
			name: s.name,
			shortName: s.shortName,
			region: s.region,
			kind: s.kind,
			events: events.filter((e) => e.seriesId === s.id).length
		})),
		storage,
		capacityBytes: configPrivate.STORAGE_CAPACITY_GB
			? configPrivate.STORAGE_CAPACITY_GB * 1_000_000_000
			: null
	};
};
