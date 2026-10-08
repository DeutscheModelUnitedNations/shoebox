import { describe, expect, it } from 'vitest';
import { categoryTitle, flattenCategories } from './categories';
import type { StudioCategory } from './types';

const node = (id: string, depth: number, children: StudioCategory[] = []): StudioCategory => ({
	id,
	parentId: null,
	name: id.toUpperCase(),
	slug: id,
	hidden: false,
	depth,
	count: 0,
	children
});

const tree = [node('gremien', 1, [node('gv', 2, [node('debatte', 3)])]), node('party', 1)];

describe('categories', () => {
	it('flattens with full path labels', () => {
		expect(flattenCategories(tree).map((o) => o.label)).toEqual([
			'GREMIEN',
			'GREMIEN › GV',
			'GREMIEN › GV › DEBATTE',
			'PARTY'
		]);
	});

	it('titles a category by its path below the main category', () => {
		expect(categoryTitle(tree, 'debatte')).toBe('GV · DEBATTE');
		expect(categoryTitle(tree, 'party')).toBe('PARTY');
		expect(categoryTitle(tree, 'missing')).toBe('');
	});
});
