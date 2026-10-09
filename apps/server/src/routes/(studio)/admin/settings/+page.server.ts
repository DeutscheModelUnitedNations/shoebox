import { and, desc, eq, isNull } from 'drizzle-orm';
import { getSetting } from '@shoebox/db';
import { storageKeys } from '@shoebox/shared';
import type { PageServerLoad } from './$types';
import { db, schema } from '$api/db';
import { countRerenderable } from '$api/services/catalog';
import { buckets, presignDownload } from '$api/services/storage';

export const load: PageServerLoad = async () => {
	const [watermark, downloads, rerenderCount, [sample]] = await Promise.all([
		getSetting(db, 'watermark'),
		getSetting(db, 'downloads'),
		countRerenderable(),
		db
			.select({ id: schema.media.id })
			.from(schema.media)
			.where(and(eq(schema.media.status, 'READY'), isNull(schema.media.deletedAt)))
			.orderBy(desc(schema.media.width))
			.limit(1)
	]);
	// The clean copy, so the preview shows the configured watermark and not the current one
	const sampleUrl = sample
		? await presignDownload(
				buckets.originals,
				storageKeys.cleanDerivative(sample.id, 'large', 'webp'),
				3600
			)
		: null;
	return { watermark, downloads, rerenderCount, sampleUrl };
};
