import type { PageServerLoad } from './$types';
import { loadDuplicatePairs } from '$lib/server/studio/load';

export const load: PageServerLoad = async ({ params }) => {
	return { pairs: await loadDuplicatePairs(params.eventId) };
};
