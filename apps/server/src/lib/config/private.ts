import { env } from '$env/dynamic/private';
import { envList, s3EnvSchema } from '@shoebox/shared';
import { z } from 'zod';
import { getConfig } from './getConfig';

const schema = z.object({
	DATABASE_URL: z.string(),
	OIDC_CLIENT_SECRET: z.string().optional(),
	OIDC_SCOPES: z.string().default('openid profile email offline_access'),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

	// Access control: team sees team-private media, admins manage everything.
	TEAM_EMAIL_WHITELIST: envList,
	TEAM_DOMAIN_WHITELIST: envList,
	ADMIN_EMAIL_WHITELIST: envList,
	ADMIN_DOMAIN_WHITELIST: envList,

	...s3EnvSchema.shape,

	// Same semantics as the node adapter: forwarded headers are only trusted when configured.
	ORIGIN: z.string().optional(),
	PROTOCOL_HEADER: z.string().optional(),
	HOST_HEADER: z.string().optional(),
	PORT_HEADER: z.string().optional()
});

export const configPrivate = getConfig({ schema, envSource: env });
