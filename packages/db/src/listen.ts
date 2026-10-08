import pg from 'pg';
import { JOB_CHANNEL } from './queue';

/**
 * Dedicated LISTEN connection. Notifications only wake the worker, the queue itself stays the
 * source of truth, so a missed notification costs at most one poll interval.
 */
export function listenForJobs(
	databaseUrl: string,
	onJob: (jobId: string | null) => void,
	options: { onError?: (error: unknown) => void; reconnectDelayMs?: number } = {}
) {
	const reconnectDelayMs = options.reconnectDelayMs ?? 5000;
	let client: pg.Client | undefined;
	let stopped = false;

	const connect = async () => {
		if (stopped) return;
		client = new pg.Client({ connectionString: databaseUrl });
		client.on('notification', (msg) => onJob(msg.payload ?? null));
		client.on('error', (error) => {
			options.onError?.(error);
			void reconnect();
		});
		try {
			await client.connect();
			await client.query(`LISTEN ${JOB_CHANNEL}`);
		} catch (error) {
			options.onError?.(error);
			void reconnect();
		}
	};

	const reconnect = async () => {
		if (stopped) return;
		try {
			await client?.end();
		} catch {
			// already gone
		}
		client = undefined;
		await new Promise((r) => setTimeout(r, reconnectDelayMs));
		await connect();
	};

	void connect();

	return {
		stop: async () => {
			stopped = true;
			await client?.end().catch(() => undefined);
		}
	};
}
