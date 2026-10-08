import { GraphQLError } from 'graphql';
import { configPrivate } from '$config/private';

function matches(email: string, emails: string[], domains: string[]) {
	const normalized = email.trim().toLowerCase();
	const domain = normalized.split('@')[1] ?? '';
	return (
		emails.some((e) => e.toLowerCase() === normalized) ||
		domains.some((d) => d.toLowerCase() === domain)
	);
}

/** Admins manage everything and grant per-conference editing rights. */
export function isAdminEmail(email: string | null | undefined) {
	if (!email) return false;
	return matches(email, configPrivate.ADMIN_EMAIL_WHITELIST, configPrivate.ADMIN_DOMAIN_WHITELIST);
}

/** Team members see team-private media. Every admin is a team member. */
export function isTeamEmail(email: string | null | undefined) {
	if (!email) return false;
	return (
		isAdminEmail(email) ||
		matches(email, configPrivate.TEAM_EMAIL_WHITELIST, configPrivate.TEAM_DOMAIN_WHITELIST)
	);
}

type RoleContext = { isAdmin: boolean; isTeam: boolean; user?: { sub: string } };

export function requireLoggedIn<C extends RoleContext>(ctx: C) {
	if (!ctx.user) throw new GraphQLError('Must be logged in');
	return ctx.user;
}

export function requireTeam<C extends RoleContext>(ctx: C) {
	requireLoggedIn(ctx);
	if (!ctx.isTeam) throw new GraphQLError('Team members only');
}

export function requireAdmin<C extends RoleContext>(ctx: C) {
	requireLoggedIn(ctx);
	if (!ctx.isAdmin) throw new GraphQLError('Admins only');
}
