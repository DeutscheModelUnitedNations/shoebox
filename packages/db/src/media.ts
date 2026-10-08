import { eq } from 'drizzle-orm';
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
}

/** Stores what the processor produced and makes the media visible in the gallery. */
export async function markMediaReady(db: Database, mediaId: string, result: MediaProcessingResult) {
	await db
		.update(media)
		.set({
			status: 'READY',
			width: result.width,
			height: result.height,
			bytes: result.bytes,
			blurhash: result.blurhash,
			exif: result.exif,
			gps: result.gps,
			derivatives: result.derivatives
		})
		.where(eq(media.id, mediaId));
}

export async function markMediaFailed(db: Database, mediaId: string) {
	await db.update(media).set({ status: 'FAILED' }).where(eq(media.id, mediaId));
}
