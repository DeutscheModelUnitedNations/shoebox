import { describe, expect, it } from 'vitest';
import { hammingDistance, similarity } from './duplicates';

describe('difference hash comparison', () => {
	it('counts differing bits', () => {
		expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
		expect(hammingDistance('0000000000000000', '000000000000000f')).toBe(4);
		expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64);
	});

	it('turns the distance into a similarity percentage', () => {
		expect(similarity('a1b2c3d4e5f60718', 'a1b2c3d4e5f60718')).toBe(100);
		expect(similarity('0000000000000000', '000000000000000f')).toBe(94);
		expect(similarity('ffffffffffffffff', '0000000000000000')).toBe(0);
	});
});
