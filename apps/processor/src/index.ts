import { createDb } from '@shoebox/db';
import { listenForJobs } from '@shoebox/db/listen';
import { createS3Client } from '@shoebox/shared';
import { setPriority } from 'node:os';
import sharp from 'sharp';
import { loadConfig } from './config';
import { log } from './log';
import { Worker } from './worker';

const config = loadConfig();

// Media processing can take its time, the web server must not starve. ffmpeg inherits the priority.
if (config.PROCESSOR_THREADS > 0) sharp.concurrency(config.PROCESSOR_THREADS);
try {
	setPriority(config.PROCESSOR_NICE);
} catch (error) {
	log('warn', 'could not lower process priority', { error: String(error) });
}

const db = createDb(config.DATABASE_URL);
const s3 = createS3Client(config);
const worker = new Worker(db, s3, config);

const listener = listenForJobs(config.DATABASE_URL, () => worker.notify(), {
	onError: (error) => log('warn', 'listener error, reconnecting', { error: String(error) })
});

const health = Bun.serve({
	port: config.PROCESSOR_HEALTH_PORT,
	fetch(req) {
		if (new URL(req.url).pathname !== '/healthz') return new Response('Not found', { status: 404 });
		return Response.json({
			status: 'ok',
			worker: worker.id,
			active: worker.activeCount,
			lastClaimAt: worker.lastClaimAt ?? null
		});
	}
});

let shuttingDown = false;
async function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;
	log('info', 'shutting down', { signal, active: worker.activeCount });
	worker.stop();
	await listener.stop();
	await health.stop();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

log('info', 'processor started', {
	worker: worker.id,
	concurrency: config.PROCESSOR_CONCURRENCY,
	threads: sharp.concurrency(),
	nice: config.PROCESSOR_NICE,
	health: `http://127.0.0.1:${config.PROCESSOR_HEALTH_PORT}/healthz`
});
await worker.run();
log('info', 'processor stopped');
process.exit(0);
