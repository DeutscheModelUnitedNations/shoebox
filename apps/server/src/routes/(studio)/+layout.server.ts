import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { canUpload } from '$api/services/roles';

/** Upload, manage and admin are for admins and photographers. Login is enforced by OIDC. */
export const load: LayoutServerLoad = ({ locals }) => {
	if (!canUpload(locals.roles)) error(403, 'Forbidden');
};
