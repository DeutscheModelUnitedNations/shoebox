import { describe, expect, it } from 'vitest';
import { newEventDraft, toEventDraft } from './drafts';

const conference = {
	id: 'sh',
	name: 'MUN Schleswig-Holstein',
	shortName: 'MUN-SH',
	region: 'Kiel',
	kind: 'CONFERENCE' as const
};

describe('newEventDraft', () => {
	it('names a conference edition after its series', () => {
		expect(newEventDraft(conference, 2027)).toMatchObject({
			seriesId: 'sh',
			name: 'MUN-SH',
			subtitle: 'MUN Schleswig-Holstein',
			edition: '2027',
			dateFrom: '2027-03-01',
			visibility: 'HIDDEN'
		});
	});

	it('leaves the name open for associations and without series', () => {
		expect(newEventDraft({ ...conference, kind: 'ASSOCIATION' }, 2027).name).toBe('');
		expect(newEventDraft(undefined, 2027)).toMatchObject({ seriesId: '', name: '' });
	});
});

describe('toEventDraft', () => {
	it('drops fields the mutation input does not take', () => {
		const loaded = { id: 'e1', ...newEventDraft(conference, 2027) };
		expect(toEventDraft(loaded)).not.toHaveProperty('id');
		expect(toEventDraft(loaded)).toEqual(newEventDraft(conference, 2027));
	});
});
