/** Jobs finished within this window feed the throughput estimate. */
export const THROUGHPUT_WINDOW_MS = 15 * 60 * 1000;

/** Waiting this long with no job running or finishing counts as a stalled processor. */
const STALL_AFTER_MS = 2 * 60 * 1000;

/** Fewer finished jobs than this say too little about the speed. */
const MIN_SAMPLE = 3;

export type QueueState = 'idle' | 'working' | 'stalled';

/**
 * Jobs per minute, measured from the oldest job that finished in the window, so a backlog
 * that only started a few minutes ago is not diluted by the idle time before it.
 */
export function jobsPerMinute(finished: number, oldestFinishedAt: Date | null, now: Date) {
	if (finished < MIN_SAMPLE || !oldestFinishedAt) return null;
	const span = Math.max(now.getTime() - oldestFinishedAt.getTime(), 60_000);
	return (finished / span) * 60_000;
}

/** Seconds until `remaining` jobs are done at the measured speed, null while unknown. */
export function etaSeconds(remaining: number, perMinute: number | null) {
	if (remaining === 0) return 0;
	if (!perMinute) return null;
	return Math.ceil((remaining / perMinute) * 60);
}

export function queueState(input: {
	ready: number;
	running: number;
	oldestReadyAt: Date | null;
	lastFinishedAt: Date | null;
	now: Date;
}): QueueState {
	if (input.ready === 0 && input.running === 0) return 'idle';
	if (input.running > 0) return 'working';
	const now = input.now.getTime();
	const waitingLong = !!input.oldestReadyAt && now - input.oldestReadyAt.getTime() > STALL_AFTER_MS;
	const finishedLately =
		!!input.lastFinishedAt && now - input.lastFinishedAt.getTime() <= STALL_AFTER_MS;
	return waitingLong && !finishedLately ? 'stalled' : 'working';
}

/** "4 minutes", "1 hour, 20 minutes", rounded up to whole minutes. */
export function formatEta(seconds: number, locale: string) {
	const minutes = Math.max(1, Math.ceil(seconds / 60));
	const unit = (value: number, unit: 'hour' | 'minute') =>
		new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
	if (minutes < 60) return unit(minutes, 'minute');
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? unit(hours, 'hour') : `${unit(hours, 'hour')}, ${unit(rest, 'minute')}`;
}

/** "40 sec", "12 min", "3 hr, 5 min" for how long a job has been waiting or running. */
export function formatElapsed(seconds: number, locale: string) {
	const unit = (value: number, unit: 'second' | 'minute' | 'hour') =>
		new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(value);
	if (seconds < 60) return unit(seconds, 'second');
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return unit(minutes, 'minute');
	const rest = minutes % 60;
	const hours = unit(Math.floor(minutes / 60), 'hour');
	return rest === 0 ? hours : `${hours}, ${unit(rest, 'minute')}`;
}

/** First line of a stored stack trace, short enough for a table cell. */
export function errorSummary(error: string | null) {
	const line = error?.split('\n')[0]?.trim() ?? '';
	return line.length > 160 ? `${line.slice(0, 159)}…` : line;
}

/** Event and file name of a job, only for events the viewer manages (`visible`). */
export function jobContext(
	row: { eventId: string | null; filename: string | null },
	visible: Map<string, { id: string; name: string }>
) {
	const event = visible.get(row.eventId ?? '') ?? null;
	return { event, filename: event && row.filename, otherEvent: !!row.eventId && !event };
}
