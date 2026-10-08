import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEvent, getSeries } from '$lib/server/gallery';
import { viewerOf } from '$lib/server/gallery/viewer';

export const load: PageServerLoad = ({ params, locals }) => {
	const viewer = viewerOf(locals);
	const series = getSeries(params.series, viewer);
	const event = getEvent(params.series, params.event, viewer);
	if (!series || !event) error(404, 'Not found');
	return { series: { slug: series.slug, shortName: series.shortName }, event };
};
