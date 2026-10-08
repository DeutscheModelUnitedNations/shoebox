import { and, desc, eq, gt, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import type { ProcessingJobType } from '@shoebox/shared';
import { db, schema } from '$api/db';
import { canManage, type Roles } from '$api/services/roles';
import {
	errorSummary,
	jobContext,
	etaSeconds,
	jobsPerMinute,
	queueState,
	THROUGHPUT_WINDOW_MS
} from '$lib/studio/queue';

const job = schema.processingJob;

/** Rows listed in the table, the rest is only counted. */
const LIST_LIMIT = 50;
const FAILED_LIMIT = 10;

/** Jobs the processor works through now: running, or waiting and due. */
const active = or(
	eq(job.status, 'RUNNING'),
	and(eq(job.status, 'PENDING'), lte(job.runAt, sql`now()`))
);

/** The media row behind an image or video job, ZIP imports name their event directly. */
const jobMedia = sql`${schema.media.id} = ${job.payload}->>'mediaId'`;
const jobEventId = sql<
	string | null
>`coalesce(${schema.media.eventId}, ${job.payload}->>'eventId')`;

/** Aggregated timestamps as epoch milliseconds, raw ones would lose the UTC marker. */
const epochMs = (value: SQL) => sql<number | null>`(extract(epoch from ${value}) * 1000)::float8`;

/** Running jobs first, then the order `claimJob` picks the waiting ones in. */
const claimOrder = [
	sql`${job.status} = 'RUNNING' desc`,
	sql`coalesce(${job.lockedAt}, ${job.runAt})`,
	job.createdAt
];

interface QueueJob {
	id: string;
	type: ProcessingJobType;
	running: boolean;
	/** Place in line, 1 is the next one a worker picks up (running jobs count too) */
	position: number;
	attempts: number;
	maxAttempts: number;
	/** Seconds it has been running, or waiting since it became due */
	seconds: number;
	/** Only filled for events the viewer manages */
	filename: string | null;
	event: { id: string; name: string } | null;
	/** Belongs to an event the viewer may not see */
	otherEvent: boolean;
}

export async function loadQueue(roles: Roles) {
	const now = new Date();
	const windowStart = new Date(now.getTime() - THROUGHPUT_WINDOW_MS);
	const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
	const finished = and(
		inArray(job.status, ['SUCCEEDED', 'FAILED']),
		gt(job.finishedAt, windowStart)
	);

	const ranked = db.$with('ranked').as(
		db
			.select({
				eventId: jobEventId.as('event_id'),
				position:
					sql<number>`row_number() over (order by ${sql.join(claimOrder, sql`, `)})::int`.as(
						'position'
					)
			})
			.from(job)
			.leftJoin(schema.media, jobMedia)
			.where(active)
	);

	const [[counts], byEvent, rows, failedRows, byType] = await Promise.all([
		db
			.select({
				ready: sql<number>`count(*) filter (where ${job.status} = 'PENDING' and ${job.runAt} <= now())::int`,
				retrying: sql<number>`count(*) filter (where ${job.status} = 'PENDING' and ${job.runAt} > now())::int`,
				running: sql<number>`count(*) filter (where ${job.status} = 'RUNNING')::int`,
				failed: sql<number>`count(*) filter (where ${job.status} = 'FAILED' and ${job.finishedAt} > ${dayAgo})::int`,
				finished: sql<number>`count(*) filter (where ${finished})::int`,
				oldestFinishedAt: epochMs(sql`min(${job.finishedAt}) filter (where ${finished})`),
				lastFinishedAt: epochMs(sql`max(${job.finishedAt})`),
				oldestReadyAt: epochMs(
					sql`min(${job.runAt}) filter (where ${job.status} = 'PENDING' and ${job.runAt} <= now())`
				)
			})
			.from(job)
			.where(or(inArray(job.status, ['PENDING', 'RUNNING']), gt(job.finishedAt, dayAgo))),
		db
			.with(ranked)
			.select({
				eventId: ranked.eventId,
				count: sql<number>`count(*)::int`,
				last: sql<number>`max(${ranked.position})::int`
			})
			.from(ranked)
			.groupBy(ranked.eventId),
		db
			.select({
				id: job.id,
				type: job.type,
				status: job.status,
				attempts: job.attempts,
				maxAttempts: job.maxAttempts,
				lockedAt: job.lockedAt,
				runAt: job.runAt,
				filename: schema.media.originalFilename,
				eventId: jobEventId
			})
			.from(job)
			.leftJoin(schema.media, jobMedia)
			.where(active)
			.orderBy(...claimOrder)
			.limit(LIST_LIMIT),
		db
			.select({
				id: job.id,
				type: job.type,
				finishedAt: job.finishedAt,
				lastError: job.lastError,
				filename: schema.media.originalFilename,
				eventId: jobEventId
			})
			.from(job)
			.leftJoin(schema.media, jobMedia)
			.where(and(eq(job.status, 'FAILED'), gt(job.finishedAt, dayAgo)))
			.orderBy(desc(job.finishedAt))
			.limit(FAILED_LIMIT),
		db
			.select({ type: job.type, count: sql<number>`count(*)::int` })
			.from(job)
			.where(and(eq(job.status, 'PENDING'), lte(job.runAt, sql`now()`)))
			.groupBy(job.type)
	]);

	const visibleIds = [
		...new Set(
			[...byEvent, ...rows, ...failedRows]
				.map((r) => r.eventId)
				.filter((id): id is string => !!id && canManage(roles, id))
		)
	];
	const events = visibleIds.length
		? await db
				.select({ id: schema.event.id, name: schema.event.name, edition: schema.event.edition })
				.from(schema.event)
				.where(inArray(schema.event.id, visibleIds))
		: [];
	const visible = new Map(events.map((e) => [e.id, { id: e.id, name: `${e.name} ${e.edition}` }]));
	const contextOf = (row: Parameters<typeof jobContext>[0]) => jobContext(row, visible);

	const secondsSince = (d: Date) => Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
	const date = (value: number | null) => (value ? new Date(value) : null);
	const perMinute = jobsPerMinute(counts.finished, date(counts.oldestFinishedAt), now);
	const remaining = counts.ready + counts.running;

	const jobs: QueueJob[] = rows.map((row, index) => ({
		id: row.id,
		type: row.type,
		running: row.status === 'RUNNING',
		position: index + 1,
		attempts: row.attempts,
		maxAttempts: row.maxAttempts,
		seconds: secondsSince(row.lockedAt ?? row.runAt),
		...contextOf(row)
	}));

	return {
		state: queueState({
			ready: counts.ready,
			running: counts.running,
			oldestReadyAt: date(counts.oldestReadyAt),
			lastFinishedAt: date(counts.lastFinishedAt),
			now
		}),
		ready: counts.ready,
		running: counts.running,
		retrying: counts.retrying,
		failed: counts.failed,
		perMinute,
		etaSeconds: etaSeconds(remaining, perMinute),
		byType: Object.fromEntries(byType.map((t) => [t.type, t.count])) as Partial<
			Record<ProcessingJobType, number>
		>,
		/** The viewer's events with work in the queue and when their last job is through */
		events: byEvent
			.flatMap((row) => {
				const { event } = contextOf({ eventId: row.eventId, filename: null });
				return event
					? [{ ...event, count: row.count, etaSeconds: etaSeconds(row.last, perMinute) }]
					: [];
			})
			.sort((a, b) => a.name.localeCompare(b.name)),
		jobs,
		more: Math.max(0, remaining - jobs.length),
		failedJobs: failedRows.map((row) => {
			const context = contextOf(row);
			const showError = roles.isAdmin || !!context.event;
			return {
				id: row.id,
				type: row.type,
				// Failed jobs always carry finishedAt
				seconds: secondsSince(row.finishedAt!),
				error: showError ? errorSummary(row.lastError) : '',
				...context
			};
		})
	};
}
