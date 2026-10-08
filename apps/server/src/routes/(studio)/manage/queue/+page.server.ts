import type { PageServerLoad } from './$types';
import { loadQueue } from '$lib/server/studio/queue';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('studio:queue');
	return { queue: await loadQueue(locals.roles) };
};
