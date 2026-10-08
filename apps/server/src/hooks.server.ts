import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { OIDC } from '$api/services/OIDC';
import { guestRoles, resolveRoles, touchLastSeen } from '$api/services/roles';

const i18n: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});

/** Admin, team and photographer rights for the signed-in person, once per request. */
const roles: Handle = async ({ event, resolve }) => {
	const user = event.locals.oidc?.user;
	event.locals.roles = user ? await resolveRoles(user.email) : guestRoles;
	if (user) void touchLastSeen(user.sub).catch(() => {});
	return resolve(event);
};

export const handle: Handle = sequence(OIDC.handle, roles, i18n);
