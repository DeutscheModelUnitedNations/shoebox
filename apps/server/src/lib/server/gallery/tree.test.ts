import { describe, expect, it } from 'vitest';
import type { Photo, Visibility } from '$lib/gallery/types';
import {
	buildCategoryPage,
	buildEvent,
	buildSeries,
	buildSeriesList,
	type RawCategory,
	type RawSeries
} from './tree';

const guest = { isTeam: false };
const team = { isTeam: true };

let next = 0;
function photos(count: number, visibility: Visibility = 'PUBLIC'): Photo[] {
	return Array.from({ length: count }, () => ({
		id: String(++next),
		title: '',
		alt: '',
		photographer: '',
		takenAt: '2026-03-14T09:00:00Z',
		visibility,
		thumbUrl: '',
		placeholder: null,
		url: '',
		width: 1200,
		height: 800,
		mimeType: 'image/jpeg',
		downloads: []
	}));
}

const category = (slug: string, content: Photo[] | RawCategory[], cover?: Photo): RawCategory => {
	const leaf = content.length === 0 || 'url' in content[0];
	return {
		slug,
		name: slug,
		cover,
		photos: leaf ? (content as Photo[]) : [],
		children: leaf ? [] : (content as RawCategory[])
	};
};

const teamCover = photos(1, 'TEAM')[0];

const all: RawSeries[] = [
	{
		slug: 'mun-sh',
		name: 'Model United Nations Schleswig-Holstein',
		shortName: 'MUN-SH',
		region: 'Kiel',
		kind: 'conference',
		events: [
			{
				slug: '2026',
				name: 'MUN-SH',
				edition: '2026',
				subtitle: '',
				location: '',
				description: '',
				dates: { from: '2026-03-12', to: '2026-03-16', precision: 'day' },
				photographers: ['M. Sayk'],
				rights: '© DMUN e. V.',
				highlights: [...photos(2), ...photos(1, 'TEAM')],
				categories: [
					category('gremien', [
						category('generalversammlung', [
							category('debatte', [...photos(5), ...photos(2, 'TEAM')]),
							category('abstimmungen', photos(3))
						]),
						category('sicherheitsrat', photos(2))
					]),
					category('team', [category('teamfotos', photos(4, 'TEAM'))], teamCover)
				]
			}
		]
	}
];

describe('gallery tree', () => {
	it('counts visible photos per event and top-level category', () => {
		expect(buildSeriesList(all, guest)[0].events[0]).toMatchObject({
			photoCount: 10,
			categoryCount: 1
		});
		expect(buildSeriesList(all, team)[0].events[0]).toMatchObject({
			photoCount: 16,
			categoryCount: 2
		});
	});

	it('hides team-private photos, highlights and covers from guests', () => {
		const event = buildEvent(all, 'mun-sh', '2026', guest)!;
		expect(event.highlights).toHaveLength(2);
		expect(event.categories.map((c) => c.slug)).toEqual(['gremien']);

		const teamEvent = buildEvent(all, 'mun-sh', '2026', team)!;
		expect(teamEvent.categories.find((c) => c.slug === 'team')?.cover).toBe(teamCover);
	});

	it('falls back to the first visible photo as cover and to the photo credits', () => {
		const [first, second] = photos(2).map((p, i) => ({ ...p, photographer: `P${i}` }));
		const untouched: RawSeries = {
			...all[0],
			events: [
				{
					...all[0].events[0],
					photographers: [],
					categories: [category('party', [...photos(1, 'TEAM'), first, second])]
				}
			]
		};
		const event = buildEvent([untouched], 'mun-sh', '2026', guest)!;
		expect(event.categories[0].cover).toBe(first);
		expect(event.cover).toBe(first);
		expect(event.photographers).toEqual(['P0', 'P1']);
	});

	it('resolves nested category paths into a trail', () => {
		const page = buildCategoryPage(
			all,
			'mun-sh',
			'2026',
			['gremien', 'generalversammlung', 'debatte'],
			guest
		)!;
		expect(page.trail.map((c) => c.slug)).toEqual(['gremien', 'generalversammlung', 'debatte']);
		expect(page.root.photoCount).toBe(10);
		expect(page.photos).toHaveLength(5);
	});

	it('returns undefined for unknown or hidden paths', () => {
		expect(buildSeries(all, 'nope', guest)).toBeUndefined();
		expect(buildEvent(all, 'mun-sh', '1999', guest)).toBeUndefined();
		expect(buildCategoryPage(all, 'mun-sh', '2026', [], guest)).toBeUndefined();
		expect(buildCategoryPage(all, 'mun-sh', '2026', ['gremien', 'nope'], guest)).toBeUndefined();
		expect(buildCategoryPage(all, 'mun-sh', '2026', ['team', 'teamfotos'], guest)).toBeUndefined();
	});
});
