/**
 * Read side of the gallery for server load functions. Backed by demo data for now, the
 * signatures are what the database implementation will keep.
 */
import type {
	CategoryNode,
	CategoryPage,
	EventDetail,
	EventSummary,
	Photo,
	SeriesSummary
} from '$lib/gallery/types';
import { demoSeries, type DemoCategory, type DemoEvent, type DemoSeries } from './demo';

export interface Viewer {
	/** Team members also see team-private photos */
	isTeam: boolean;
}

function canSee(photo: Photo | undefined, viewer: Viewer): photo is Photo {
	return !!photo && (viewer.isTeam || photo.visibility === 'PUBLIC');
}

function photosOf(category: DemoCategory, viewer: Viewer): Photo[] {
	return [
		...category.photos.filter((p) => canSee(p, viewer)),
		...category.children.flatMap((c) => photosOf(c, viewer))
	];
}

/** Drops categories without a single visible photo. */
function toNode(category: DemoCategory, viewer: Viewer): CategoryNode | null {
	const photoCount = photosOf(category, viewer).length;
	if (photoCount === 0) return null;
	return {
		slug: category.slug,
		name: category.name,
		photoCount,
		cover: canSee(category.cover, viewer) ? category.cover : undefined,
		children: category.children.map((c) => toNode(c, viewer)).filter((c) => c !== null)
	};
}

function summarize(series: DemoSeries, event: DemoEvent, viewer: Viewer): EventSummary {
	const categories = event.categories.map((c) => toNode(c, viewer)).filter((c) => c !== null);
	return {
		seriesSlug: series.slug,
		slug: event.slug,
		name: event.name,
		edition: event.edition,
		dates: event.dates,
		photoCount: categories.reduce((sum, c) => sum + c.photoCount, 0),
		categoryCount: categories.length,
		cover: canSee(event.cover, viewer) ? event.cover : undefined
	};
}

function seriesSummary(series: DemoSeries, viewer: Viewer): SeriesSummary {
	return {
		slug: series.slug,
		name: series.name,
		shortName: series.shortName,
		region: series.region,
		kind: series.kind,
		events: series.events.map((e) => summarize(series, e, viewer))
	};
}

function findEvent(seriesSlug: string, eventSlug: string) {
	const series = demoSeries.find((s) => s.slug === seriesSlug);
	const event = series?.events.find((e) => e.slug === eventSlug);
	return series && event ? { series, event } : undefined;
}

export function listSeries(viewer: Viewer): SeriesSummary[] {
	return demoSeries.map((s) => seriesSummary(s, viewer));
}

export function getSeries(slug: string, viewer: Viewer): SeriesSummary | undefined {
	const series = demoSeries.find((s) => s.slug === slug);
	return series && seriesSummary(series, viewer);
}

export function getEvent(
	seriesSlug: string,
	eventSlug: string,
	viewer: Viewer
): EventDetail | undefined {
	const found = findEvent(seriesSlug, eventSlug);
	if (!found) return undefined;
	const { series, event } = found;
	return {
		...summarize(series, event, viewer),
		subtitle: event.subtitle,
		location: event.location,
		description: event.description,
		photographers: event.photographers,
		rights: event.rights,
		hero: canSee(event.hero, viewer) ? event.hero : undefined,
		highlights: event.highlights.filter((p) => canSee(p, viewer)),
		categories: event.categories.map((c) => toNode(c, viewer)).filter((c) => c !== null)
	};
}

/** The categories along `path`, root first, or undefined if a slug does not exist. */
function walk(categories: DemoCategory[], path: string[]): DemoCategory[] | undefined {
	if (path.length === 0) return undefined;
	const trail: DemoCategory[] = [];
	let level = categories;
	for (const slug of path) {
		const next = level.find((c) => c.slug === slug);
		if (!next) return undefined;
		trail.push(next);
		level = next.children;
	}
	return trail;
}

export function getCategoryPage(
	seriesSlug: string,
	eventSlug: string,
	path: string[],
	viewer: Viewer
): CategoryPage | undefined {
	const found = findEvent(seriesSlug, eventSlug);
	if (!found) return undefined;

	const raw = walk(found.event.categories, path);
	const trail = raw?.map((c) => toNode(c, viewer));
	if (!raw || !trail || trail.some((c) => c === null)) return undefined;
	const nodes = trail as CategoryNode[];

	return {
		event: summarize(found.series, found.event, viewer),
		root: nodes[0],
		trail: nodes,
		photos: photosOf(raw[raw.length - 1], viewer),
		photographers: found.event.photographers,
		rights: found.event.rights
	};
}
