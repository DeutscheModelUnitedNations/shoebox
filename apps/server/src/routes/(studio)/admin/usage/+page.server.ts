import { eq } from 'drizzle-orm';
import { getSetting } from '@shoebox/db';
import type { PageServerLoad } from './$types';
import { db, schema } from '$api/db';
import { fullName } from '$lib/studio/people';

export const load: PageServerLoad = async () => {
	const [usage, [meta]] = await Promise.all([
		getSetting(db, 'usage'),
		db
			.select({
				updatedAt: schema.setting.updatedAt,
				givenName: schema.user.givenName,
				familyName: schema.user.familyName
			})
			.from(schema.setting)
			.leftJoin(schema.user, eq(schema.setting.updatedById, schema.user.id))
			.where(eq(schema.setting.key, 'usage'))
	]);
	return {
		usage,
		updatedAt: meta?.updatedAt.toISOString() ?? null,
		updatedBy: meta ? fullName(meta) : null
	};
};
