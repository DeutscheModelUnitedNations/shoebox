import type { S3Client } from '@aws-sdk/client-s3';
import {
	claimJob,
	completeJob,
	failJob,
	markMediaFailed,
	recoverStaleJobs,
	type Database,
	type ProcessingJobRow
} from '@shoebox/db';
import { jobPayloadSchemas, type ProcessingJobType } from '@shoebox/shared';
import type { ProcessorConfig } from './config';
import { handlers, type JobHandler } from './handlers';
import { log } from './log';
import { purgeTrash } from './trash';

export class Worker {
	readonly id = `${process.env.HOSTNAME ?? 'processor'}-${process.pid}`;
	private active = new Set<Promise<void>>();
	private wake: (() => void) | undefined;
	private stopped = false;
	private staleTimer: ReturnType<typeof setInterval> | undefined;
	private trashTimer: ReturnType<typeof setInterval> | undefined;
	lastClaimAt: Date | undefined;

	constructor(
		private readonly db: Database,
		private readonly s3: S3Client,
		private readonly config: ProcessorConfig
	) {}

	/** Called on NOTIFY or when a job finishes, interrupts the poll sleep. */
	notify() {
		this.wake?.();
	}

	get activeCount() {
		return this.active.size;
	}

	async run() {
		this.staleTimer = setInterval(
			() =>
				recoverStaleJobs(this.db, this.config.PROCESSOR_STALE_JOB_MS)
					.then((n) => n && log('warn', 'recovered stale jobs', { count: n }))
					.catch((error) => log('error', 'stale job recovery failed', { error: String(error) })),
			Math.max(10_000, this.config.PROCESSOR_STALE_JOB_MS / 2)
		);

		// Trashed photos older than the retention period are deleted hourly
		const purge = () =>
			purgeTrash(this.db, this.s3, this.config)
				.then((n) => n && log('info', 'purged trash', { count: n }))
				.catch((error) => log('error', 'trash purge failed', { error: String(error) }));
		this.trashTimer = setInterval(purge, 60 * 60 * 1000);
		void purge();

		while (!this.stopped) {
			const claimed = await this.fill();
			if (!claimed) await this.sleep(this.config.PROCESSOR_POLL_INTERVAL_MS);
		}

		clearInterval(this.staleTimer);
		clearInterval(this.trashTimer);
		await Promise.allSettled([...this.active]);
	}

	stop() {
		this.stopped = true;
		this.notify();
	}

	/** Claims jobs until the concurrency limit is hit or the queue is empty. */
	private async fill(): Promise<boolean> {
		let claimed = false;
		while (!this.stopped && this.active.size < this.config.PROCESSOR_CONCURRENCY) {
			let job: ProcessingJobRow | undefined;
			try {
				job = await claimJob(this.db, this.id);
			} catch (error) {
				log('error', 'claim failed', { error: String(error) });
				break;
			}
			if (!job) break;
			claimed = true;
			this.lastClaimAt = new Date();
			const task = this.process(job).finally(() => {
				this.active.delete(task);
				this.notify();
			});
			this.active.add(task);
		}
		return claimed;
	}

	private async process(job: ProcessingJobRow) {
		const started = Date.now();
		log('info', 'job started', { id: job.id, type: job.type, attempt: job.attempts });
		try {
			const type = job.type as ProcessingJobType;
			const handler = handlers[type] as JobHandler<ProcessingJobType>;
			const payload = jobPayloadSchemas[type].parse(job.payload);
			const result = await handler(
				{ s3: this.s3, db: this.db, config: this.config, jobId: job.id },
				payload
			);
			await completeJob(this.db, job.id, result);
			log('info', 'job succeeded', { id: job.id, type: job.type, ms: Date.now() - started });
		} catch (error) {
			await this.recordFailure(job, error);
		}
	}

	// fallow-ignore-next-line complexity -- retry bookkeeping, covered by queue.test.ts and runs
	private async recordFailure(job: ProcessingJobRow, error: unknown) {
		const exhausted = await failJob(this.db, job, error).catch((e) => {
			log('error', 'could not record failure', { id: job.id, error: String(e) });
			return true;
		});
		if (exhausted) await this.markFailed(job);
		log(exhausted ? 'error' : 'warn', exhausted ? 'job failed' : 'job will retry', {
			id: job.id,
			type: job.type,
			attempt: job.attempts,
			error: error instanceof Error ? error.message : String(error)
		});
	}

	/** Media whose processing gave up must not stay PENDING forever. */
	private async markFailed(job: ProcessingJobRow) {
		const mediaId = (job.payload as { mediaId?: unknown }).mediaId;
		if (typeof mediaId !== 'string') return;
		await markMediaFailed(this.db, mediaId).catch((error) =>
			log('error', 'could not mark media failed', { mediaId, error: String(error) })
		);
	}

	private sleep(ms: number) {
		return new Promise<void>((resolve) => {
			const timer = setTimeout(done, ms);
			function done() {
				clearTimeout(timer);
				resolve();
			}
			this.wake = done;
		}).finally(() => (this.wake = undefined));
	}
}
