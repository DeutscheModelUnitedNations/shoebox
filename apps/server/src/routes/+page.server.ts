import type { PageServerLoad } from './$types';
import { getHealth } from '$api/services/health';

export const load: PageServerLoad = async () => {
	return { health: await getHealth() };
};
