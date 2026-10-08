import { nanoid, processingJobStatuses, processingJobTypes } from '@shoebox/shared';
import { index, integer, jsonb, pgEnum, snakeCase, text, timestamp } from 'drizzle-orm/pg-core';

const defaultTimestamps = {
	createdAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'date' })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
};

const defaultIdAndTimestamps = {
	id: text()
		.$defaultFn(() => nanoid())
		.primaryKey()
		.notNull(),
	...defaultTimestamps
};

/**
 * Users are upserted on every OIDC login. `id` is the OIDC subject. Whether a user is team or
 * admin is derived from the email at request time (see the server's authHelper), it is not
 * stored here.
 */
export const user = snakeCase.table('user', {
	id: text().primaryKey().notNull(),
	...defaultTimestamps,
	email: text().notNull().unique(),
	familyName: text().notNull(),
	givenName: text().notNull(),
	locale: text(),
	preferredUsername: text().notNull()
});

export const processingJobType = pgEnum('processing_job_type', processingJobTypes);
export const processingJobStatus = pgEnum('processing_job_status', processingJobStatuses);

/**
 * Work queue between the server and the processor. Rows are claimed with
 * `FOR UPDATE SKIP LOCKED` and the server wakes idle workers with `NOTIFY` (see queue.ts).
 */
export const processingJob = snakeCase.table(
	'processing_job',
	{
		...defaultIdAndTimestamps,
		type: processingJobType().notNull(),
		status: processingJobStatus().notNull().default('PENDING'),
		payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
		result: jsonb().$type<Record<string, unknown>>(),
		attempts: integer().notNull().default(0),
		maxAttempts: integer().notNull().default(3),
		/** Earliest time the job may run. Pushed into the future on retry. */
		runAt: timestamp({ mode: 'date' }).defaultNow().notNull(),
		lockedAt: timestamp({ mode: 'date' }),
		lockedBy: text(),
		lastError: text(),
		finishedAt: timestamp({ mode: 'date' })
	},
	(t) => [index('processing_job_claim_idx').on(t.status, t.runAt)]
);
