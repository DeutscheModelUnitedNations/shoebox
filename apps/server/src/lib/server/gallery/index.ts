/**
 * Read side of the gallery for server load functions: loads from Postgres (load.ts) and
 * builds the view models (tree.ts).
 */
import type { CategoryPage, EventDetail, SeriesSummary } from '$lib/gallery/types';
import { loadSeries } from './load';
import { buildCategoryPage, buildEvent, buildSeries, buildSeriesList, type Viewer } from './tree';

export type { Viewer };

export async function listSeries(viewer: Viewer): Promise<SeriesSummary[]> {
	return buildSeriesList(await loadSeries(viewer), viewer);
}

export async function getSeries(slug: string, viewer: Viewer): Promise<SeriesSummary | undefined> {
	return buildSeries(await loadSeries(viewer, { series: slug }), slug, viewer);
}

/** The event plus the series' short name for the breadcrumb, from a single load. */
export async function getEvent(
	series: string,
	event: string,
	viewer: Viewer
): Promise<{ event: EventDetail; seriesShortName: string } | undefined> {
	const all = await loadSeries(viewer, { series, event });
	const detail = buildEvent(all, series, event, viewer);
	return detail && { event: detail, seriesShortName: all[0].shortName };
}

export async function getCategoryPage(
	series: string,
	event: string,
	path: string[],
	viewer: Viewer
): Promise<CategoryPage | undefined> {
	const all = await loadSeries(viewer, { series, event });
	return buildCategoryPage(all, series, event, path, viewer);
}
