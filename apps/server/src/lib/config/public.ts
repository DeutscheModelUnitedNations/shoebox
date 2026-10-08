import { env } from '$env/dynamic/public';
import { z } from 'zod';
import { getConfig } from './getConfig';

const schema = z.object({
	PUBLIC_VERSION: z.string().optional(),
	PUBLIC_SHA: z.string().optional(),
	PUBLIC_OIDC_AUTHORITY: z.string(),
	PUBLIC_OIDC_CLIENT_ID: z.string(),
	PUBLIC_OIDC_LOGIN_CALLBACK_ROUTE: z.string().optional(),
	PUBLIC_OIDC_LOGOUT_CALLBACK_ROUTE: z.string().optional(),
	PUBLIC_DEFAULT_LOCALE: z.string().default('en'),
	/** Public base URL of the derivatives bucket, without trailing slash. */
	PUBLIC_MEDIA_BASE_URL: z
		.string()
		.url()
		.transform((u) => u.replace(/\/$/, ''))
});

export const configPublic = getConfig({ schema, envSource: env });
