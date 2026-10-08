import type { PageServerLoad } from './$types';
import { listPeople } from '$lib/server/studio/pages';

export const load: PageServerLoad = async () => {
	return { people: await listPeople() };
};
