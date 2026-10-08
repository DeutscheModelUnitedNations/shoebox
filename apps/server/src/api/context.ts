import type { RequestEvent } from '@sveltejs/kit';
import { GraphQLError } from 'graphql';
import { canManage, canUpload } from './services/roles';

/** Request context handed to every ability and resolver. */
export function context(req: RequestEvent) {
	const user = req.locals.oidc?.user;
	const roles = req.locals.roles;

	return {
		...req.locals,
		user,
		isAdmin: roles.isAdmin,
		isTeam: roles.isTeam,
		isPhotographer: roles.isPhotographer,
		mustBeLoggedIn: () => {
			if (!user) throw new GraphQLError('Must be logged in');
			return user;
		},
		/** Throws unless the person may upload to and manage this event */
		mustManage: (eventId: string) => {
			if (!user || !canManage(roles, eventId)) throw new GraphQLError('Not allowed');
			return user;
		},
		mustUpload: () => {
			if (!user || !canUpload(roles)) throw new GraphQLError('Not allowed');
			return user;
		}
	};
}

export type Context = ReturnType<typeof context>;
