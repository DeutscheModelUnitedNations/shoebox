import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getSetting } from '@shoebox/db';
import type { RequestHandler } from './$types';
import { db, schema } from '$api/db';
import { buckets, presignDownload } from '$api/services/storage';
import { resolveDownload } from '$lib/server/gallery/download';
import { viewerOf } from '$lib/server/gallery/viewer';

/** Redirects to a short-lived presigned GET for the requested variant. */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const [[row], settings] = await Promise.all([
		db.select().from(schema.media).where(eq(schema.media.id, params.id)),
		getSetting(db, 'downloads')
	]);
	const target = resolveDownload(row, {
		variant: url.searchParams.get('variant'),
		clean: url.searchParams.get('clean') === '1',
		isTeam: viewerOf(locals).isTeam,
		settings
	});
	if (!target.ok) error(target.status);
	redirect(302, await presignDownload(buckets[target.bucket], target.key, 5 * 60, target.filename));
};
