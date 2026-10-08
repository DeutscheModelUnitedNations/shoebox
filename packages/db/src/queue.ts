import { and, eq, lt, lte, sql } from 'drizzle-orm';
import type { JobInput, ProcessingJobStatus, ProcessingJobType } from '@shoebox/shared';
import { jobPayloadSchemas } from '@shoebox/shared';
import type { Database } from './index';
import { processingJob } from './schema';

/** Postgres NOTIFY channel the processor listens on. */
export const JOB_CHANNEL = 'processing_job';

export type ProcessingJobRow = typeof processingJob.$inferSelect;

/**
 * Inserts a job and wakes the processor. The payload is validated against the schema for its
 * type so a bad payload fails here, on the server, not inside a worker.
 */
export async function enqueueJob<T extends ProcessingJobType>(
	db: Database,
	type: T,
	payload: JobInput<T>,
	options: { runAt?: Date; maxAttempts?: number } = {}
): Promise<ProcessingJobRow> {
	const parsed = jobPayloadSchemas[type].parse(payload) as Record<string, unknown>;
	const [job] = await db
		.insert(processingJob)
		.values({
			type,
			payload: parsed,
			runAt: options.runAt,
			maxAttempts: options.maxAttempts
		})
		.returning();
	await db.execute(sql`select pg_notify(${JOB_CHANNEL}, ${job.id})`);
	return job;
}

/**
 * Atomically claims the next runnable job for `workerId`, or returns undefined when the queue
 * is empty. Concurrent workers never claim the same row thanks to SKIP LOCKED.
 */
export async function claimJob(
	db: Database,
	workerId: string
): Promise<ProcessingJobRow | undefined> {
	const next = db
		.select({ id: processingJob.id })
		.from(processingJob)
		.where(and(eq(processingJob.status, 'PENDING'), lte(processingJob.runAt, sql`now()`)))
		.orderBy(processingJob.runAt, processingJob.createdAt)
		.limit(1)
		.for('update', { skipLocked: true });

	const [job] = await db
		.update(processingJob)
		.set({
			status: 'RUNNING',
			lockedAt: new Date(),
			lockedBy: workerId,
			attempts: sql`${processingJob.attempts} + 1`
		})
		.where(eq(processingJob.id, next))
		.returning();
	return job;
}

export async function completeJob(db: Database, id: string, result: Record<string, unknown>) {
	await db
		.update(processingJob)
		.set({ status: 'SUCCEEDED', result, finishedAt: new Date(), lockedAt: null, lockedBy: null })
		.where(eq(processingJob.id, id));
}

/** Exponential backoff: 10s, 20s, 40s, ... capped at one hour. */
export function retryDelayMs(attempts: number) {
	return Math.min(10_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);
}

/**
 * Records a failure. The job is rescheduled with backoff until `maxAttempts` is reached,
 * then marked FAILED for good.
 */
export async function failJob(db: Database, job: ProcessingJobRow, error: unknown) {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	const exhausted = job.attempts >= job.maxAttempts;
	await db
		.update(processingJob)
		.set({
			status: exhausted ? 'FAILED' : 'PENDING',
			lastError: message.slice(0, 10_000),
			runAt: exhausted ? job.runAt : new Date(Date.now() + retryDelayMs(job.attempts)),
			finishedAt: exhausted ? new Date() : null,
			lockedAt: null,
			lockedBy: null
		})
		.where(eq(processingJob.id, job.id));
	return exhausted;
}

/**
 * Returns jobs that a crashed worker left RUNNING to the queue. Call periodically from the
 * processor; `staleAfterMs` must exceed the longest expected job duration.
 */
export async function recoverStaleJobs(db: Database, staleAfterMs: number): Promise<number> {
	const cutoff = new Date(Date.now() - staleAfterMs);
	const rows = await db
		.update(processingJob)
		.set({ status: 'PENDING', lockedAt: null, lockedBy: null, lastError: 'Recovered stale job' })
		.where(and(eq(processingJob.status, 'RUNNING'), lt(processingJob.lockedAt, cutoff)))
		.returning({ id: processingJob.id });
	return rows.length;
}

export async function queueStats(db: Database): Promise<Record<ProcessingJobStatus, number>> {
	const rows = await db
		.select({ status: processingJob.status, count: sql<number>`count(*)::int` })
		.from(processingJob)
		.groupBy(processingJob.status);
	const stats: Record<ProcessingJobStatus, number> = {
		PENDING: 0,
		RUNNING: 0,
		SUCCEEDED: 0,
		FAILED: 0
	};
	for (const row of rows) stats[row.status] = row.count;
	return stats;
}
