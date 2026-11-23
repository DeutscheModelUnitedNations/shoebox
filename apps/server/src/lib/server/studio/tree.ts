/**
 * Pure helpers for the studio category tree. No database or config imports, so they are
 * testable without an environment (see load.ts for the data access).
 */
import type { schema } from '@shoebox/db';
import type { StudioCategory } from '$lib/studio/types';

type CategoryRow = typeof schema.category.$inferSelect;

/** Nests the categories and counts photos per subtree. */
export function categoryTree(rows: CategoryRow[], counts: Map<string | null, number>) {
	const nodes = new Map<string, StudioCategory>(
		rows.map((c) => [
			c.id,
			{
				id: c.id,
				parentId: c.parentId,
				name: c.name,
				slug: c.slug,
				hidden: c.hidden,
				depth: 1,
				count: counts.get(c.id) ?? 0,
				children: []
			}
		])
	);
	const roots: StudioCategory[] = [];
	for (const c of rows) {
		const node = nodes.get(c.id)!;
		const parent = c.parentId ? nodes.get(c.parentId) : undefined;
		(parent ? parent.children : roots).push(node);
	}
	const finish = (node: StudioCategory, depth: number): number => {
		node.depth = depth;
		node.count += node.children.reduce((sum, child) => sum + finish(child, depth + 1), 0);
		return node.count;
	};
	roots.forEach((r) => finish(r, 1));
	return roots;
}

/** All categories of an event below `id`, including itself. */
export function subtree(roots: StudioCategory[], id: string): string[] {
	const find = (nodes: StudioCategory[]): StudioCategory | undefined =>
		nodes.reduce<StudioCategory | undefined>(
			(found, n) => found ?? (n.id === id ? n : find(n.children)),
			undefined
		);
	const collect = (n: StudioCategory): string[] => [n.id, ...n.children.flatMap(collect)];
	const node = find(roots);
	return node ? collect(node) : [];
}
