import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// `/login` is an authenticated route, so the OIDC handle has already completed the login
// flow by the time this runs. Send the user on to where they wanted to go.
export const load: PageServerLoad = ({ url }) => {
	const target = url.searchParams.get('redirect');
	redirect(303, target && target.startsWith('/') && !target.startsWith('//') ? target : '/');
};
