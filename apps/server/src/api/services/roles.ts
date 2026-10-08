import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { db, schema } from '$api/db';
import { isAdminEmail, isTeamEmail } from './authHelper';

/**
 * What the signed-in person may do. Admin and team come from the env whitelists, the
 * Fotograf*in role from the `photographer` table. Photographers have team rights everywhere
 * and manage the events they are assigned to, admins manage everything.
 */
export interface Roles {
	email: string | null;
	isAdmin: boolean;
	isTeam: boolean;
	isPhotographer: boolean;
	/** Events this person may upload to and manage (all of them for admins, see `canManage`) */
	eventIds: string[];
}

export const guestRoles: Roles = {
	email: null,
	isAdmin: false,
	isTeam: false,
	isPhotographer: false,
	eventIds: []
};

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export async function resolveRoles(rawEmail: string | null | undefined): Promise<Roles> {
	if (!rawEmail) return guestRoles;
	const email = normalizeEmail(rawEmail);
	const isAdmin = isAdminEmail(email);
	const [grant] = await db
		.select({ email: schema.photographer.email })
		.from(schema.photographer)
		.where(eq(schema.photographer.email, email));
	const isPhotographer = !!grant;
	const assigned = isPhotographer
		? await db
				.select({ eventId: schema.eventPhotographer.eventId })
				.from(schema.eventPhotographer)
				.where(eq(schema.eventPhotographer.email, email))
		: [];
	return {
		email,
		isAdmin,
		isTeam: isAdmin || isPhotographer || isTeamEmail(email),
		isPhotographer,
		eventIds: assigned.map((a) => a.eventId)
	};
}

/** Admins manage every event, photographers the ones assigned to them. */
export function canManage(roles: Roles, eventId: string) {
	return roles.isAdmin || roles.eventIds.includes(eventId);
}

/** Admins and photographers reach the upload and manage area. */
export function canUpload(roles: Roles) {
	return roles.isAdmin || roles.isPhotographer;
}

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

/** Records activity for the users admin, at most every few minutes per person. */
export async function touchLastSeen(userId: string) {
	const threshold = new Date(Date.now() - LAST_SEEN_THROTTLE_MS);
	await db
		.update(schema.user)
		.set({ lastSeenAt: new Date() })
		.where(
			and(
				eq(schema.user.id, userId),
				or(isNull(schema.user.lastSeenAt), lt(schema.user.lastSeenAt, threshold))
			)
		);
}
