import { sql } from 'drizzle-orm';
import { queueStats } from '@shoebox/db';
import { bucketReachable } from '@shoebox/shared';
import { db } from '$api/db';
import { buckets, s3 } from './storage';
import { configPublic } from '$config/public';

export type Health = Awaited<ReturnType<typeof getHealth>>;

async function databaseReachable() {
	try {
		await db.execute(sql`select 1`);
		return true;
	} catch {
		return false;
	}
}

export async function getHealth() {
	const [database, originals, derivatives, queue] = await Promise.all([
		databaseReachable(),
		bucketReachable(s3, buckets.originals),
		bucketReachable(s3, buckets.derivatives),
		queueStats(db).catch(() => null)
	]);
	return {
		ok: database && originals && derivatives,
		database,
		storage: { originals, derivatives },
		queue,
		version: configPublic.PUBLIC_VERSION ?? null,
		sha: configPublic.PUBLIC_SHA ?? null
	};
}
