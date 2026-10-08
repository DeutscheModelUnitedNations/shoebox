import { describe, expect, it } from 'vitest';
import { duplicateFields, flippedIds, mediaChangeSet, uploadingRow } from './mediaRows';

const target = {
	eventId: 'e',
	categoryId: null,
	visibility: 'PUBLIC' as const,
	photographer: 'Anna',
	caption: 'Plenum',
	batch: 'b',
	uploadedById: 'u'
};

describe('uploadingRow', () => {
	it('sanitizes the filename and places the original under the media id', () => {
		const row = uploadingRow(
			'm1',
			target,
			{ name: 'a/b.jpg', size: 3, type: 'image/jpeg', sha256: 'x' },
			7
		);
		expect(row).toMatchObject({
			status: 'UPLOADING',
			originalFilename: 'a_b.jpg',
			sortOrder: 7,
			title: 'Plenum',
			uploadBatch: 'b'
		});
		expect(row.originalKey).toContain('m1');
	});
});

describe('duplicateFields', () => {
	it('names the earlier photo or nothing', () => {
		expect(duplicateFields({ id: 'a', filename: 'a.jpg' })).toEqual({
			duplicateOfId: 'a',
			duplicateOfName: 'a.jpg'
		});
		expect(duplicateFields(undefined)).toEqual({ duplicateOfId: null, duplicateOfName: null });
	});
});

describe('mediaChangeSet', () => {
	it('only sets the given fields', () => {
		expect(mediaChangeSet({})).toEqual({});
		expect(mediaChangeSet({ highlight: false })).toEqual({ highlight: false });
		expect(mediaChangeSet({ title: 'T', visibility: 'TEAM' })).toEqual({
			title: 'T',
			alt: 'T',
			visibility: 'TEAM'
		});
	});

	it('moves to no category only when asked', () => {
		expect(mediaChangeSet({ categoryId: null })).toEqual({});
		expect(mediaChangeSet({ moveCategory: true })).toEqual({ categoryId: null });
		expect(mediaChangeSet({ photographer: '' })).toEqual({ photographer: '' });
	});
});

describe('flippedIds', () => {
	const before = [
		{ id: 'a', visibility: 'PUBLIC' as const },
		{ id: 'b', visibility: 'TEAM' as const }
	];

	it('lists photos whose visibility changes', () => {
		expect(flippedIds(before, 'TEAM')).toEqual(['a']);
		expect(flippedIds(before, null)).toEqual([]);
	});
});
