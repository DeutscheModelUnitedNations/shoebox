/**
 * Turns database rows into the raw gallery structures tree.ts builds view models from. Pure,
 * the only side effect (URL signing) is passed in.
 */
import { storageKeys, type DerivativeResult, type DownloadSettings } from '@shoebox/shared';
import type { schema } from '@shoebox/db';
import type { Download, Photo } from '$lib/gallery/types';
import type { RawCategory, RawEvent, RawSeries } from './tree';

export type MediaRow = typeof schema.media.$inferSelect;
export type CategoryRow = typeof schema.category.$inferSelect;
export type EventRow = typeof schema.event.$inferSelect;
export type SeriesRow = typeof schema.series.$inferSelect;

/** Resolves a derivative to a URL the browser may load. */
export type UrlOf = (derivative: DerivativeResult) => string | Promise<string>;

/** The variants shown on the page, watermarked for medium and large. */
function shownVariants(row: MediaRow) {
	const pick = (variant: string) => {
		const key = storageKeys.derivative(row.id, variant, 'webp');
		return row.derivatives.find((d) => d.key === key);
	};
	const [thumb, medium, large] = [pick('thumb'), pick('medium'), pick('large')];
	return thumb && medium && large ? { thumb, medium, large } : undefined;
}

/** Download settings key for each variant: preview = medium, web = large. */
const settingFor = { medium: 'preview', large: 'web', original: 'original' } as const;

function download(
	row: MediaRow,
	variant: Download['variant'],
	size: { width: number; height: number; bytes: number },
	settings: DownloadSettings
): Download {
	const { guests, team, watermark } = settings[settingFor[variant]];
	return {
		variant,
		href: `/api/media/${row.id}/download?variant=${variant}`,
		width: size.width,
		height: size.height,
		bytes: size.bytes,
		guests,
		team,
		watermark
	};
}

function downloadsOf(
	row: MediaRow,
	medium: DerivativeResult,
	large: DerivativeResult,
	settings: DownloadSettings
) {
	const original = {
		width: row.width ?? large.width,
		height: row.height ?? large.height,
		bytes: row.bytes ?? 0
	};
	// Small originals render medium and large at the same size, offer it once
	const sizes = medium.width === large.width ? [] : [download(row, 'medium', medium, settings)];
	return [
		...sizes,
		download(row, 'large', large, settings),
		download(row, 'original', original, settings)
	].filter((d) => d.guests || d.team);
}

export async function toPhoto(
	row: MediaRow,
	urlOf: UrlOf,
	settings: DownloadSettings
): Promise<Photo | undefined> {
	const shown = shownVariants(row);
	if (!shown) return undefined;
	const [thumbUrl, url] = await Promise.all([urlOf(shown.thumb), urlOf(shown.large)]);
	return {
		id: row.id,
		title: row.title,
		alt: row.alt || row.title,
		photographer: row.photographer,
		takenAt: (row.takenAt ?? row.createdAt).toISOString(),
		visibility: row.visibility,
		thumbUrl,
		blurhash: row.blurhash,
		url,
		width: shown.large.width,
		height: shown.large.height,
		mimeType: row.mimeType,
		downloads: downloadsOf(row, shown.medium, shown.large, settings)
	};
}

/**
 * Nests categories under their parents, attaching the visible photos. Categories whose parent
 * was filtered out (hidden) are dropped with their whole subtree.
 */
export function buildTree(
	categories: CategoryRow[],
	media: MediaRow[],
	photos: Map<string, Photo>
): RawCategory[] {
	const nodes = new Map<string, RawCategory>(
		categories.map((c) => [
			c.id,
			{
				slug: c.slug,
				name: c.name,
				cover: photos.get(c.coverMediaId ?? ''),
				photos: [],
				children: []
			}
		])
	);
	for (const m of media) {
		const photo = photos.get(m.id);
		if (photo) nodes.get(m.categoryId ?? '')?.photos.push(photo);
	}
	const roots: RawCategory[] = [];
	// Categories arrive sorted, so children keep their order
	for (const c of categories) {
		const node = nodes.get(c.id)!;
		if (!c.parentId) roots.push(node);
		else nodes.get(c.parentId)?.children.push(node);
	}
	return roots;
}

export interface Rows {
	series: SeriesRow[];
	events: EventRow[];
	categories: CategoryRow[];
	media: MediaRow[];
	photos: Map<string, Photo>;
}

function toEvent(e: EventRow, rows: Rows): RawEvent {
	const media = rows.media.filter((m) => m.eventId === e.id);
	const photo = (id: string | null) => rows.photos.get(id ?? '');
	return {
		slug: e.slug,
		name: e.name,
		edition: e.edition,
		subtitle: e.subtitle,
		location: e.location,
		description: e.description,
		dates: {
			from: e.dateFrom,
			to: e.dateTo ?? undefined,
			precision: e.datePrecision.toLowerCase() as RawEvent['dates']['precision']
		},
		photographers: e.photographers,
		rights: e.rights,
		cover: photo(e.coverMediaId),
		hero: photo(e.heroMediaId),
		highlights: media.filter((m) => m.highlight).flatMap((m) => photo(m.id) ?? []),
		categories: buildTree(
			rows.categories.filter((c) => c.eventId === e.id),
			media,
			rows.photos
		)
	};
}

export function assemble(rows: Rows): RawSeries[] {
	return rows.series.map((s) => ({
		slug: s.slug,
		name: s.name,
		shortName: s.shortName,
		region: s.region,
		kind: s.kind === 'CONFERENCE' ? 'conference' : 'association',
		events: rows.events.filter((e) => e.seriesId === s.id).map((e) => toEvent(e, rows))
	}));
}
