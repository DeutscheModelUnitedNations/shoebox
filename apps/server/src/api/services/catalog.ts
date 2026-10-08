import { and, asc, count, eq, inArray, isNull, max, ne } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { enqueueJob, getSetting, putSetting } from '@shoebox/db';
import type { DownloadSettings, UsageSettings, WatermarkSettings } from '@shoebox/shared';
import { db, schema } from '$api/db';
import { normalizeEmail } from './roles';
import { slugify, uniqueSlug } from './slug';
import { buckets } from './storage';

// ── Series ───────────────────────────────────────────────────────────────────────────────

export interface SeriesInput {
	name: string;
	shortName: string;
	region: string;
	kind: 'CONFERENCE' | 'ASSOCIATION';
	slug?: string | null;
}

export async function createSeries(input: SeriesInput) {
	const taken = await db.select({ slug: schema.series.slug }).from(schema.series);
	const [order] = await db.select({ value: max(schema.series.sortOrder) }).from(schema.series);
	const [row] = await db
		.insert(schema.series)
		.values({
			name: input.name,
			shortName: input.shortName,
			region: input.region,
			kind: input.kind,
			slug: uniqueSlug(
				slugify(input.slug || input.shortName),
				taken.map((t) => t.slug)
			),
			sortOrder: (order?.value ?? 0) + 1
		})
		.returning();
	return row;
}

export async function updateSeries(id: string, input: SeriesInput) {
	await db
		.update(schema.series)
		.set({
			name: input.name,
			shortName: input.shortName,
			region: input.region,
			kind: input.kind
		})
		.where(eq(schema.series.id, id));
}

/** Only empty series can go, events are never deleted implicitly. */
export async function deleteSeries(id: string) {
	const [events] = await db
		.select({ n: count() })
		.from(schema.event)
		.where(eq(schema.event.seriesId, id));
	if ((events?.n ?? 0) > 0) throw new GraphQLError('Series still has events');
	await db.delete(schema.series).where(eq(schema.series.id, id));
}

// ── Events ───────────────────────────────────────────────────────────────────────────────

export interface EventInput {
	seriesId: string;
	name: string;
	edition: string;
	subtitle: string;
	location: string;
	description: string;
	dateFrom: string;
	dateTo: string | null;
	datePrecision: 'DAY' | 'MONTH' | 'YEAR';
	visibility: 'PUBLIC' | 'HIDDEN';
	rights?: string | null;
}

const DEFAULT_RIGHTS = '© DMUN e. V., alle Rechte vorbehalten';

function eventSlug(kind: string, input: EventInput) {
	return slugify(kind === 'CONFERENCE' ? input.edition : `${input.name}-${input.edition}`);
}

async function seriesKind(seriesId: string) {
	const [row] = await db
		.select({ kind: schema.series.kind })
		.from(schema.series)
		.where(eq(schema.series.id, seriesId));
	if (!row) throw new GraphQLError('Unknown series');
	return row.kind;
}

/** New events start hidden unless the admin says otherwise, so they can be prepared. */
export async function createEvent(input: EventInput) {
	const kind = await seriesKind(input.seriesId);
	const taken = await db
		.select({ slug: schema.event.slug })
		.from(schema.event)
		.where(eq(schema.event.seriesId, input.seriesId));
	const [row] = await db
		.insert(schema.event)
		.values({
			...input,
			rights: input.rights || DEFAULT_RIGHTS,
			slug: uniqueSlug(
				eventSlug(kind, input),
				taken.map((t) => t.slug)
			),
			photographers: []
		})
		.returning();
	return row;
}

export async function updateEvent(id: string, input: EventInput) {
	await seriesKind(input.seriesId);
	await db
		.update(schema.event)
		.set({ ...input, rights: input.rights || DEFAULT_RIGHTS })
		.where(eq(schema.event.id, id));
}

/** Events with photos cannot be deleted here, their photos go through the trash first. */
export async function deleteEvent(id: string) {
	const [photos] = await db
		.select({ n: count() })
		.from(schema.media)
		.where(eq(schema.media.eventId, id));
	if ((photos?.n ?? 0) > 0) throw new GraphQLError('Event still has photos');
	await db.delete(schema.event).where(eq(schema.event.id, id));
}

// ── Categories ───────────────────────────────────────────────────────────────────────────

/** Categories reach three levels: main category, sub category, sub sub category. */
const MAX_CATEGORY_DEPTH = 3;

async function categoryRow(id: string) {
	const [row] = await db.select().from(schema.category).where(eq(schema.category.id, id));
	if (!row) throw new GraphQLError('Unknown category');
	return row;
}

async function depthOf(categoryId: string | null): Promise<number> {
	let depth = 0;
	let current = categoryId;
	while (current) {
		depth++;
		current = (await categoryRow(current)).parentId;
	}
	return depth;
}

function siblingsOf(eventId: string, parentId: string | null) {
	return db
		.select()
		.from(schema.category)
		.where(
			and(
				eq(schema.category.eventId, eventId),
				parentId ? eq(schema.category.parentId, parentId) : isNull(schema.category.parentId)
			)
		)
		.orderBy(asc(schema.category.sortOrder));
}

/** A new category must sit below a category of the same event, at most three levels deep. */
async function assertValidParent(eventId: string, parentId: string | null) {
	if (!parentId) return;
	if ((await categoryRow(parentId)).eventId !== eventId) {
		throw new GraphQLError('Parent belongs to another event');
	}
	if ((await depthOf(parentId)) >= MAX_CATEGORY_DEPTH) {
		throw new GraphQLError('Categories reach three levels');
	}
}

export async function createCategory(
	eventId: string,
	parentId: string | null,
	name: string,
	hidden = false
) {
	await assertValidParent(eventId, parentId);
	const siblings = await siblingsOf(eventId, parentId);
	const [row] = await db
		.insert(schema.category)
		.values({
			eventId,
			parentId,
			name: name.trim(),
			hidden,
			slug: uniqueSlug(
				slugify(name),
				siblings.map((s) => s.slug)
			),
			sortOrder: (siblings.at(-1)?.sortOrder ?? -1) + 1
		})
		.returning();
	return row;
}

export async function renameCategory(id: string, name: string) {
	const row = await categoryRow(id);
	const siblings = await siblingsOf(row.eventId, row.parentId);
	const slug = uniqueSlug(
		slugify(name),
		siblings.filter((s) => s.id !== id).map((s) => s.slug)
	);
	await db
		.update(schema.category)
		.set({ name: name.trim(), slug })
		.where(eq(schema.category.id, id));
	return row.eventId;
}

export async function setCategoryHidden(id: string, hidden: boolean) {
	await db.update(schema.category).set({ hidden }).where(eq(schema.category.id, id));
}

/** New order of one level, `orderedIds` are the siblings in their new order. */
export async function reorderCategories(eventId: string, orderedIds: string[]) {
	for (const [i, id] of orderedIds.entries()) {
		await db
			.update(schema.category)
			.set({ sortOrder: i })
			.where(and(eq(schema.category.id, id), eq(schema.category.eventId, eventId)));
	}
}

async function subtreeIds(rootId: string, eventId: string) {
	const all = await db
		.select({ id: schema.category.id, parentId: schema.category.parentId })
		.from(schema.category)
		.where(eq(schema.category.eventId, eventId));
	const ids = [rootId];
	for (let i = 0; i < ids.length; i++) {
		ids.push(...all.filter((c) => c.parentId === ids[i]).map((c) => c.id));
	}
	return ids;
}

/**
 * Deletes a category with its sub categories. Their photos move to `moveTo` (a category of
 * the same event outside the deleted subtree) or end up without category.
 */
export async function deleteCategory(id: string, moveTo: string | null) {
	const row = await categoryRow(id);
	const ids = await subtreeIds(id, row.eventId);
	if (moveTo) {
		if (ids.includes(moveTo))
			throw new GraphQLError('Cannot move photos into the deleted category');
		if ((await categoryRow(moveTo)).eventId !== row.eventId) {
			throw new GraphQLError('Target belongs to another event');
		}
	}
	await db
		.update(schema.media)
		.set({ categoryId: moveTo })
		.where(inArray(schema.media.categoryId, ids));
	await db.delete(schema.category).where(eq(schema.category.id, id));
	return row.eventId;
}

/** Copies the category tree of another event, skipping categories that already exist. */
export async function copyCategories(fromEventId: string, toEventId: string) {
	const source = await db
		.select()
		.from(schema.category)
		.where(eq(schema.category.eventId, fromEventId))
		.orderBy(asc(schema.category.sortOrder));
	const copied = new Map<string, string>();
	const copyLevel = async (parentId: string | null, targetParent: string | null) => {
		const existing = await siblingsOf(toEventId, targetParent);
		for (const node of source.filter((c) => c.parentId === parentId)) {
			const match = existing.find((e) => e.slug === node.slug);
			const target = match ?? (await createCategory(toEventId, targetParent, node.name));
			copied.set(node.id, target.id);
			await copyLevel(node.id, target.id);
		}
	};
	await copyLevel(null, null);
	return copied.size;
}

// ── Photographers ────────────────────────────────────────────────────────────────────────

export async function invitePhotographer(rawEmail: string, invitedById: string) {
	const email = normalizeEmail(rawEmail);
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new GraphQLError('Invalid email');
	await db.insert(schema.photographer).values({ email, invitedById }).onConflictDoNothing();
	return email;
}

/** Revoking the role also removes every event assignment. */
export async function revokePhotographer(rawEmail: string) {
	await db
		.delete(schema.photographer)
		.where(eq(schema.photographer.email, normalizeEmail(rawEmail)));
}

export async function assignPhotographer(eventId: string, rawEmail: string) {
	const email = normalizeEmail(rawEmail);
	const [grant] = await db
		.select()
		.from(schema.photographer)
		.where(eq(schema.photographer.email, email));
	if (!grant) throw new GraphQLError('Not a photographer');
	await db.insert(schema.eventPhotographer).values({ eventId, email }).onConflictDoNothing();
}

export async function unassignPhotographer(eventId: string, rawEmail: string) {
	await db
		.delete(schema.eventPhotographer)
		.where(
			and(
				eq(schema.eventPhotographer.eventId, eventId),
				eq(schema.eventPhotographer.email, normalizeEmail(rawEmail))
			)
		);
}

// ── Settings ─────────────────────────────────────────────────────────────────────────────

/** Queues a fresh render of every photo, used after watermark or size changes. */
async function rerenderAll() {
	const rows = await db
		.select({
			id: schema.media.id,
			key: schema.media.originalKey,
			visibility: schema.media.visibility
		})
		.from(schema.media)
		.where(and(isNull(schema.media.deletedAt), ne(schema.media.status, 'UPLOADING')));
	for (const row of rows) {
		await enqueueJob(db, 'IMAGE_DERIVATIVES', {
			mediaId: row.id,
			bucket: buckets.originals,
			key: row.key,
			public: row.visibility === 'PUBLIC'
		});
	}
	return rows.length;
}

/** Saves watermark and download settings, re-renders every photo when the output changes. */
export async function saveRenderSettings(
	watermark: WatermarkSettings,
	downloads: DownloadSettings,
	userId: string
) {
	const [oldWatermark, oldDownloads] = await Promise.all([
		getSetting(db, 'watermark'),
		getSetting(db, 'downloads')
	]);
	await putSetting(db, 'watermark', watermark, userId);
	await putSetting(db, 'downloads', downloads, userId);
	const changed =
		JSON.stringify(oldWatermark) !== JSON.stringify(watermark) ||
		oldDownloads.preview.longEdge !== downloads.preview.longEdge ||
		oldDownloads.web.longEdge !== downloads.web.longEdge;
	return changed ? rerenderAll() : 0;
}

export async function saveUsageNotes(usage: UsageSettings, userId: string) {
	await putSetting(db, 'usage', usage, userId);
}
