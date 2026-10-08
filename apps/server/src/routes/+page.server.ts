import type { PageServerLoad } from './$types';
import { listSeries } from '$lib/server/gallery';
import { viewerOf } from '$lib/server/gallery/viewer';

export const load: PageServerLoad = async ({ locals }) => {
	return { series: await listSeries(viewerOf(locals)) };
};
