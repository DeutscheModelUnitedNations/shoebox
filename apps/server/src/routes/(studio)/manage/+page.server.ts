import type { PageServerLoad } from './$types';
import { listStudioEvents } from '$lib/server/studio/load';
import { loadQueue } from '$lib/server/studio/queue';

export const load: PageServerLoad = async ({ locals }) => {
	const [events, queue] = await Promise.all([
		listStudioEvents(locals.roles),
		loadQueue(locals.roles)
	]);
	return {
		events,
		queue: { state: queue.state, count: queue.ready + queue.running, etaSeconds: queue.etaSeconds }
	};
};
