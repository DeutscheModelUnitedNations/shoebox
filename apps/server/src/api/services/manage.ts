import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { enqueueJob, mediaByHash, nextMediaSortOrder } from '@shoebox/db';
import { deletePrefix, nanoid, storageKeys } from '@shoebox/shared';
import { db, schema } from '$api/db';
import {
	duplicateFields,
	flippedIds,
	mediaChangeSet,
	uploadingRow,
	type MediaChanges,
	type UploadFile,
	type UploadTarget,
	type Visibility
} from './mediaRows';
import { buckets, deleteMediaFiles, originalExists, presignUpload, s3 } from './storage';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Throws unless the category exists and belongs to the event. */
export async function assertCategoryInEvent(categoryId: string | null, eventId: string) {
	if (!categoryId) return;
	const [row] = await db
		.select({ eventId: schema.category.eventId })
		.from(schema.category)
		.where(eq(schema.category.id, categoryId));
	if (row?.eventId !== eventId) throw new GraphQLError('Category does not belong to the event');
}

function validateFile(file: UploadFile) {
	if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
		throw new GraphQLError(`Unsupported file type: ${file.name}`);
	}
	if (file.size > MAX_UPLOAD_BYTES) throw new GraphQLError(`File too large: ${file.name}`);
	if (!/^[0-9a-f]{64}$/.test(file.sha256)) throw new GraphQLError(`Invalid hash: ${file.name}`);
}

type KnownHashes = Map<string, { id: string; filename: string }>;

/** One UPLOADING row plus its presigned PUT; exact copies become a held duplicate pair. */
async function prepareOne(
	target: UploadTarget,
	file: UploadFile,
	sortOrder: number,
	known: KnownHashes
) {
	const row = uploadingRow(nanoid(), target, file, sortOrder);
	const duplicateOf = known.get(file.sha256);
	await db.insert(schema.media).values(row);
	if (duplicateOf) {
		await db.insert(schema.duplicateCandidate).values({
			eventId: target.eventId,
			mediaId: duplicateOf.id,
			otherMediaId: row.id,
			similarity: 100
		});
	} else {
		// Later files of the same batch are compared against this one too
		known.set(file.sha256, { id: row.id, filename: row.originalFilename });
	}
	return {
		mediaId: row.id,
		uploadUrl: await presignUpload(row.originalKey, file.type),
		...duplicateFields(duplicateOf)
	};
}

/**
 * Creates one media row per file in state UPLOADING and hands back a presigned PUT for each.
 * Exact copies of a photo already in the event are recorded as duplicate candidates and stay
 * HELD after the upload until someone decides in the duplicate review.
 */
export async function prepareUploads(target: UploadTarget, files: UploadFile[]) {
	files.forEach(validateFile);
	await assertCategoryInEvent(target.categoryId, target.eventId);
	const hashes = files.map((f) => f.sha256);
	const known: KnownHashes = hashes.length
		? await mediaByHash(db, target.eventId, hashes)
		: new Map();
	let sortOrder = await nextMediaSortOrder(db, target.eventId);
	const prepared = [];
	for (const file of files) prepared.push(await prepareOne(target, file, sortOrder++, known));
	return prepared;
}

/** Media rows the person may touch: in events they manage, given as id → event id. */
export async function eventsOf(mediaIds: string[]) {
	if (mediaIds.length === 0) return new Map<string, string>();
	const rows = await db
		.select({ id: schema.media.id, eventId: schema.media.eventId })
		.from(schema.media)
		.where(inArray(schema.media.id, mediaIds));
	return new Map(rows.map((r) => [r.id, r.eventId]));
}

async function heldIds(mediaIds: string[]) {
	const rows = await db
		.select({ id: schema.duplicateCandidate.otherMediaId })
		.from(schema.duplicateCandidate)
		.where(
			and(
				inArray(schema.duplicateCandidate.otherMediaId, mediaIds),
				eq(schema.duplicateCandidate.similarity, 100)
			)
		);
	return new Set(rows.map((r) => r.id));
}

/** Marks finished uploads for processing. Files that never arrived stay UPLOADING. */
export async function completeUploads(mediaIds: string[]) {
	const rows = await db
		.select()
		.from(schema.media)
		.where(and(inArray(schema.media.id, mediaIds), eq(schema.media.status, 'UPLOADING')));
	const held = await heldIds(rows.map((r) => r.id));
	let queued = 0;
	for (const row of rows) {
		if (!(await originalExists(row.originalKey))) continue;
		await db
			.update(schema.media)
			.set({ status: held.has(row.id) ? 'HELD' : 'PENDING' })
			.where(eq(schema.media.id, row.id));
		await enqueueJob(db, 'IMAGE_DERIVATIVES', {
			mediaId: row.id,
			bucket: buckets.originals,
			key: row.originalKey,
			public: row.visibility === 'PUBLIC',
			detectDuplicates: true
		});
		queued++;
	}
	return queued;
}

/** Drops uploads the browser gave up on, they never became visible. */
export async function abandonUploads(mediaIds: string[]) {
	const rows = await db
		.delete(schema.media)
		.where(and(inArray(schema.media.id, mediaIds), eq(schema.media.status, 'UPLOADING')))
		.returning({ id: schema.media.id });
	for (const { id } of rows) await deleteMediaFiles(id);
	return rows.length;
}

/** Re-renders derivatives, e.g. after a visibility change moved them between buckets. */
async function rerender(mediaIds: string[]) {
	const rows = await db.select().from(schema.media).where(inArray(schema.media.id, mediaIds));
	for (const row of rows) {
		await enqueueJob(db, 'IMAGE_DERIVATIVES', {
			mediaId: row.id,
			bucket: buckets.originals,
			key: row.originalKey,
			public: row.visibility === 'PUBLIC'
		});
	}
}

/** Moves derivatives of photos whose visibility changed to the right bucket. */
async function applyVisibility(
	before: { id: string; visibility: Visibility }[],
	visibility: Visibility | null | undefined
) {
	const flipped = flippedIds(before, visibility);
	if (flipped.length === 0) return;
	// Team-only photos must leave the public bucket right away
	if (visibility === 'TEAM') {
		for (const id of flipped) await deletePrefix(s3, buckets.derivatives, `media/${id}/`);
	}
	await rerender(flipped);
}

/** Bulk edit from the manage view. Only the given fields change. */
export async function updateMedia(eventId: string, mediaIds: string[], changes: MediaChanges) {
	if (changes.moveCategory) await assertCategoryInEvent(changes.categoryId ?? null, eventId);
	const set = mediaChangeSet(changes);
	if (Object.keys(set).length === 0) return 0;

	const scope = and(inArray(schema.media.id, mediaIds), eq(schema.media.eventId, eventId));
	const before = await db
		.select({ id: schema.media.id, visibility: schema.media.visibility })
		.from(schema.media)
		.where(scope);
	const updated = await db
		.update(schema.media)
		.set(set)
		.where(scope)
		.returning({ id: schema.media.id });
	await applyVisibility(before, changes.visibility);
	return updated.length;
}

/** Applies a new order, `orderedIds` is the complete list of one category view. */
export async function reorderMedia(eventId: string, orderedIds: string[]) {
	const sortOrders = await db
		.select({ id: schema.media.id, sortOrder: schema.media.sortOrder })
		.from(schema.media)
		.where(and(inArray(schema.media.id, orderedIds), eq(schema.media.eventId, eventId)));
	// Reuse the slots the photos already occupy, so photos outside this view keep their place
	const slots = sortOrders.map((r) => r.sortOrder).sort((a, b) => a - b);
	const known = new Set(sortOrders.map((r) => r.id));
	const ids = orderedIds.filter((id) => known.has(id));
	for (const [i, id] of ids.entries()) {
		await db.update(schema.media).set({ sortOrder: slots[i] }).where(eq(schema.media.id, id));
	}
	return ids.length;
}

export async function setEventCover(eventId: string, mediaId: string) {
	const events = await eventsOf([mediaId]);
	if (events.get(mediaId) !== eventId) throw new GraphQLError('Photo is not in this event');
	await db
		.update(schema.event)
		.set({ coverMediaId: mediaId, heroMediaId: mediaId })
		.where(eq(schema.event.id, eventId));
	// The processor adds the banner size for hero photos, render it once if it is missing
	const [row] = await db
		.select({ derivatives: schema.media.derivatives })
		.from(schema.media)
		.where(eq(schema.media.id, mediaId));
	const bannerKey = storageKeys.derivative(mediaId, 'hero', 'webp');
	if (row && !row.derivatives.some((d) => d.key === bannerKey)) await rerender([mediaId]);
}

/** Moves photos to the trash. Open duplicate pairs involving them are dropped. */
export async function trashMedia(eventId: string, mediaIds: string[]) {
	const scope = and(inArray(schema.media.id, mediaIds), eq(schema.media.eventId, eventId));
	const rows = await db
		.update(schema.media)
		.set({ deletedAt: new Date() })
		.where(scope)
		.returning({ id: schema.media.id });
	const ids = rows.map((r) => r.id);
	if (ids.length > 0) {
		await db
			.delete(schema.duplicateCandidate)
			.where(
				or(
					inArray(schema.duplicateCandidate.mediaId, ids),
					inArray(schema.duplicateCandidate.otherMediaId, ids)
				)
			);
	}
	return ids.length;
}

export async function restoreMedia(eventId: string, mediaIds: string[]) {
	const rows = await db
		.update(schema.media)
		.set({ deletedAt: null })
		.where(
			and(
				inArray(schema.media.id, mediaIds),
				eq(schema.media.eventId, eventId),
				isNotNull(schema.media.deletedAt)
			)
		)
		.returning({ id: schema.media.id });
	return rows.length;
}

/** Deletes trashed photos for good, objects first. */
export async function deleteForever(eventId: string, mediaIds: string[]) {
	const rows = await db
		.select({ id: schema.media.id })
		.from(schema.media)
		.where(
			and(
				inArray(schema.media.id, mediaIds),
				eq(schema.media.eventId, eventId),
				isNotNull(schema.media.deletedAt)
			)
		);
	for (const { id } of rows) await deleteMediaFiles(id);
	if (rows.length > 0) {
		await db.delete(schema.media).where(
			inArray(
				schema.media.id,
				rows.map((r) => r.id)
			)
		);
	}
	return rows.length;
}

export type DuplicateKeep = 'LEFT' | 'RIGHT' | 'BOTH';

/** A held photo that is kept becomes visible, or waits for the processor to finish. */
async function release(mediaId: string) {
	const [row] = await db.select().from(schema.media).where(eq(schema.media.id, mediaId));
	if (row?.status !== 'HELD') return;
	await db
		.update(schema.media)
		.set({ status: row.derivatives.length > 0 ? 'READY' : 'PENDING' })
		.where(eq(schema.media.id, mediaId));
}

/** Removes the photo that lost a duplicate decision: held ones were never public, they go for good. */
async function discard(eventId: string, mediaId: string) {
	const [row] = await db.select().from(schema.media).where(eq(schema.media.id, mediaId));
	if (!row) return;
	if (row.status === 'HELD') {
		await deleteMediaFiles(mediaId);
		await db.delete(schema.media).where(eq(schema.media.id, mediaId));
	} else {
		await trashMedia(eventId, [mediaId]);
	}
}

type Pair = typeof schema.duplicateCandidate.$inferSelect;

/** What each decision does with the two photos of a pair. */
const decisions: Record<DuplicateKeep, (eventId: string, pair: Pair) => Promise<void>> = {
	LEFT: (eventId, pair) => discard(eventId, pair.otherMediaId),
	RIGHT: async (eventId, pair) => {
		await release(pair.otherMediaId);
		await discard(eventId, pair.mediaId);
	},
	BOTH: async (_eventId, pair) => {
		await release(pair.otherMediaId);
		await release(pair.mediaId);
	}
};

/** Applies one decision of the duplicate review. */
export async function resolveDuplicate(eventId: string, candidateId: string, keep: DuplicateKeep) {
	const [pair] = await db
		.select()
		.from(schema.duplicateCandidate)
		.where(
			and(
				eq(schema.duplicateCandidate.id, candidateId),
				eq(schema.duplicateCandidate.eventId, eventId)
			)
		);
	if (!pair) return false;
	await db.delete(schema.duplicateCandidate).where(eq(schema.duplicateCandidate.id, candidateId));
	await decisions[keep](eventId, pair);
	return true;
}
