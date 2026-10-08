/**
 * Builds the gallery view models from loaded series. Pure, so the counting, visibility and
 * path rules are testable without a database (see load.ts for the data access).
 */
import type {
	CategoryNode,
	CategoryPage,
	EventDetail,
	EventSummary,
	Photo,
	SeriesSummary
} from '$lib/gallery/types';

export interface RawCategory {
	slug: string;
	name: string;
	cover?: Photo;
	photos: Photo[];
	children: RawCategory[];
}

export interface RawEvent {
	slug: string;
	name: string;
	edition: string;
	subtitle: string;
	location: string;
	description: string;
	dates: EventSummary['dates'];
	photographers: string[];
	rights: string;
	cover?: Photo;
	hero?: Photo;
	highlights: Photo[];
	categories: RawCategory[];
}

export interface RawSeries {
	slug: string;
	name: string;
	shortName: string;
	region: string;
	kind: SeriesSummary['kind'];
	events: RawEvent[];
}

export interface Viewer {
	/** Team members also see team-private photos */
	isTeam: boolean;
	/** Admins also see hidden events and categories */
	isAdmin?: boolean;
	/** Events the viewer manages, their hidden parts are visible too */
	eventIds?: string[];
}

function canSee(photo: Photo | undefined, viewer: Viewer): photo is Photo {
	return !!photo && (viewer.isTeam || photo.visibility === 'PUBLIC');
}

function photosOf(category: RawCategory, viewer: Viewer): Photo[] {
	return [
		...category.photos.filter((p) => canSee(p, viewer)),
		...category.children.flatMap((c) => photosOf(c, viewer))
	];
}

/** Drops categories without a single visible photo. Without a cover the first photo stands in. */
function toNode(category: RawCategory, viewer: Viewer): CategoryNode | null {
	const photos = photosOf(category, viewer);
	if (photos.length === 0) return null;
	return {
		slug: category.slug,
		name: category.name,
		photoCount: photos.length,
		cover: canSee(category.cover, viewer) ? category.cover : photos[0],
		children: category.children.map((c) => toNode(c, viewer)).filter((c) => c !== null)
	};
}

function summarize(series: RawSeries, event: RawEvent, viewer: Viewer): EventSummary {
	const categories = event.categories.map((c) => toNode(c, viewer)).filter((c) => c !== null);
	return {
		seriesSlug: series.slug,
		slug: event.slug,
		name: event.name,
		edition: event.edition,
		dates: event.dates,
		photoCount: categories.reduce((sum, c) => sum + c.photoCount, 0),
		categoryCount: categories.length,
		cover: canSee(event.cover, viewer) ? event.cover : categories[0]?.cover
	};
}

/** The photographers set on the event, or else the names on its visible photos. */
function photographersOf(event: RawEvent, viewer: Viewer): string[] {
	if (event.photographers.length > 0) return event.photographers;
	const names = event.categories.flatMap((c) => photosOf(c, viewer)).map((p) => p.photographer);
	return [...new Set(names.filter(Boolean))];
}

function seriesSummary(series: RawSeries, viewer: Viewer): SeriesSummary {
	return {
		slug: series.slug,
		name: series.name,
		shortName: series.shortName,
		region: series.region,
		kind: series.kind,
		events: series.events.map((e) => summarize(series, e, viewer))
	};
}

function findEvent(all: RawSeries[], seriesSlug: string, eventSlug: string) {
	const series = all.find((s) => s.slug === seriesSlug);
	const event = series?.events.find((e) => e.slug === eventSlug);
	return series && event ? { series, event } : undefined;
}

export function buildSeriesList(all: RawSeries[], viewer: Viewer): SeriesSummary[] {
	return all.map((s) => seriesSummary(s, viewer));
}

export function buildSeries(
	all: RawSeries[],
	slug: string,
	viewer: Viewer
): SeriesSummary | undefined {
	const series = all.find((s) => s.slug === slug);
	return series && seriesSummary(series, viewer);
}

export function buildEvent(
	all: RawSeries[],
	seriesSlug: string,
	eventSlug: string,
	viewer: Viewer
): EventDetail | undefined {
	const found = findEvent(all, seriesSlug, eventSlug);
	if (!found) return undefined;
	const { series, event } = found;
	return {
		...summarize(series, event, viewer),
		subtitle: event.subtitle,
		location: event.location,
		description: event.description,
		photographers: photographersOf(event, viewer),
		rights: event.rights,
		hero: canSee(event.hero, viewer) ? event.hero : undefined,
		highlights: event.highlights.filter((p) => canSee(p, viewer)),
		categories: event.categories.map((c) => toNode(c, viewer)).filter((c) => c !== null)
	};
}

/** The categories along `path`, root first, or undefined if a slug does not exist. */
function walk(categories: RawCategory[], path: string[]): RawCategory[] | undefined {
	if (path.length === 0) return undefined;
	const trail: RawCategory[] = [];
	let level = categories;
	for (const slug of path) {
		const next = level.find((c) => c.slug === slug);
		if (!next) return undefined;
		trail.push(next);
		level = next.children;
	}
	return trail;
}

export function buildCategoryPage(
	all: RawSeries[],
	seriesSlug: string,
	eventSlug: string,
	path: string[],
	viewer: Viewer
): CategoryPage | undefined {
	const found = findEvent(all, seriesSlug, eventSlug);
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
		photographers: photographersOf(found.event, viewer),
		rights: found.event.rights
	};
}
