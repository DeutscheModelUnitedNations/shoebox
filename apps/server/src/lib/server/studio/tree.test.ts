import { describe, expect, it } from 'vitest';
import type { schema } from '@shoebox/db';
import { categoryTree, subtree } from './load';

type CategoryRow = typeof schema.category.$inferSelect;
const now = new Date();
const row = (id: string, parentId: string | null): CategoryRow => ({
	id,
	parentId,
	eventId: 'e',
	slug: id,
	name: id,
	sortOrder: 0,
	coverMediaId: null,
	hidden: false,
	createdAt: now,
	updatedAt: now
});

describe('studio category tree', () => {
	const rows = [
		row('gremien', null),
		row('gv', 'gremien'),
		row('debatte', 'gv'),
		row('presse', null)
	];
	const counts = new Map<string | null, number>([
		['gremien', 1],
		['gv', 2],
		['debatte', 5],
		['presse', 3]
	]);

	it('sums photo counts per subtree and records depth', () => {
		const tree = categoryTree(rows, counts);
		expect(tree.map((c) => [c.id, c.count, c.depth])).toEqual([
			['gremien', 8, 1],
			['presse', 3, 1]
		]);
		expect(tree[0].children[0].children[0]).toMatchObject({ id: 'debatte', depth: 3, count: 5 });
	});

	it('collects a category with everything below it', () => {
		const tree = categoryTree(rows, counts);
		expect(subtree(tree, 'gremien')).toEqual(['gremien', 'gv', 'debatte']);
		expect(subtree(tree, 'presse')).toEqual(['presse']);
		expect(subtree(tree, 'missing')).toEqual([]);
	});
});
