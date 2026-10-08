import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
	sql,
	type SQL
} from 'drizzle-orm';
import { storageKeys } from '@shoebox/shared';
import { db, schema } from '$api/db';
import type { Roles } from '$api/services/roles';
import type { DateRange } from '$lib/gallery/types';
import { derivativeUrl } from '$lib/server/gallery/load';
import type { DuplicatePair, StudioCategory, StudioEvent, StudioMedia } from '$lib/studio/types';
import { fullName } from '$lib/studio/people';
import { placeholderUrl } from '$lib/server/placeholder';

type MediaRow = typeof schema.media.$inferSelect;
type EventRow = typeof schema.event.$inferSelect;
type CategoryRow = typeof schema.category.$inferSelect;

/** Media that exists for the manage view: not trashed, upload finished. */
const live = and(isNull(schema.media.deletedAt), ne(schema.media.status, 'UPLOADING'));

/** The watermark-free copy of a variant where there is one, else the regular derivative. */
function shownUrl(row: MediaRow, variant: string) {
	const keys = [
		storageKeys.cleanDerivative(row.id, variant, 'webp'),
		storageKeys.derivative(row.id, variant, 'webp')
	];
	const derivative = keys.map((k) => row.derivatives.find((d) => d.key === k)).find(Boolean);
	return derivative ? derivativeUrl(derivative) : null;
}

export async function toStudioMedia(
	row: MediaRow,
	extra: { coverId?: string | null; duplicates?: Set<string> } = {}
): Promise<StudioMedia> {
	const [thumbUrl, mediumUrl, largeUrl] = await Promise.all(
		['thumb', 'medium', 'large'].map((variant) => shownUrl(row, variant))
	);
	return {
		id: row.id,
		title: row.title,
		filename: row.originalFilename,
		photographer: row.photographer,
		visibility: row.visibility,
		status: row.status,
		thumbUrl,
		mediumUrl,
		placeholder: placeholderUrl(row.blurhash, row),
		largeUrl,
		width: row.width,
		height: row.height,
		bytes: row.bytes,
		takenAt: row.takenAt?.toISOString() ?? null,
		categoryId: row.categoryId,
		isCover: row.id === extra.coverId,
		highlight: row.highlight,
		duplicate: extra.duplicates?.has(row.id) ?? false,
		deletedAt: row.deletedAt?.toISOString() ?? null
	};
}

function datesOf(e: EventRow): DateRange {
	return {
		from: e.dateFrom,
		to: e.dateTo ?? undefined,
		precision: e.datePrecision.toLowerCase() as DateRange['precision']
	};
}

/** Original plus every derivative, what an event costs in the buckets. */
function storageOf(rows: Pick<MediaRow, 'bytes' | 'derivatives'>[]) {
	return rows.reduce(
		(sum, m) => sum + (m.bytes ?? 0) + m.derivatives.reduce((s, d) => s + d.bytes, 0),
		0
	);
}

async function photographersOf(eventIds: string[]) {
	if (eventIds.length === 0) return [];
	return await db
		.select({
			eventId: schema.eventPhotographer.eventId,
			email: schema.eventPhotographer.email,
			givenName: schema.user.givenName,
			familyName: schema.user.familyName
		})
		.from(schema.eventPhotographer)
		.leftJoin(schema.user, eq(sql`lower(${schema.user.email})`, schema.eventPhotographer.email))
		.where(inArray(schema.eventPhotographer.eventId, eventIds));
}

/** Events with their counts, all of them for admins, the assigned ones for photographers. */
export async function listStudioEvents(roles: Roles): Promise<StudioEvent[]> {
	const scope = roles.isAdmin ? undefined : inArray(schema.event.id, roles.eventIds);
	if (!roles.isAdmin && roles.eventIds.length === 0) return [];
	const events = await eventsWithSeries(scope);
	const ids = events.map((e) => e.event.id);
	if (ids.length === 0) return [];

	const [media, categories, duplicates, photographers] = await Promise.all([
		db
			.select({
				id: schema.media.id,
				eventId: schema.media.eventId,
				visibility: schema.media.visibility,
				bytes: schema.media.bytes,
				derivatives: schema.media.derivatives
			})
			.from(schema.media)
			.where(and(inArray(schema.media.eventId, ids), live)),
		db
			.select({ eventId: schema.category.eventId, n: count() })
			.from(schema.category)
			.where(and(inArray(schema.category.eventId, ids), isNull(schema.category.parentId)))
			.groupBy(schema.category.eventId),
		db
			.select({ eventId: schema.duplicateCandidate.eventId, n: count() })
			.from(schema.duplicateCandidate)
			.where(inArray(schema.duplicateCandidate.eventId, ids))
			.groupBy(schema.duplicateCandidate.eventId),
		photographersOf(ids)
	]);
	const covers = await db
		.select()
		.from(schema.media)
		.where(
			inArray(
				schema.media.id,
				events.flatMap((e) => (e.event.coverMediaId ? [e.event.coverMediaId] : []))
			)
		);

	return Promise.all(
		events.map(async ({ event, series }) => {
			const own = media.filter((m) => m.eventId === event.id);
			const cover = covers.find((c) => c.id === event.coverMediaId);
			return {
				id: event.id,
				seriesId: series.id,
				seriesSlug: series.slug,
				seriesShortName: series.shortName,
				slug: event.slug,
				name: event.name,
				edition: event.edition,
				subtitle: event.subtitle,
				location: event.location,
				description: event.description,
				rights: event.rights,
				dates: datesOf(event),
				visibility: event.visibility,
				photoCount: own.length,
				teamCount: own.filter((m) => m.visibility === 'TEAM').length,
				duplicateCount: duplicates.find((d) => d.eventId === event.id)?.n ?? 0,
				categoryCount: categories.find((c) => c.eventId === event.id)?.n ?? 0,
				storageBytes: storageOf(own),
				coverUrl: cover ? await shownUrl(cover, 'thumb') : null,
				photographers: photographers
					.filter((p) => p.eventId === event.id)
					.map((p) => ({
						email: p.email,
						name: fullName(p),
						photoCount: 0
					}))
			};
		})
	);
}

/** Nests the categories and counts photos per subtree. */
export function categoryTree(rows: CategoryRow[], counts: Map<string | null, number>) {
	const nodes = new Map<string, StudioCategory>(
		rows.map((c) => [
			c.id,
			{
				id: c.id,
				parentId: c.parentId,
				name: c.name,
				slug: c.slug,
				hidden: c.hidden,
				depth: 1,
				count: counts.get(c.id) ?? 0,
				children: []
			}
		])
	);
	const roots: StudioCategory[] = [];
	for (const c of rows) {
		const node = nodes.get(c.id)!;
		const parent = c.parentId ? nodes.get(c.parentId) : undefined;
		(parent ? parent.children : roots).push(node);
	}
	const finish = (node: StudioCategory, depth: number): number => {
		node.depth = depth;
		node.count += node.children.reduce((sum, child) => sum + finish(child, depth + 1), 0);
		return node.count;
	};
	roots.forEach((r) => finish(r, 1));
	return roots;
}

/** All categories of an event below `id`, including itself. */
export function subtree(roots: StudioCategory[], id: string): string[] {
	const find = (nodes: StudioCategory[]): StudioCategory | undefined =>
		nodes.reduce<StudioCategory | undefined>(
			(found, n) => found ?? (n.id === id ? n : find(n.children)),
			undefined
		);
	const collect = (n: StudioCategory): string[] => [n.id, ...n.children.flatMap(collect)];
	const node = find(roots);
	return node ? collect(node) : [];
}

export async function loadCategories(eventId: string) {
	const [rows, counts] = await Promise.all([
		db
			.select()
			.from(schema.category)
			.where(eq(schema.category.eventId, eventId))
			.orderBy(asc(schema.category.sortOrder)),
		db
			.select({ categoryId: schema.media.categoryId, n: count() })
			.from(schema.media)
			.where(and(eq(schema.media.eventId, eventId), live))
			.groupBy(schema.media.categoryId)
	]);
	const byCategory = new Map(counts.map((c) => [c.categoryId, c.n]));
	return { tree: categoryTree(rows, byCategory), uncategorized: byCategory.get(null) ?? 0 };
}

export type MediaFilter =
	| { kind: 'all' }
	| { kind: 'none' }
	| { kind: 'highlights' }
	| { kind: 'category'; ids: string[] }
	| { kind: 'batch'; batch: string };

async function openDuplicateIds(eventId: string) {
	const pairs = await db
		.select({ a: schema.duplicateCandidate.mediaId, b: schema.duplicateCandidate.otherMediaId })
		.from(schema.duplicateCandidate)
		.where(eq(schema.duplicateCandidate.eventId, eventId));
	return new Set(pairs.flatMap((p) => [p.a, p.b]));
}

/** Photos of the manage view, in gallery order or by capture time. */
export async function loadStudioMedia(
	event: Pick<EventRow, 'id' | 'coverMediaId'>,
	filter: MediaFilter,
	sort: 'custom' | 'taken'
) {
	const conditions = [eq(schema.media.eventId, event.id), live];
	if (filter.kind === 'none') conditions.push(isNull(schema.media.categoryId));
	if (filter.kind === 'highlights') conditions.push(eq(schema.media.highlight, true));
	if (filter.kind === 'category') conditions.push(inArray(schema.media.categoryId, filter.ids));
	if (filter.kind === 'batch') conditions.push(eq(schema.media.uploadBatch, filter.batch));
	const [rows, duplicates] = await Promise.all([
		db
			.select()
			.from(schema.media)
			.where(and(...conditions))
			.orderBy(
				sort === 'taken' ? asc(schema.media.takenAt) : asc(schema.media.sortOrder),
				asc(schema.media.createdAt)
			),
		openDuplicateIds(event.id)
	]);
	return Promise.all(
		rows.map((r) => toStudioMedia(r, { coverId: event.coverMediaId, duplicates }))
	);
}

export async function loadTrash(eventId: string) {
	const rows = await db
		.select()
		.from(schema.media)
		.where(and(eq(schema.media.eventId, eventId), isNotNull(schema.media.deletedAt)))
		.orderBy(desc(schema.media.deletedAt));
	return Promise.all(rows.map((r) => toStudioMedia(r)));
}

export async function loadDuplicatePairs(eventId: string): Promise<DuplicatePair[]> {
	const pairs = await db
		.select()
		.from(schema.duplicateCandidate)
		.where(eq(schema.duplicateCandidate.eventId, eventId))
		.orderBy(desc(schema.duplicateCandidate.similarity));
	const ids = pairs.flatMap((p) => [p.mediaId, p.otherMediaId]);
	if (ids.length === 0) return [];
	const [rows, categories] = await Promise.all([
		db.select().from(schema.media).where(inArray(schema.media.id, ids)),
		db
			.select({ id: schema.category.id, name: schema.category.name })
			.from(schema.category)
			.where(eq(schema.category.eventId, eventId))
	]);
	const media = new Map(
		await Promise.all(rows.map(async (r) => [r.id, await toStudioMedia(r)] as const))
	);
	const categoryName = (m: StudioMedia) =>
		categories.find((c) => c.id === m.categoryId)?.name ?? null;
	return pairs.flatMap((p) => {
		const left = media.get(p.mediaId);
		const right = media.get(p.otherMediaId);
		if (!left || !right) return [];
		return [
			{
				id: p.id,
				similarity: p.similarity,
				left,
				right,
				leftCategory: categoryName(left),
				rightCategory: categoryName(right)
			}
		];
	});
}

/** Events joined with their series, newest first. */
function eventsWithSeries(where: SQL | undefined) {
	return db
		.select({ event: schema.event, series: schema.series })
		.from(schema.event)
		.innerJoin(schema.series, eq(schema.event.seriesId, schema.series.id))
		.where(where)
		.orderBy(desc(schema.event.dateFrom));
}

export async function loadEventRow(eventId: string) {
	const [row] = await eventsWithSeries(eq(schema.event.id, eventId));
	return row;
}
