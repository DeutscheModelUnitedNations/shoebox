import { describe, expect, it } from 'vitest';
import { placeholderSize } from './blurhash';

describe('placeholderSize', () => {
	it('keeps the aspect ratio with the longer side at 32 pixels', () => {
		expect(placeholderSize(3000, 2000)).toEqual({ width: 32, height: 21 });
		expect(placeholderSize(1000, 4000)).toEqual({ width: 8, height: 32 });
	});

	it('falls back to a square without dimensions', () => {
		expect(placeholderSize()).toEqual({ width: 32, height: 32 });
	});
});
