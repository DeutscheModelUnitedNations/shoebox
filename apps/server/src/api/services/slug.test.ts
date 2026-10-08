import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug';

describe('slugs', () => {
	it('transliterates German names', () => {
		expect(slugify('Eröffnung und Abschluss')).toBe('eroeffnung-und-abschluss');
		expect(slugify('Straße & Grüße!')).toBe('strasse-gruesse');
		expect(slugify('***')).toBe('eintrag');
	});

	it('appends a counter when taken', () => {
		expect(uniqueSlug('gremien', [])).toBe('gremien');
		expect(uniqueSlug('gremien', ['gremien', 'gremien-2'])).toBe('gremien-3');
	});
});
