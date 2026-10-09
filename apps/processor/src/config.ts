import { databaseEnvSchema, s3EnvSchema } from '@shoebox/shared';
import { z } from 'zod';

const schema = databaseEnvSchema.extend(s3EnvSchema.shape).extend({
	/** Jobs processed at the same time by this instance. */
	PROCESSOR_CONCURRENCY: z.coerce.number().int().min(1).default(2),
	/** CPU threads one job may use (libvips and ffmpeg). 0 uses every core. */
	PROCESSOR_THREADS: z.coerce.number().int().min(0).default(0),
	/** Scheduling priority, 0 (normal) to 19 (lowest). The server and database win any contention. */
	PROCESSOR_NICE: z.coerce.number().int().min(0).max(19).default(10),
	/** Fallback poll interval when no NOTIFY arrives. */
	PROCESSOR_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(5000),
	/** A RUNNING job older than this is returned to the queue (crashed worker). */
	PROCESSOR_STALE_JOB_MS: z.coerce.number().int().min(1000).default(600_000),
	PROCESSOR_HEALTH_PORT: z.coerce.number().int().default(3001),
	FFMPEG_PATH: z.string().default('ffmpeg'),
	FFPROBE_PATH: z.string().default('ffprobe')
});

export type ProcessorConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProcessorConfig {
	return schema.parse(env);
}
