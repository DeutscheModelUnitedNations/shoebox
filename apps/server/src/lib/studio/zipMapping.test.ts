import { describe, expect, it } from 'vitest';
import type { CategoryOption } from './categories';
import {
	folderTarget,
	normalizeName,
	similarName,
	suggestMappings,
	summarizeFolders
} from './zipMapping';

const option = (id: string, label: string): CategoryOption => ({
	id,
	label,
	name: label.split(' › ').at(-1)!,
	depth: label.split(' › ').length
});

const options = [
	option('gremien', 'Gremien'),
	option('gv', 'Gremien › Generalversammlung'),
	option('debatte', 'Gremien › Generalversammlung › Debatte'),
	option('eroeffnung', 'Eröffnung und Abschluss')
];

describe('summarizeFolders', () => {
	const paths = [
		'MUN/Gremien/a.jpg',
		'MUN/Gremien/GV/Debatte/b.jpg',
		'MUN/Gremien/GV/Debatte/Tag1/c.jpg',
		'MUN/d.jpg'
	];

	it('counts photos per folder, adds intermediate folders and flags merged depth', () => {
		expect(summarizeFolders(paths, 'MUN')).toEqual([
			{ key: 'Gremien', name: 'Gremien', depth: 1, count: 1, tooDeep: false },
			{ key: 'Gremien/GV', name: 'GV', depth: 2, count: 0, tooDeep: false },
			{ key: 'Gremien/GV/Debatte', name: 'Debatte', depth: 3, count: 2, tooDeep: true },
			{ key: '', name: '', depth: 0, count: 1, tooDeep: false }
		]);
	});

	it('keeps the root folder when it is not skipped', () => {
		expect(summarizeFolders(['MUN/a.jpg'], null)).toEqual([
			{ key: 'MUN', name: 'MUN', depth: 1, count: 1, tooDeep: false }
		]);
	});
});

describe('name matching', () => {
	it('normalizes umlauts and separators', () => {
		expect(normalizeName('Eröffnung & Abschluss')).toBe('eroeffnungabschluss');
	});

	it('treats contained names as similar, but not very short ones', () => {
		expect(similarName('Eroeffnung', 'Eröffnung und Abschluss')).toBe(true);
		expect(similarName('GV', 'Generalversammlung')).toBe(false);
		expect(similarName('Abschluss', 'Eröffnung und Abschluss')).toBe(true);
	});

	it('does not match inside a word', () => {
		expect(similarName('MUN', 'Team und Sekretariat')).toBe(false);
	});
});

describe('suggestMappings', () => {
	const folders = summarizeFolders(
		[
			'Gremien/GV/a.jpg',
			'Gremien/Generalversammlung/Debatte/b.jpg',
			'Eroeffnung/c.jpg',
			'Party/d.jpg',
			'e.jpg'
		],
		null
	);

	it('matches exact names below the parent, similar names, and proposes the rest as new', () => {
		const mapping = suggestMappings(folders, options);
		expect(mapping['Gremien']).toEqual({ target: 'gremien', newName: '', match: 'exact' });
		expect(mapping['Gremien/Generalversammlung/Debatte']).toMatchObject({
			target: 'debatte',
			match: 'exact'
		});
		expect(mapping['Gremien/GV']).toEqual({ target: 'NEW', newName: 'GV', match: 'new' });
		expect(mapping['Eroeffnung']).toMatchObject({ target: 'eroeffnung', match: 'similar' });
		expect(mapping['Party']).toMatchObject({ target: 'NEW', match: 'new' });
		expect(mapping['']).toEqual({ target: 'NONE', newName: '', match: 'none' });
	});

	it('keeps manual choices and suggests below them', () => {
		const manual = { 'Gremien/GV': { target: 'gv', newName: '', match: 'manual' as const } };
		const twoLevel = summarizeFolders(['Gremien/GV/Debatte/a.jpg'], null);
		const mapping = suggestMappings(twoLevel, options, manual);
		expect(mapping['Gremien/GV']).toEqual(manual['Gremien/GV']);
		expect(mapping['Gremien/GV/Debatte']).toMatchObject({ target: 'debatte', match: 'exact' });
	});
});

describe('folderTarget', () => {
	it('maps the choice to an existing category, a new one or none', () => {
		expect(folderTarget({ target: 'gv', newName: '', match: 'exact' })).toEqual({
			categoryId: 'gv',
			newName: null
		});
		expect(folderTarget({ target: 'NEW', newName: 'Party', match: 'new' })).toEqual({
			categoryId: null,
			newName: 'Party'
		});
		expect(folderTarget({ target: 'NONE', newName: '', match: 'none' })).toEqual({
			categoryId: null,
			newName: null
		});
		expect(folderTarget(undefined)).toEqual({ categoryId: null, newName: null });
	});
});
