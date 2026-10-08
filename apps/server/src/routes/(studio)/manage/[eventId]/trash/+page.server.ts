import type { PageServerLoad } from './$types';
import { loadTrash } from '$lib/server/studio/load';

export const load: PageServerLoad = async ({ params }) => {
	return { media: await loadTrash(params.eventId) };
};
