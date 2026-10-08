import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { canManage } from '$api/services/roles';
import { loadEventRow } from '$lib/server/studio/load';

/** Every page below needs the event and the right to manage it. */
export const load: LayoutServerLoad = async ({ params, locals }) => {
	if (!canManage(locals.roles, params.eventId)) error(403, 'Forbidden');
	const row = await loadEventRow(params.eventId);
	if (!row) error(404, 'Not found');
	return {
		event: {
			id: row.event.id,
			slug: row.event.slug,
			name: row.event.name,
			edition: row.event.edition,
			visibility: row.event.visibility,
			coverMediaId: row.event.coverMediaId,
			seriesSlug: row.series.slug
		}
	};
};
