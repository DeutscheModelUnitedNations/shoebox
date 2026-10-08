import { describe, expect, it } from 'vitest';
import {
	errorSummary,
	etaSeconds,
	formatElapsed,
	formatEta,
	jobContext,
	jobsPerMinute,
	queueState
} from './queue';

const now = new Date('2026-10-09T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('jobsPerMinute', () => {
	it('measures from the oldest finished job', () => {
		expect(jobsPerMinute(30, ago(5 * 60_000), now)).toBe(6);
	});

	it('needs a few samples', () => {
		expect(jobsPerMinute(2, ago(60_000), now)).toBeNull();
		expect(jobsPerMinute(10, null, now)).toBeNull();
	});

	it('treats very short spans as one minute', () => {
		expect(jobsPerMinute(5, ago(1_000), now)).toBe(5);
	});
});

describe('etaSeconds', () => {
	it('divides the remaining jobs by the speed', () => {
		expect(etaSeconds(60, 6)).toBe(600);
		expect(etaSeconds(0, null)).toBe(0);
		expect(etaSeconds(10, null)).toBeNull();
	});
});

describe('queueState', () => {
	const base = { ready: 0, running: 0, oldestReadyAt: null, lastFinishedAt: null, now };

	it('is idle without work', () => {
		expect(queueState(base)).toBe('idle');
	});

	it('is working while jobs run', () => {
		expect(queueState({ ...base, ready: 5, running: 1, oldestReadyAt: ago(600_000) })).toBe(
			'working'
		);
	});

	it('gives freshly queued jobs time to be picked up', () => {
		expect(queueState({ ...base, ready: 5, oldestReadyAt: ago(10_000) })).toBe('working');
	});

	it('is stalled when waiting jobs sit untouched', () => {
		expect(queueState({ ...base, ready: 5, oldestReadyAt: ago(600_000) })).toBe('stalled');
		expect(
			queueState({ ...base, ready: 5, oldestReadyAt: ago(600_000), lastFinishedAt: ago(30_000) })
		).toBe('working');
	});
});

describe('formatEta', () => {
	it('rounds up to minutes and splits hours', () => {
		expect(formatEta(20, 'en')).toBe('1 minute');
		expect(formatEta(250, 'en')).toBe('5 minutes');
		expect(formatEta(3600, 'en')).toBe('1 hour');
		expect(formatEta(4800, 'de')).toBe('1 Stunde, 20 Minuten');
	});
});

describe('formatElapsed', () => {
	it('picks the largest sensible unit', () => {
		expect(formatElapsed(40, 'en')).toBe('40 sec');
		expect(formatElapsed(750, 'en')).toBe('12 min');
		expect(formatElapsed(3 * 3600 + 300, 'en')).toBe('3 hr, 5 min');
	});
});

describe('errorSummary', () => {
	it('keeps the first line', () => {
		expect(errorSummary('Error: boom\n    at x')).toBe('Error: boom');
		expect(errorSummary(null)).toBe('');
		expect(errorSummary('x'.repeat(200))).toHaveLength(160);
	});
});

describe('jobContext', () => {
	const visible = new Map([['e1', { id: 'e1', name: 'MUN-SH 2026' }]]);

	it('names files and events the viewer manages', () => {
		expect(jobContext({ eventId: 'e1', filename: 'a.jpg' }, visible)).toEqual({
			event: { id: 'e1', name: 'MUN-SH 2026' },
			filename: 'a.jpg',
			otherEvent: false
		});
	});

	it('hides other events and keeps jobs without one apart', () => {
		expect(jobContext({ eventId: 'e2', filename: 'b.jpg' }, visible)).toEqual({
			event: null,
			filename: null,
			otherEvent: true
		});
		expect(jobContext({ eventId: null, filename: null }, visible).otherEvent).toBe(false);
	});
});
