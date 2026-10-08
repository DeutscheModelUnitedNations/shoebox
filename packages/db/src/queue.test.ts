import { describe, expect, it } from 'vitest';
import { retryDelayMs } from './queue';

describe('retryDelayMs', () => {
	it('doubles per attempt starting at ten seconds', () => {
		expect(retryDelayMs(1)).toBe(10_000);
		expect(retryDelayMs(2)).toBe(20_000);
		expect(retryDelayMs(3)).toBe(40_000);
	});

	it('caps at one hour', () => {
		expect(retryDelayMs(20)).toBe(3_600_000);
	});
});
