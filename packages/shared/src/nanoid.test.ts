import { describe, expect, it } from 'vitest';
import { NANOID_LENGTH, isValidNanoid, nanoid } from './nanoid';

describe('nanoid', () => {
	it('generates ids of the configured length', () => {
		expect(nanoid()).toHaveLength(NANOID_LENGTH);
	});

	it('generates ids that pass validation', () => {
		for (let i = 0; i < 100; i++) expect(isValidNanoid(nanoid())).toBe(true);
	});

	it('rejects lookalike characters and wrong lengths', () => {
		expect(isValidNanoid('0'.repeat(NANOID_LENGTH))).toBe(false);
		expect(isValidNanoid('6'.repeat(NANOID_LENGTH - 1))).toBe(false);
	});
});
