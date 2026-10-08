import type { PageServerLoad } from './$types';
import { loadCategories, loadStudioMedia } from '$lib/server/studio/load';
import { filterFromUrl, manageStats } from '$lib/server/studio/pages';

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { event } = await parent();
	const { tree, uncategorized } = await loadCategories(params.eventId);
	const sort: 'custom' | 'taken' = url.searchParams.get('sort') === 'taken' ? 'taken' : 'custom';
	const [media, stats] = await Promise.all([
		loadStudioMedia(event, filterFromUrl(url, tree), sort),
		manageStats(params.eventId)
	]);
	return {
		tree,
		uncategorized,
		media,
		filter: {
			category: url.searchParams.get('category'),
			batch: url.searchParams.get('batch'),
			sort
		},
		stats: {
			...stats,
			total: tree.reduce((sum, c) => sum + c.count, 0) + uncategorized,
			categories: tree.length
		}
	};
};
