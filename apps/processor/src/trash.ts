import type { S3Client } from '@aws-sdk/client-s3';
import { schema, type Database } from '@shoebox/db';
import { deleteMediaObjects, type S3Buckets } from '@shoebox/shared';
import { inArray, lt } from 'drizzle-orm';

/** Photos stay this long in the trash before they are gone for good. */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Deletes trashed media older than the retention period, objects first, then the rows. */
export async function purgeTrash(db: Database, s3: S3Client, buckets: S3Buckets): Promise<number> {
	const expired = await db
		.select({ id: schema.media.id })
		.from(schema.media)
		.where(lt(schema.media.deletedAt, new Date(Date.now() - TRASH_RETENTION_MS)))
		.limit(200);
	for (const { id } of expired) await deleteMediaObjects(s3, buckets, id);
	if (expired.length > 0) {
		await db.delete(schema.media).where(
			inArray(
				schema.media.id,
				expired.map((m) => m.id)
			)
		);
	}
	return expired.length;
}
