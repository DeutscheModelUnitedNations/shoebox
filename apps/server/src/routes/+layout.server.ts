import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const { isAdmin, isTeam, isPhotographer } = locals.roles;
	return { user: locals.oidc?.user ?? null, isTeam, isAdmin, isPhotographer };
};
