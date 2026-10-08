export type PersonRole = 'ADMIN' | 'PHOTOGRAPHER' | 'TEAM' | 'GUEST';

/** "Given Family" from OIDC claims or user rows, null when neither is known. */
export function fullName(person: { givenName?: string | null; familyName?: string | null }) {
	return [person.givenName, person.familyName].filter(Boolean).join(' ') || null;
}

/** The display name from OIDC claims, '' when the provider sends none. */
export function claimsName(
	claims: { given_name?: string | null; family_name?: string | null } = {}
) {
	return fullName({ givenName: claims.given_name, familyName: claims.family_name }) ?? '';
}

/** The requested event when the person may upload there, otherwise their first one. */
export function pickEvent(events: { id: string }[], requested: string | null) {
	return (events.find((e) => e.id === requested) ?? events[0])?.id ?? null;
}

/** People whose name or email contains the search term, optionally with one role. */
export function filterPeople<P extends { email: string; name: string | null; role: string }>(
	people: P[],
	search: string,
	role: string
) {
	const term = search.trim().toLowerCase();
	const matches = (p: P) => p.email.includes(term) || (p.name ?? '').toLowerCase().includes(term);
	return people.filter((p) => matches(p) && (role === '' || p.role === role));
}
