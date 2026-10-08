import type { Viewer } from './tree';

export function viewerOf(locals: App.Locals): Viewer {
	const { isTeam, isAdmin, eventIds } = locals.roles;
	return { isTeam, isAdmin, eventIds };
}
