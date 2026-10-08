import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { OIDC } from '$api/services/OIDC';
import { configPublic } from '$config/public';

export const load: PageServerLoad = async ({ url }) => {
	let target: URL;
	try {
		target = await OIDC.getLogoutUrl(url);
	} catch {
		// Providers without an end_session_endpoint (Google) can't sign out of their own
		// session. The logout callback still clears our cookies.
		target = new URL(
			configPublic.PUBLIC_OIDC_LOGOUT_CALLBACK_ROUTE ?? '/auth/logout-callback',
			url.origin
		);
	}
	redirect(308, target);
};
