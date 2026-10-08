import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSeries } from '$lib/server/gallery';
import { viewerOf } from '$lib/server/gallery/viewer';

export const load: PageServerLoad = async ({ params, locals }) => {
	const series = await getSeries(params.series, viewerOf(locals));
	if (!series) error(404, 'Not found');
	return { series };
};
