import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCategoryPage } from '$lib/server/gallery';
import { viewerOf } from '$lib/server/gallery/viewer';

export const load: PageServerLoad = ({ params, locals }) => {
	const path = params.category.split('/').filter(Boolean);
	const category = getCategoryPage(params.series, params.event, path, viewerOf(locals));
	if (!category) error(404, 'Not found');
	return { category, path };
};
