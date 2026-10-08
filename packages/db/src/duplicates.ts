import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import type { Database } from './index';
import { duplicateCandidate, media } from './schema';

/** Hamming distance of two 64 bit hashes given as 16 hex characters. */
export function hammingDistance(a: string, b: string): number {
	let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
	let bits = 0;
	while (x) {
		bits += Number(x & 1n);
		x >>= 1n;
	}
	return bits;
}

/** Percent similarity of two difference hashes. */
export function similarity(a: string, b: string) {
	return Math.round((1 - hammingDistance(a, b) / 64) * 100);
}

/** Pairs at or above this similarity are flagged for review. */
export const SIMILARITY_THRESHOLD = 90;

/**
 * Compares a freshly processed photo against the other photos of its event and records every
 * similar pair once. Returns the number of new candidates.
 */
export async function recordSimilarPhotos(db: Database, mediaId: string): Promise<number> {
	const [self] = await db.select().from(media).where(eq(media.id, mediaId));
	if (!self?.phash) return 0;
	const others = await db
		.select({ id: media.id, phash: media.phash, createdAt: media.createdAt })
		.from(media)
		.where(
			and(
				eq(media.eventId, self.eventId),
				ne(media.id, self.id),
				isNotNull(media.phash),
				isNull(media.deletedAt)
			)
		);
	const pairs = others
		.map((o) => ({ ...o, score: similarity(self.phash!, o.phash!) }))
		.filter((o) => o.score >= SIMILARITY_THRESHOLD)
		.map((o) => {
			// The older photo is the one that was there first
			const selfIsNewer = self.createdAt >= o.createdAt;
			return {
				eventId: self.eventId,
				mediaId: selfIsNewer ? o.id : self.id,
				otherMediaId: selfIsNewer ? self.id : o.id,
				similarity: o.score
			};
		});
	if (pairs.length === 0) return 0;
	const inserted = await db
		.insert(duplicateCandidate)
		.values(pairs)
		.onConflictDoNothing()
		.returning({ id: duplicateCandidate.id });
	return inserted.length;
}
