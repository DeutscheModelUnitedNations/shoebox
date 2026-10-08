import type { PageServerLoad } from './$types';
import { listStudioEvents } from '$lib/server/studio/load';
import { categoryOptionsByEvent } from '$lib/server/studio/pages';
import { claimsName, pickEvent } from '$lib/studio/people';

export const load: PageServerLoad = async ({ locals, url }) => {
	const events = await listStudioEvents(locals.roles);
	return {
		events: events.map((e) => ({ id: e.id, label: `${e.name} ${e.edition}` })),
		categories: await categoryOptionsByEvent(events.map((e) => e.id)),
		selectedEvent: pickEvent(events, url.searchParams.get('event')),
		photographer: claimsName(locals.oidc?.user)
	};
};
