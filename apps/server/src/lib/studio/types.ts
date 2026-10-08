/** View models of the upload, manage and admin screens. */

import type { DateRange } from '$lib/gallery/types';

export interface StudioCategory {
	id: string;
	parentId: string | null;
	name: string;
	slug: string;
	hidden: boolean;
	/** 1 for main categories */
	depth: number;
	/** Photos in this category and below */
	count: number;
	children: StudioCategory[];
}

export interface StudioMedia {
	id: string;
	title: string;
	filename: string;
	photographer: string;
	visibility: 'PUBLIC' | 'TEAM';
	status: 'UPLOADING' | 'PENDING' | 'READY' | 'HELD' | 'FAILED';
	/** Missing while the processor has not rendered it yet */
	thumbUrl: string | null;
	/** Medium and large prefer the watermark-free copies, the studio is team only */
	mediumUrl: string | null;
	/** Placeholder while the image loads */
	blurhash: string | null;
	largeUrl: string | null;
	width: number | null;
	height: number | null;
	bytes: number | null;
	takenAt: string | null;
	categoryId: string | null;
	isCover: boolean;
	/** Shown under "Impressionen" on the conference page */
	highlight: boolean;
	/** Part of an open duplicate pair */
	duplicate: boolean;
	deletedAt: string | null;
}

export interface StudioEvent {
	id: string;
	seriesId: string;
	seriesSlug: string;
	seriesShortName: string;
	slug: string;
	name: string;
	edition: string;
	subtitle: string;
	location: string;
	description: string;
	rights: string;
	dates: DateRange;
	visibility: 'PUBLIC' | 'HIDDEN';
	photoCount: number;
	teamCount: number;
	duplicateCount: number;
	categoryCount: number;
	storageBytes: number;
	coverUrl: string | null;
	photographers: { email: string; name: string | null; photoCount: number }[];
}

export interface DuplicatePair {
	id: string;
	similarity: number;
	left: StudioMedia;
	right: StudioMedia;
	leftCategory: string | null;
	rightCategory: string | null;
}
