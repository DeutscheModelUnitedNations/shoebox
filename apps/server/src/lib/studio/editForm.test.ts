import { describe, expect, it } from 'vitest';
import { editInput, formFromSelection } from './editForm';
import type { StudioMedia } from './types';

const media = (id: string, fields: Partial<StudioMedia> = {}): StudioMedia => ({
	id,
	title: 'Plenum',
	filename: `${id}.jpg`,
	photographer: 'Anna',
	visibility: 'PUBLIC',
	status: 'READY',
	thumbUrl: null,
	largeUrl: null,
	width: null,
	height: null,
	bytes: null,
	takenAt: null,
	categoryId: 'gv',
	isCover: false,
	highlight: false,
	duplicate: false,
	deletedAt: null,
	...fields
});

describe('formFromSelection', () => {
	it('prefills shared values and leaves mixed ones empty', () => {
		const selection = [media('a'), media('b', { title: 'Pause', categoryId: null })];
		expect(formFromSelection(selection)).toEqual({
			caption: '',
			photographer: 'Anna',
			category: '',
			visibility: 'PUBLIC'
		});
	});

	it('maps a shared missing category to none', () => {
		expect(formFromSelection([media('a', { categoryId: null })]).category).toBe('none');
	});
});

describe('editInput', () => {
	const selection = [media('a'), media('b', { title: 'Pause' })];

	it('keeps mixed fields that were left empty and moves only on change', () => {
		const form = { caption: '', photographer: 'Ben', category: 'gv', visibility: '' };
		expect(editInput(form, selection)).toEqual({
			mediaIds: ['a', 'b'],
			title: null,
			photographer: 'Ben',
			moveCategory: false,
			categoryId: null,
			visibility: null
		});
	});

	it('moves to no category and sets visibility', () => {
		const form = { caption: 'Neu', photographer: 'Anna', category: 'none', visibility: 'TEAM' };
		expect(editInput(form, selection)).toMatchObject({
			title: 'Neu',
			moveCategory: true,
			categoryId: null,
			visibility: 'TEAM'
		});
	});
});
