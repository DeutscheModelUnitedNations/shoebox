/**
 * Shared rules for ZIP imports, used by the browser (folder mapping preview) and the processor
 * (the actual import) so both agree on which files count and where they land.
 */

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** Gallery categories reach three levels, deeper folders merge into the third. */
export const ZIP_MAX_DEPTH = 3;

const IGNORED_SEGMENTS = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini']);

function segments(path: string) {
	return path.split('/').filter(Boolean);
}

/** True for directories, system files and anything that is not a supported image. */
export function isIgnoredZipEntry(path: string): boolean {
	const parts = segments(path);
	const name = parts.at(-1) ?? '';
	if (path.endsWith('/') || parts.length === 0) return true;
	if (parts.some((p) => IGNORED_SEGMENTS.has(p) || p.startsWith('._'))) return true;
	const ext = name.split('.').pop()?.toLowerCase() ?? '';
	return !(IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * The folder an entry is filed under: its directory path without `rootToSkip`, cut to
 * ZIP_MAX_DEPTH levels. An empty string means "no folder".
 */
export function zipFolderOf(path: string, rootToSkip?: string | null): string {
	let dirs = segments(path).slice(0, -1);
	if (rootToSkip && dirs[0] === rootToSkip) dirs = dirs.slice(1);
	return dirs.slice(0, ZIP_MAX_DEPTH).join('/');
}

/** The single top level folder all entries share, if there is one. */
export function commonRootFolder(paths: string[]): string | null {
	const roots = new Set(paths.map((p) => (segments(p).length > 1 ? segments(p)[0] : '')));
	const [root] = roots;
	return roots.size === 1 && root ? root : null;
}

export function zipFileName(path: string) {
	return segments(path).at(-1) ?? path;
}
