import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db, schema } from '$api/db';
import { buckets, presignDownload } from '$api/services/storage';
import { resolveDownload } from '$lib/server/gallery/download';
import { viewerOf } from '$lib/server/gallery/viewer';

/** Redirects to a short-lived presigned GET for the requested variant. */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const [row] = await db.select().from(schema.media).where(eq(schema.media.id, params.id));
	const target = resolveDownload(row, {
		variant: url.searchParams.get('variant'),
		clean: url.searchParams.get('clean') === '1',
		isTeam: viewerOf(locals).isTeam
	});
	if (!target.ok) error(target.status);
	redirect(302, await presignDownload(buckets[target.bucket], target.key, 5 * 60, target.filename));
};
