import { and, eq, inArray, isNotNull, isNull, max, ne } from 'drizzle-orm';
import type { DerivativeResult } from '@shoebox/shared';
import type { Database } from './index';
import { media } from './schema';

export interface MediaProcessingResult {
	width?: number;
	height?: number;
	bytes?: number;
	blurhash?: string;
	exif?: Record<string, unknown>;
	gps?: { latitude: number; longitude: number };
	derivatives: DerivativeResult[];
	phash?: string;
	takenAt?: Date;
}

/**
 * Stores what the processor produced and makes the media visible in the gallery. Held
 * duplicates keep their status until someone decides in the duplicate review.
 */
export async function markMediaReady(db: Database, mediaId: string, result: MediaProcessingResult) {
	await db
		.update(media)
		.set({
			width: result.width,
			height: result.height,
			bytes: result.bytes,
			blurhash: result.blurhash,
			exif: result.exif,
			gps: result.gps,
			derivatives: result.derivatives,
			phash: result.phash,
			...(result.takenAt ? { takenAt: result.takenAt } : {})
		})
		.where(eq(media.id, mediaId));
	await db
		.update(media)
		.set({ status: 'READY' })
		.where(and(eq(media.id, mediaId), ne(media.status, 'HELD')));
}

export async function markMediaFailed(db: Database, mediaId: string) {
	await db.update(media).set({ status: 'FAILED' }).where(eq(media.id, mediaId));
}

/** The next free position at the end of an event, for new uploads. */
export async function nextMediaSortOrder(db: Database, eventId: string) {
	const [row] = await db
		.select({ value: max(media.sortOrder) })
		.from(media)
		.where(eq(media.eventId, eventId));
	return (row?.value ?? 0) + 1;
}

/** Photos of an event by SHA-256 (optionally only these hashes), for exact duplicate checks. */
export async function mediaByHash(db: Database, eventId: string, hashes?: string[]) {
	const rows = await db
		.select({ id: media.id, sha256: media.sha256, filename: media.originalFilename })
		.from(media)
		.where(
			and(
				eq(media.eventId, eventId),
				hashes ? inArray(media.sha256, hashes) : isNotNull(media.sha256),
				isNull(media.deletedAt)
			)
		);
	return new Map(rows.map((r) => [r.sha256!, { id: r.id, filename: r.filename }]));
}
