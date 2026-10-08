import { z } from 'zod';

/** Accepts the usual spellings of a boolean environment variable. */
export const envBoolean = z
	.union([z.boolean(), z.string()])
	.transform((v) =>
		typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
	);

/** Parses a comma-separated list, dropping blanks. */
export const envList = z
	.string()
	.default('')
	.transform((v) =>
		v
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);

/** Connection settings shared by every process that talks to the object store. */
export const s3EnvSchema = z.object({
	S3_ENDPOINT: z.url(),
	S3_REGION: z.string().default('garage'),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_FORCE_PATH_STYLE: envBoolean.default(true),
	S3_BUCKET_ORIGINALS: z.string().default('shoebox-originals'),
	S3_BUCKET_DERIVATIVES: z.string().default('shoebox-derivatives')
});
export type S3Env = z.infer<typeof s3EnvSchema>;

export const databaseEnvSchema = z.object({
	DATABASE_URL: z.string().min(1)
});
