/**
 * Folder summary and category suggestions for the ZIP upload (3h), kept free of Svelte so the
 * matching rules are testable.
 */
import { ZIP_MAX_DEPTH, zipFolderOf } from '@shoebox/shared';
import type { CategoryOption } from './categories';

export interface ZipFolder {
	/** Folder key as zipFolderOf returns it, '' for photos without folder */
	key: string;
	name: string;
	depth: number;
	/** Photos directly in this folder (after merging folders deeper than three levels) */
	count: number;
	/** Deeper folders were merged into this one */
	tooDeep: boolean;
}

export type Match = 'exact' | 'similar' | 'new' | 'manual' | 'none';

export interface Mapping {
	/** A category id, NEW for a new category, NONE for no category */
	target: string;
	newName: string;
	match: Match;
}

function depthBelowRoot(path: string, rootToSkip: string | null) {
	const dirs = path.split('/').slice(0, -1);
	return dirs.length - (rootToSkip && dirs[0] === rootToSkip ? 1 : 0);
}

/** Every folder with its photo count, including intermediate folders without photos. */
export function summarizeFolders(paths: string[], rootToSkip: string | null): ZipFolder[] {
	const counts: Record<string, number> = {};
	const deeper: Record<string, true> = {};
	for (const path of paths) {
		const key = zipFolderOf(path, rootToSkip);
		counts[key] = (counts[key] ?? 0) + 1;
		if (depthBelowRoot(path, rootToSkip) > ZIP_MAX_DEPTH) deeper[key] = true;
		const parts = key.split('/').filter(Boolean);
		for (let i = 1; i < parts.length; i++) counts[parts.slice(0, i).join('/')] ??= 0;
	}
	const folders = Object.keys(counts)
		.filter((key) => key !== '')
		.sort((a, b) => a.localeCompare(b))
		.map((key) => ({
			key,
			name: key.split('/').at(-1)!,
			depth: key.split('/').length,
			count: counts[key],
			tooDeep: !!deeper[key]
		}));
	const loose = counts[''];
	return loose === undefined
		? folders
		: [...folders, { key: '', name: '', depth: 0, count: loose, tooDeep: false }];
}

/** Lowercase ASCII without separators, so "Eröffnung" matches "eroeffnung". */
export function normalizeName(text: string) {
	return text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]/g, '');
}

/** Whether `part` starts at one of the words of `text`, e.g. "abschluss" in "Eröffnung und Abschluss". */
function startsAtWord(text: string, part: string) {
	const words = text.split(/[\s_\-&/.]+/);
	return words.some((_, i) => normalizeName(words.slice(i).join('')).startsWith(part));
}

/** One name continues the other from a word start, at least three characters each. */
export function similarName(a: string, b: string) {
	const [x, y] = [normalizeName(a), normalizeName(b)];
	if (x.length < 3 || y.length < 3) return false;
	return startsAtWord(a, y) || startsAtWord(b, x);
}

const pathOf = (option: CategoryOption) => option.label.split(' › ');

/** Categories directly below `parentPath` (the main categories for an empty path). */
function childrenOf(options: CategoryOption[], parentPath: string[]) {
	return options.filter((o) => {
		const path = pathOf(o);
		return path.length === parentPath.length + 1 && parentPath.every((s, i) => path[i] === s);
	});
}

function suggestOne(folder: ZipFolder, candidates: CategoryOption[]): Mapping {
	const exact = candidates.find((c) => normalizeName(c.name) === normalizeName(folder.name));
	const close = exact ?? candidates.find((c) => similarName(c.name, folder.name));
	if (close) return { target: close.id, newName: '', match: exact ? 'exact' : 'similar' };
	return { target: 'NEW', newName: folder.name, match: 'new' };
}

/**
 * Suggests a category per folder, parents first: an exact name match among the categories
 * below the parent's category, then a similar name, otherwise a new category. Choices the
 * person made by hand are kept.
 */
export function suggestMappings(
	folders: ZipFolder[],
	options: CategoryOption[],
	previous: Record<string, Mapping> = {}
): Record<string, Mapping> {
	const result: Record<string, Mapping> = {};
	// The category path each folder resolved to, null below new or unmapped folders
	const resolved: Record<string, string[] | null> = { '': [] };
	for (const folder of folders) {
		const kept = previous[folder.key]?.match === 'manual' ? previous[folder.key] : undefined;
		if (folder.key === '') {
			result[''] = kept ?? { target: 'NONE', newName: '', match: 'none' };
			continue;
		}
		const parentPath = resolved[folder.key.split('/').slice(0, -1).join('/')] ?? null;
		const mapping = kept ?? suggestOne(folder, parentPath ? childrenOf(options, parentPath) : []);
		const chosen = options.find((o) => o.id === mapping.target);
		resolved[folder.key] = chosen ? pathOf(chosen) : null;
		result[folder.key] = mapping;
	}
	return result;
}

/** What the server needs per folder: an existing category, a new name, or neither. */
export function folderTarget(map: Mapping | undefined) {
	if (!map || map.target === 'NONE') return { categoryId: null, newName: null };
	if (map.target === 'NEW') return { categoryId: null, newName: map.newName };
	return { categoryId: map.target, newName: null };
}
