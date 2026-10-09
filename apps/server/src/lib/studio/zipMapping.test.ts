import { describe, expect, it } from 'vitest';
import type { CategoryOption } from './categories';
import {
	folderTarget,
	folderTree,
	guideLines,
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

describe('folderTree', () => {
	const folders = summarizeFolders(
		['A/a.jpg', 'A/X/b.jpg', 'A/X/c.jpg', 'A/Y/d.jpg', 'A B/e.jpg', 'f.jpg'],
		null
	);

	it('keeps subfolders directly below their parent', () => {
		expect(folders.map((f) => f.key)).toEqual(['A', 'A/X', 'A/Y', 'A B', '']);
	});

	it('draws guide lines, flags parents and sums subtrees', () => {
		expect(folderTree(folders)).toEqual({
			A: { lines: [], hasChildren: true, total: 4 },
			'A/X': { lines: [true], hasChildren: false, total: 2 },
			'A/Y': { lines: [false], hasChildren: false, total: 1 },
			'A B': { lines: [], hasChildren: false, total: 1 }
		});
	});
});

describe('guideLines', () => {
	it('draws an open parent with a line down to its children', () => {
		expect(guideLines({ lines: [], hasChildren: true, total: 4 }, 0, true)).toEqual([
			'left:1.25rem;top:calc(50% + 0.625rem);bottom:0'
		]);
		expect(guideLines({ lines: [], hasChildren: true, total: 4 }, 0, false)).toEqual([]);
	});

	it('continues ancestor lines and ends the elbow at the last child', () => {
		expect(guideLines({ lines: [true, false], hasChildren: false, total: 1 }, 2, true)).toEqual([
			'left:1.25rem;top:0;bottom:0',
			'left:2.5rem;top:0;bottom:50%',
			'left:2.5rem;top:50%;height:1px;width:0.625rem'
		]);
	});

	it('skips the line of an ancestor without later siblings', () => {
		expect(guideLines({ lines: [false, true], hasChildren: false, total: 1 }, 2, true)).toEqual([
			'left:2.5rem;top:0;bottom:0',
			'left:2.5rem;top:50%;height:1px;width:0.625rem'
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
