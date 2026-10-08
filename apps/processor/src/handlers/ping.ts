import type { JobHandler } from './index';

/** Exercises the queue end to end without touching storage. */
export const ping: JobHandler<'PING'> = (ctx, payload) =>
	Promise.resolve({
		pong: payload.message ?? 'pong',
		jobId: ctx.jobId,
		at: new Date().toISOString()
	});
