import { describe, expect, it } from 'vitest';
import { commonRootFolder, isIgnoredZipEntry, zipFileName, zipFolderOf } from './zip';

describe('zip rules', () => {
	it('ignores directories, system files and non-images', () => {
		expect(isIgnoredZipEntry('Gremien/')).toBe(true);
		expect(isIgnoredZipEntry('__MACOSX/Gremien/._a.jpg')).toBe(true);
		expect(isIgnoredZipEntry('Gremien/.DS_Store')).toBe(true);
		expect(isIgnoredZipEntry('Gremien/._a.jpg')).toBe(true);
		expect(isIgnoredZipEntry('Gremien/notes.txt')).toBe(true);
		expect(isIgnoredZipEntry('Gremien/a.JPG')).toBe(false);
		expect(isIgnoredZipEntry('a.webp')).toBe(false);
	});

	it('files photos under their folder, cut to three levels', () => {
		expect(zipFolderOf('a.jpg')).toBe('');
		expect(zipFolderOf('Gremien/GV/a.jpg')).toBe('Gremien/GV');
		expect(zipFolderOf('Gremien/GV/Tag1/Morgens/a.jpg')).toBe('Gremien/GV/Tag1');
	});

	it('skips a root folder that only carries the conference name', () => {
		expect(zipFolderOf('MUN-SH-2026/Gremien/a.jpg', 'MUN-SH-2026')).toBe('Gremien');
		expect(zipFolderOf('MUN-SH-2026/a.jpg', 'MUN-SH-2026')).toBe('');
		expect(commonRootFolder(['MUN-SH-2026/a.jpg', 'MUN-SH-2026/Gremien/b.jpg'])).toBe(
			'MUN-SH-2026'
		);
		expect(commonRootFolder(['a.jpg', 'Gremien/b.jpg'])).toBeNull();
		expect(commonRootFolder(['A/a.jpg', 'B/b.jpg'])).toBeNull();
	});

	it('names files after their last segment', () => {
		expect(zipFileName('Gremien/GV/IMG_1.jpg')).toBe('IMG_1.jpg');
	});
});
