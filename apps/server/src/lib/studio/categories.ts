import type { StudioCategory } from './types';

export interface CategoryOption {
	id: string;
	/** Full path, e.g. "Gremien › Generalversammlung › Debatte" */
	label: string;
	name: string;
	depth: number;
}

/** Depth-first list of every category with its path, for selects. */
export function flattenCategories(tree: StudioCategory[], prefix: string[] = []): CategoryOption[] {
	return tree.flatMap((c) => [
		{ id: c.id, label: [...prefix, c.name].join(' › '), name: c.name, depth: c.depth },
		...flattenCategories(c.children, [...prefix, c.name])
	]);
}

/** The chain from the main category down to `id`. */
function categoryPath(tree: StudioCategory[], id: string): StudioCategory[] {
	for (const node of tree) {
		if (node.id === id) return [node];
		const below = categoryPath(node.children, id);
		if (below.length > 0) return [node, ...below];
	}
	return [];
}

/** The heading of a filtered manage view: the category path below the main category. */
export function categoryTitle(tree: StudioCategory[], id: string) {
	const path = categoryPath(tree, id);
	const below = path.slice(1).map((c) => c.name);
	return below.length > 0 ? below.join(' · ') : (path[0]?.name ?? '');
}
