import { isTeamEmail } from '$api/services/authHelper';
import type { Viewer } from './index';

export function viewerOf(locals: App.Locals): Viewer {
	return { isTeam: isTeamEmail(locals.oidc?.user?.email) };
}
