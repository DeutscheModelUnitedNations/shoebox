import { assertFindFirstExists } from '@m1212e/rumble';
import { enqueueJob } from '@shoebox/db';
import { db } from '$api/db';
import { abilityBuilder, object, pubsub as rumblePubsub, query, schemaBuilder } from '$api/rumble';
import { requireAdmin } from '$api/services/authHelper';

abilityBuilder.processingJob.allow('read').when((ctx) => {
	requireAdmin(ctx);
	return 'allow';
});

export const ProcessingJobRef = object({ table: 'processingJob' });

const pubsub = rumblePubsub({ table: 'processingJob' });

query({ table: 'processingJob' });

schemaBuilder.mutationFields((t) => ({
	enqueuePingJob: t.drizzleField({
		type: ProcessingJobRef,
		description: 'Admin only. Puts a PING job on the queue to exercise the processor.',
		args: {
			message: t.arg.string()
		},
		resolve: async (query, _root, args, ctx) => {
			requireAdmin(ctx);
			const job = await enqueueJob(db, 'PING', { message: args.message ?? undefined });
			pubsub.created();
			return db.query.processingJob
				.findFirst(query({ where: { id: job.id } }))
				.then(assertFindFirstExists);
		}
	})
}));
