/** Data for the manage and admin pages that is more than a single loader call. */
import { and, asc, count, desc, eq, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { db, schema } from '$api/db';
import { isAdminEmail, isTeamEmail } from '$api/services/authHelper';
import { normalizeEmail } from '$api/services/roles';
import { flattenCategories } from '$lib/studio/categories';
import { fullName, type PersonRole } from '$lib/studio/people';
import type { StudioCategory } from '$lib/studio/types';
import { loadCategories, subtree, type MediaFilter } from './load';

const fixedFilters: Record<string, MediaFilter> = {
	none: { kind: 'none' },
	highlights: { kind: 'highlights' }
};

/** Which photos the manage view shows, from `?batch=`, `?category=` (an id, `none` or `highlights`). */
export function filterFromUrl(url: URL, tree: StudioCategory[]): MediaFilter {
	const batch = url.searchParams.get('batch');
	const category = url.searchParams.get('category');
	if (batch) return { kind: 'batch', batch };
	if (!category) return { kind: 'all' };
	return fixedFilters[category] ?? { kind: 'category', ids: subtree(tree, category) };
}

async function countOf(
	table: typeof schema.media | typeof schema.duplicateCandidate,
	where: ReturnType<typeof and>
) {
	const [row] = await db.select({ n: count() }).from(table).where(where);
	return row?.n ?? 0;
}

/** Header numbers of the manage view: team-only photos, highlights, open duplicates, trash. */
export async function manageStats(eventId: string) {
	const live = and(
		eq(schema.media.eventId, eventId),
		isNull(schema.media.deletedAt),
		ne(schema.media.status, 'UPLOADING')
	);
	const [team, highlights, duplicates, trash] = await Promise.all([
		countOf(schema.media, and(live, eq(schema.media.visibility, 'TEAM'))),
		countOf(schema.media, and(live, eq(schema.media.highlight, true))),
		countOf(schema.duplicateCandidate, eq(schema.duplicateCandidate.eventId, eventId)),
		countOf(schema.media, and(eq(schema.media.eventId, eventId), isNotNull(schema.media.deletedAt)))
	]);
	return { team, highlights, duplicates, trash };
}

const userByEmail = (
	email: typeof schema.photographer.email | typeof schema.eventPhotographer.email
) => eq(sql`lower(${schema.user.email})`, email);

/** Photographers assigned to an event, with how many photos they uploaded there. */
export async function eventPhotographers(eventId: string) {
	const rows = await db
		.select({
			email: schema.eventPhotographer.email,
			givenName: schema.user.givenName,
			familyName: schema.user.familyName,
			photos: sql<number>`(select count(*) from ${schema.media} where ${schema.media.uploadedById} = ${schema.user.id} and ${schema.media.eventId} = ${eventId})`
		})
		.from(schema.eventPhotographer)
		.leftJoin(schema.user, userByEmail(schema.eventPhotographer.email))
		.where(eq(schema.eventPhotographer.eventId, eventId));
	return rows.map((r) => ({ email: r.email, name: fullName(r), photos: Number(r.photos) }));
}

/** Everyone with the photographer role, for the "add person" select. */
export async function allPhotographers() {
	const rows = await db
		.select({
			email: schema.photographer.email,
			givenName: schema.user.givenName,
			familyName: schema.user.familyName
		})
		.from(schema.photographer)
		.leftJoin(schema.user, userByEmail(schema.photographer.email))
		.orderBy(asc(schema.photographer.email));
	return rows.map((r) => ({ email: r.email, name: fullName(r) }));
}

/** The edition before this one in the same series, for "copy categories from". */
export async function previousEvent(event: { seriesId: string; dateFrom: string }) {
	const [row] = await db
		.select({ id: schema.event.id, name: schema.event.name, edition: schema.event.edition })
		.from(schema.event)
		.where(
			and(eq(schema.event.seriesId, event.seriesId), lt(schema.event.dateFrom, event.dateFrom))
		)
		.orderBy(desc(schema.event.dateFrom))
		.limit(1);
	return row ?? null;
}

export async function hasPhotos(eventId: string) {
	return (await countOf(schema.media, eq(schema.media.eventId, eventId))) > 0;
}

/** Category select options for each event, keyed by event id. */
export async function categoryOptionsByEvent(eventIds: string[]) {
	const entries = await Promise.all(
		eventIds.map(async (id) => [id, flattenCategories((await loadCategories(id)).tree)] as const)
	);
	return Object.fromEntries(entries);
}

interface Person {
	email: string;
	name: string | null;
	role: PersonRole;
	/** Admin and team come from the configuration and cannot be changed here */
	fromConfig: boolean;
	events: string[];
	lastSeenAt: string | null;
	/** Granted but never signed in */
	invitedAt: string | null;
}

function roleOf(email: string, photographers: Set<string>): PersonRole {
	if (isAdminEmail(email)) return 'ADMIN';
	if (photographers.has(email)) return 'PHOTOGRAPHER';
	return isTeamEmail(email) ? 'TEAM' : 'GUEST';
}

/** Everyone who signed in, plus photographer invitations nobody used yet. */
export async function listPeople(): Promise<Person[]> {
	const [users, grants, assignments] = await Promise.all([
		db.select().from(schema.user).orderBy(asc(schema.user.familyName)),
		db.select().from(schema.photographer),
		db
			.select({
				email: schema.eventPhotographer.email,
				name: schema.event.name,
				edition: schema.event.edition
			})
			.from(schema.eventPhotographer)
			.innerJoin(schema.event, eq(schema.eventPhotographer.eventId, schema.event.id))
	]);
	const granted = new Set(grants.map((g) => g.email));
	const eventsOf = (email: string) =>
		assignments.filter((a) => a.email === email).map((a) => `${a.name} ${a.edition}`);

	const people: Person[] = users.map((u) => {
		const email = normalizeEmail(u.email);
		const role = roleOf(email, granted);
		return {
			email,
			name: fullName(u),
			role,
			fromConfig: role === 'ADMIN' || role === 'TEAM',
			events: eventsOf(email),
			lastSeenAt: (u.lastSeenAt ?? u.updatedAt).toISOString(),
			invitedAt: null
		};
	});
	const known = new Set(people.map((p) => p.email));
	const pending = grants
		.filter((g) => !known.has(g.email))
		.map((g) => ({
			email: g.email,
			name: null,
			role: 'PHOTOGRAPHER' as const,
			fromConfig: false,
			events: eventsOf(g.email),
			lastSeenAt: null,
			invitedAt: g.createdAt.toISOString()
		}));
	return [...people, ...pending];
}
