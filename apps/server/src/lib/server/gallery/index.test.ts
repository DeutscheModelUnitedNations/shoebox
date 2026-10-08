import { describe, expect, it } from 'vitest';
import { getCategoryPage, getEvent, getSeries, listSeries } from './index';

const guest = { isTeam: false };
const team = { isTeam: true };

describe('gallery service', () => {
	it('lists every series with its events', () => {
		const series = listSeries(guest);
		expect(series.map((s) => s.slug)).toEqual(['mun-sh', 'munbw', 'verein']);
		expect(series[0].events[0]).toMatchObject({ name: 'MUN-SH', edition: '2026' });
	});

	it('hides team-private photos from guests', () => {
		const guestEvent = getEvent('mun-sh', '2026', guest)!;
		const teamEvent = getEvent('mun-sh', '2026', team)!;
		expect(teamEvent.photoCount).toBeGreaterThan(guestEvent.photoCount);

		const page = getCategoryPage('mun-sh', '2026', ['gremien'], guest)!;
		expect(page.photos.every((p) => p.visibility === 'PUBLIC')).toBe(true);
	});

	it('drops categories without visible photos', () => {
		const slugs = (viewer: typeof guest) =>
			getEvent('mun-sh', '2026', viewer)!
				.categories.find((c) => c.slug === 'team')!
				.children.map((c) => c.slug);
		expect(slugs(team)).toContain('teamfotos');
		expect(slugs(guest)).not.toContain('teamfotos');
		expect(getCategoryPage('mun-sh', '2026', ['team', 'teamfotos'], guest)).toBeUndefined();
	});

	it('resolves nested category paths into a trail', () => {
		const page = getCategoryPage(
			'mun-sh',
			'2026',
			['gremien', 'generalversammlung', 'debatte'],
			team
		)!;
		expect(page.trail.map((c) => c.slug)).toEqual(['gremien', 'generalversammlung', 'debatte']);
		expect(page.root.slug).toBe('gremien');
		expect(page.photos).toHaveLength(page.trail[2].photoCount);
	});

	it('returns undefined for unknown slugs', () => {
		expect(getSeries('nope', guest)).toBeUndefined();
		expect(getEvent('mun-sh', '1999', guest)).toBeUndefined();
		expect(getCategoryPage('mun-sh', '2026', [], guest)).toBeUndefined();
		expect(getCategoryPage('mun-sh', '2026', ['gremien', 'nope'], guest)).toBeUndefined();
	});
});
