/**
 * View models the gallery pages render. Server load functions build them from
 * `$lib/server/gallery`, which serves demo data until the domain schema lands.
 */

export type Visibility = 'PUBLIC' | 'TEAM';

/** `medium` and `large` match the processor's `imageVariants`, `original` is the upload. */
export type DownloadVariant = 'medium' | 'large' | 'original';

export interface Download {
	variant: DownloadVariant;
	href: string;
	width: number;
	height: number;
	bytes: number;
	/**
	 * ALWAYS, GUESTS (team gets the clean file) or OPTIONAL (team may opt out). Only sizes the
	 * viewer may fetch are listed, guests always see ALWAYS.
	 */
	watermark: 'ALWAYS' | 'GUESTS' | 'OPTIONAL';
}

export interface Photo {
	id: string;
	title: string;
	alt: string;
	photographer: string;
	takenAt: string;
	visibility: Visibility;
	/** Grid variant */
	thumbUrl: string;
	/** Extra large size of conference banners, only on hero photos */
	banner?: { url: string; width: number };
	/** Blurhash as PNG data URL, shown while the image loads */
	placeholder: string | null;
	/** Lightbox variant */
	url: string;
	width: number;
	height: number;
	mimeType: string;
	downloads: Download[];
}

export interface DateRange {
	from: string;
	to?: string;
	precision: 'day' | 'month' | 'year';
}

export interface CategoryNode {
	slug: string;
	name: string;
	/** Includes every descendant */
	photoCount: number;
	cover?: Photo;
	children: CategoryNode[];
}

export interface EventSummary {
	seriesSlug: string;
	slug: string;
	/** Light part of the title, e.g. "MUN-SH" */
	name: string;
	/** Bold part of the title, e.g. "2026" */
	edition: string;
	dates: DateRange;
	photoCount: number;
	categoryCount: number;
	cover?: Photo;
}

export interface EventDetail extends EventSummary {
	subtitle: string;
	location: string;
	description: string;
	photographers: string[];
	rights: string;
	hero?: Photo;
	highlights: Photo[];
	categories: CategoryNode[];
}

export interface SeriesSummary {
	slug: string;
	name: string;
	shortName: string;
	region: string;
	kind: 'conference' | 'association';
	events: EventSummary[];
}

export interface CategoryPage {
	event: EventSummary;
	/** Root category of the current path, drives the sidebar */
	root: CategoryNode;
	/** Root first, current category last */
	trail: CategoryNode[];
	photos: Photo[];
	photographers: string[];
	rights: string;
}
