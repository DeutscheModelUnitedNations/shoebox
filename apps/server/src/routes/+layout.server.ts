import type { LayoutServerLoad } from './$types';
import { isAdminEmail, isTeamEmail } from '$api/services/authHelper';

export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.oidc?.user ?? null;
	return {
		user,
		isTeam: isTeamEmail(user?.email),
		isAdmin: isAdminEmail(user?.email)
	};
};
