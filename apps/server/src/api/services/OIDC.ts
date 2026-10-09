import { makeOIDC } from '@m1212e/sveltekit-oidc';
import { building, dev } from '$app/environment';
import { db, schema } from '$api/db';
import { configPrivate } from '$config/private';
import { configPublic } from '$config/public';

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Normalize claims across providers. Logto sends `username` instead of `preferred_username`
 * and a single `name` instead of `given_name` / `family_name`.
 */
export function normalizeClaims(claims: Record<string, unknown>) {
	const sub = asString(claims.sub);
	if (!sub) throw new Error('OIDC claim "sub" is missing');
	const email = asString(claims.email);
	if (!email) throw new Error('OIDC claim "email" is missing');

	let givenName = asString(claims.given_name);
	let familyName = asString(claims.family_name);
	const name = asString(claims.name);
	if ((!givenName || !familyName) && name) {
		const parts = name.trim().split(/\s+/);
		givenName = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
		familyName = parts.length > 1 ? parts[parts.length - 1] : name;
	}

	return {
		id: sub,
		email,
		givenName: givenName ?? '',
		familyName: familyName ?? '',
		preferredUsername: asString(claims.preferred_username) ?? asString(claims.username) ?? email,
		locale: asString(claims.locale) ?? configPublic.PUBLIC_DEFAULT_LOCALE
	};
}

export const OIDC = !building
	? await makeOIDC({
			development: dev,
			oidcAuthority: configPublic.PUBLIC_OIDC_AUTHORITY,
			oidcClientId: configPublic.PUBLIC_OIDC_CLIENT_ID,
			oidcClientSecret: configPrivate.OIDC_CLIENT_SECRET,
			oidcScope: configPrivate.OIDC_SCOPES,
			loginCallbackRoute: configPublic.PUBLIC_OIDC_LOGIN_CALLBACK_ROUTE,
			logoutCallbackRoute: configPublic.PUBLIC_OIDC_LOGOUT_CALLBACK_ROUTE,
			// Visiting one of these without a session starts the login flow.
			authenticatedRoutes: ['/login', '/app', '/admin', '/upload', '/manage'],
			// The library redirects to `${origin}/${logoutPath}`, so no leading slash here.
			logoutPath: '',
			allowBearerToken: true,
			async userLoggedInSuccessfully({ user }) {
				const values = normalizeClaims(user as Record<string, unknown>);
				await db
					.insert(schema.user)
					.values(values)
					.onConflictDoUpdate({ target: schema.user.id, set: values });
			}
		})
	: ({} as Awaited<ReturnType<typeof makeOIDC>>);
