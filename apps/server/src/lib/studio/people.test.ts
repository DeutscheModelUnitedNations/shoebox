import { describe, expect, it } from 'vitest';
import { claimsName, filterPeople, fullName, pickEvent } from './people';

describe('fullName', () => {
	it('joins the known parts', () => {
		expect(fullName({ givenName: 'Anna', familyName: 'Schmidt' })).toBe('Anna Schmidt');
		expect(fullName({ givenName: null, familyName: 'Schmidt' })).toBe('Schmidt');
		expect(fullName({})).toBeNull();
	});

	it('reads OIDC claims', () => {
		expect(claimsName({ given_name: 'Anna', family_name: 'Schmidt' })).toBe('Anna Schmidt');
		expect(claimsName()).toBe('');
	});
});

describe('pickEvent', () => {
	const events = [{ id: 'a' }, { id: 'b' }];

	it('prefers the requested event and falls back to the first', () => {
		expect(pickEvent(events, 'b')).toBe('b');
		expect(pickEvent(events, 'x')).toBe('a');
		expect(pickEvent([], 'x')).toBeNull();
	});
});

describe('filterPeople', () => {
	const people = [
		{ email: 'anna@dmun.de', name: 'Anna Schmidt', role: 'TEAM' },
		{ email: 'photo@example.com', name: null, role: 'PHOTOGRAPHER' }
	];

	it('matches name or email and the role', () => {
		expect(filterPeople(people, ' schmidt ', '')).toEqual([people[0]]);
		expect(filterPeople(people, 'example', '')).toEqual([people[1]]);
		expect(filterPeople(people, '', 'PHOTOGRAPHER')).toEqual([people[1]]);
		expect(filterPeople(people, 'anna', 'PHOTOGRAPHER')).toEqual([]);
	});
});
