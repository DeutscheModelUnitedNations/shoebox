import type { RequestEvent } from '@sveltejs/kit';
import { GraphQLError } from 'graphql';
import { isAdminEmail, isTeamEmail } from './services/authHelper';

/** Request context handed to every ability and resolver. */
export function context(req: RequestEvent) {
	const user = req.locals.oidc?.user;
	const email = user?.email ?? undefined;

	return {
		...req.locals,
		user,
		isAdmin: isAdminEmail(email),
		isTeam: isTeamEmail(email),
		mustBeLoggedIn: () => {
			if (!user) throw new GraphQLError('Must be logged in');
			return user;
		}
	};
}

export type Context = ReturnType<typeof context>;
