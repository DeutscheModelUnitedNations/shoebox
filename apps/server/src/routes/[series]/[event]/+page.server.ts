import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEvent } from '$lib/server/gallery';
import { viewerOf } from '$lib/server/gallery/viewer';

export const load: PageServerLoad = async ({ params, locals }) => {
	const found = await getEvent(params.series, params.event, viewerOf(locals));
	if (!found) error(404, 'Not found');
	return {
		series: { slug: params.series, shortName: found.seriesShortName },
		event: found.event
	};
};
