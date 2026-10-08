import { getSetting } from '@shoebox/db';
import type { PageServerLoad } from './$types';
import { db } from '$api/db';

export const load: PageServerLoad = async () => {
	return { usage: await getSetting(db, 'usage') };
};
