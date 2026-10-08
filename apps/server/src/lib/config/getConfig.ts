import type { z } from 'zod';
import type { env as envPublic } from '$env/dynamic/public';
import type { env as envPrivate } from '$env/dynamic/private';
import { building } from '$app/environment';

/**
 * Parses environment variables into a Zod schema. Falls back to process.env so the same
 * module works under `vite dev`, the node adapter and plain scripts.
 */
export function getConfig<
	Schema extends z.ZodType,
	Source extends typeof envPublic | typeof envPrivate
>({
	envSource,
	schema,
	disableFallbackProcessEnv = false
}: {
	schema: Schema;
	envSource: Source;
	disableFallbackProcessEnv?: boolean;
}): z.infer<Schema> {
	if (building) return {} as z.infer<Schema>;
	let err: unknown;
	try {
		return schema.parse(envSource);
	} catch (error) {
		err = error;
	}

	if (disableFallbackProcessEnv) throw err;

	try {
		return schema.parse(process.env);
	} catch {
		// we want to throw the original error
		throw err;
	}
}
