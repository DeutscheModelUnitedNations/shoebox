import { describe, expect, it } from 'vitest';
import { storageKeys, type DerivativeResult } from '@shoebox/shared';
import type { Photo } from '$lib/gallery/types';
import { assemble, buildTree, toPhoto, type CategoryRow, type MediaRow } from './assemble';

const now = new Date('2026-03-14T09:00:00Z');

function derivative(id: string, variant: string, width: number, isPublic = true): DerivativeResult {
	return {
		variant,
		key: storageKeys.derivative(id, variant, 'webp'),
		width,
		height: Math.round((width * 2) / 3),
		bytes: width * 100,
		mimeType: 'image/webp',
		watermarked: variant !== 'thumb',
		public: isPublic
	};
}

function mediaRow(id: string, overrides: Partial<MediaRow> = {}): MediaRow {
	return {
		id,
		createdAt: now,
		updatedAt: now,
		eventId: 'e1',
		categoryId: 'c1',
		kind: 'IMAGE',
		visibility: 'PUBLIC',
		status: 'READY',
		highlight: false,
		sortOrder: 0,
		title: 'Plenum',
		alt: '',
		photographer: 'M. Sayk',
		takenAt: now,
		originalKey: storageKeys.original(id, 'a.jpg'),
		originalFilename: 'a.jpg',
		mimeType: 'image/jpeg',
		bytes: 8_000_000,
		width: 6000,
		height: 4000,
		blurhash: null,
		derivatives: [
			derivative(id, 'thumb', 320),
			derivative(id, 'medium', 1024),
			derivative(id, 'large', 2048),
			{
				...derivative(id, 'large', 2048, false),
				key: storageKeys.cleanDerivative(id, 'large', 'webp')
			}
		],
		exif: null,
		gps: null,
		...overrides
	};
}

function categoryRow(id: string, parentId: string | null, slug: string): CategoryRow {
	return {
		id,
		createdAt: now,
		updatedAt: now,
		eventId: 'e1',
		parentId,
		slug,
		name: slug,
		sortOrder: 0,
		coverMediaId: null
	};
}

const urlOf = (d: DerivativeResult) => `${d.public ? 'public' : 'signed'}:${d.key}`;

describe('toPhoto', () => {
	it('shows the watermarked variants and links downloads to the endpoint', async () => {
		const photo = (await toPhoto(mediaRow('m1'), urlOf))!;
		expect(photo.thumbUrl).toBe('public:media/m1/thumb.webp');
		expect(photo.url).toBe('public:media/m1/large.webp');
		expect(photo.downloads.map((d) => [d.variant, d.teamOnly])).toEqual([
			['medium', false],
			['large', false],
			['original', true]
		]);
		expect(photo.downloads[2]).toMatchObject({ width: 6000, bytes: 8_000_000 });
		expect(photo.downloads[0].href).toBe('/api/media/m1/download?variant=medium');
	});

	it('offers one size when medium and large are identical', async () => {
		const row = mediaRow('m2');
		row.derivatives = [
			derivative('m2', 'thumb', 320),
			derivative('m2', 'medium', 700),
			derivative('m2', 'large', 700)
		];
		const photo = (await toPhoto(row, urlOf))!;
		expect(photo.downloads.map((d) => d.variant)).toEqual(['large', 'original']);
	});

	it('signs private derivatives and skips unprocessed media', async () => {
		const row = mediaRow('m3', { visibility: 'TEAM' });
		row.derivatives = row.derivatives.map((d) => ({ ...d, public: false }));
		expect((await toPhoto(row, urlOf))!.url).toBe('signed:media/m3/large.webp');
		expect(await toPhoto(mediaRow('m4', { derivatives: [] }), urlOf)).toBeUndefined();
	});
});

describe('buildTree and assemble', () => {
	const categories = [
		categoryRow('c1', null, 'gremien'),
		categoryRow('c2', 'c1', 'generalversammlung'),
		categoryRow('c3', null, 'presse')
	];
	const media = [
		mediaRow('a', { categoryId: 'c2', highlight: true }),
		mediaRow('b', { categoryId: 'c3' })
	];
	const photos = new Map<string, Photo>();

	it('nests categories and attaches photos', async () => {
		for (const m of media) photos.set(m.id, (await toPhoto(m, urlOf))!);
		const tree = buildTree(categories, media, photos);
		expect(tree.map((c) => c.slug)).toEqual(['gremien', 'presse']);
		expect(tree[0].children[0].photos.map((p) => p.id)).toEqual(['a']);
		expect(tree[1].photos.map((p) => p.id)).toEqual(['b']);
	});

	it('assembles series with events, covers and highlights', () => {
		const [series] = assemble({
			series: [
				{
					id: 's1',
					createdAt: now,
					updatedAt: now,
					slug: 'mun-sh',
					name: 'MUN-SH',
					shortName: 'MUN-SH',
					region: 'Kiel',
					kind: 'CONFERENCE',
					sortOrder: 0
				}
			],
			events: [
				{
					id: 'e1',
					createdAt: now,
					updatedAt: now,
					seriesId: 's1',
					slug: '2026',
					name: 'MUN-SH',
					edition: '2026',
					subtitle: '',
					location: '',
					description: '',
					dateFrom: '2026-03-12',
					dateTo: null,
					datePrecision: 'DAY',
					photographers: [],
					rights: '',
					coverMediaId: 'b',
					heroMediaId: 'missing'
				}
			],
			categories,
			media,
			photos
		});
		expect(series.kind).toBe('conference');
		const [event] = series.events;
		expect(event.dates).toEqual({ from: '2026-03-12', to: undefined, precision: 'day' });
		expect(event.cover?.id).toBe('b');
		expect(event.hero).toBeUndefined();
		expect(event.highlights.map((p) => p.id)).toEqual(['a']);
	});
});
