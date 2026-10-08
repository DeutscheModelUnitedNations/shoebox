import type { PageServerLoad } from './$types';
import { listSeries } from '$lib/server/gallery';
import { viewerOf } from '$lib/server/gallery/viewer';

export const load: PageServerLoad = ({ locals }) => {
	return { series: listSeries(viewerOf(locals)) };
};
