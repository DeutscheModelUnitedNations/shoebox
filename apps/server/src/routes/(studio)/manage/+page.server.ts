import type { PageServerLoad } from './$types';
import { listStudioEvents } from '$lib/server/studio/load';

export const load: PageServerLoad = async ({ locals }) => {
	return { events: await listStudioEvents(locals.roles) };
};
