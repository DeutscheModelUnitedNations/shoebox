import {
	nanoid,
	processingJobStatuses,
	processingJobTypes,
	type DerivativeResult
} from '@shoebox/shared';
import {
	type AnyPgColumn,
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	snakeCase,
	text,
	timestamp,
	unique
} from 'drizzle-orm/pg-core';

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

export const seriesKind = pgEnum('series_kind', ['CONFERENCE', 'ASSOCIATION']);
export const datePrecision = pgEnum('date_precision', ['DAY', 'MONTH', 'YEAR']);
export const mediaKind = pgEnum('media_kind', ['IMAGE', 'VIDEO']);
export const mediaVisibility = pgEnum('media_visibility', ['PUBLIC', 'TEAM']);
export const mediaStatus = pgEnum('media_status', ['PENDING', 'READY', 'FAILED']);

/** A conference series (MUN-SH, MUNBW) or the association's own projects. */
export const series = snakeCase.table('series', {
	...defaultIdAndTimestamps,
	slug: text().notNull().unique(),
	name: text().notNull(),
	shortName: text().notNull(),
	/** Eyebrow above the series heading, e.g. "Kiel · Schleswig-Holstein" */
	region: text().notNull(),
	kind: seriesKind().notNull(),
	sortOrder: integer().notNull().default(0)
});

/** One edition of a series (MUN-SH 2026) or one project (Mitgliederversammlung 2025). */
export const event = snakeCase.table(
	'event',
	{
		...defaultIdAndTimestamps,
		seriesId: text()
			.notNull()
			.references(() => series.id, { onDelete: 'cascade' }),
		slug: text().notNull(),
		/** Light part of the title */
		name: text().notNull(),
		/** Bold part of the title */
		edition: text().notNull(),
		subtitle: text().notNull(),
		location: text().notNull(),
		description: text().notNull(),
		dateFrom: date({ mode: 'string' }).notNull(),
		dateTo: date({ mode: 'string' }),
		datePrecision: datePrecision().notNull().default('DAY'),
		photographers: text().array().notNull().default([]),
		rights: text().notNull(),
		coverMediaId: text().references((): AnyPgColumn => media.id, { onDelete: 'set null' }),
		heroMediaId: text().references((): AnyPgColumn => media.id, { onDelete: 'set null' })
	},
	(t) => [unique('event_series_slug').on(t.seriesId, t.slug)]
);

/** Category tree inside an event, e.g. Gremien › Generalversammlung › Debatte. */
export const category = snakeCase.table(
	'category',
	{
		...defaultIdAndTimestamps,
		eventId: text()
			.notNull()
			.references(() => event.id, { onDelete: 'cascade' }),
		parentId: text().references((): AnyPgColumn => category.id, { onDelete: 'cascade' }),
		slug: text().notNull(),
		name: text().notNull(),
		sortOrder: integer().notNull().default(0),
		coverMediaId: text().references((): AnyPgColumn => media.id, { onDelete: 'set null' })
	},
	(t) => [
		unique('category_parent_slug').on(t.eventId, t.parentId, t.slug).nullsNotDistinct(),
		index('category_event_idx').on(t.eventId)
	]
);

/**
 * A photo or video. The original lives in the private bucket under `originalKey`, the
 * processor fills dimensions, blurhash and `derivatives` and flips `status` to READY.
 */
export const media = snakeCase.table(
	'media',
	{
		...defaultIdAndTimestamps,
		eventId: text()
			.notNull()
			.references(() => event.id, { onDelete: 'cascade' }),
		categoryId: text().references(() => category.id, { onDelete: 'set null' }),
		kind: mediaKind().notNull().default('IMAGE'),
		visibility: mediaVisibility().notNull().default('PUBLIC'),
		status: mediaStatus().notNull().default('PENDING'),
		/** Shown under "Impressionen" on the event page */
		highlight: boolean().notNull().default(false),
		sortOrder: integer().notNull().default(0),
		title: text().notNull().default(''),
		alt: text().notNull().default(''),
		photographer: text().notNull().default(''),
		takenAt: timestamp({ mode: 'date' }),
		originalKey: text().notNull(),
		originalFilename: text().notNull(),
		mimeType: text().notNull(),
		bytes: integer(),
		width: integer(),
		height: integer(),
		blurhash: text(),
		derivatives: jsonb().$type<DerivativeResult[]>().notNull().default([]),
		exif: jsonb().$type<Record<string, unknown>>(),
		gps: jsonb().$type<{ latitude: number; longitude: number }>()
	},
	(t) => [
		index('media_event_idx').on(t.eventId, t.status),
		index('media_category_idx').on(t.categoryId)
	]
);
