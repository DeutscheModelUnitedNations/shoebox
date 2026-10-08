/**
 * Demo content from the "Galerie v2" design, used until conferences, categories and media
 * live in the database. The photos are served from `static/demo/`, which is gitignored
 * because they show identifiable people. Without them the pages render with broken images.
 */
import type { DateRange, Download, Photo, Visibility } from '$lib/gallery/types';

export interface DemoCategory {
	slug: string;
	name: string;
	cover?: Photo;
	photos: Photo[];
	children: DemoCategory[];
}

export interface DemoEvent {
	slug: string;
	name: string;
	edition: string;
	subtitle: string;
	location: string;
	description: string;
	dates: DateRange;
	photographers: string[];
	rights: string;
	cover?: Photo;
	hero?: Photo;
	highlights: Photo[];
	categories: DemoCategory[];
}

export interface DemoSeries {
	slug: string;
	name: string;
	shortName: string;
	region: string;
	kind: 'conference' | 'association';
	events: DemoEvent[];
}

const motifs = {
	'gv-kiel': 'Generalversammlung im Plenarsaal',
	'plenum-kiel': 'Plenum im Landeshaus Kiel',
	delegierte: 'Delegation Frankreich während der Debatte',
	pause: 'Gespräche in der Kaffeepause',
	abstimmung: 'Abstimmung über eine Resolution',
	lobbying: 'Lobbying in der informellen Sitzung',
	'saal-stuttgart': 'Sitzungssaal in Stuttgart'
} as const;
type Motif = keyof typeof motifs;

const crops = {
	landscape: { suffix: '', width: 1200, height: 800 },
	portrait: { suffix: '-p', width: 700, height: 933 },
	square: { suffix: '-sq', width: 800, height: 800 }
} as const;
type Crop = keyof typeof crops;

const cropCycle: Crop[] = ['landscape', 'portrait', 'landscape', 'square', 'landscape', 'portrait'];

function downloads(href: string, aspect: number, seed: number): Download[] {
	const jitter = 0.9 + ((seed * 37) % 20) / 100;
	const variant = (
		name: Download['variant'],
		longEdge: number,
		bytesPerPixel: number,
		teamOnly: boolean
	): Download => {
		const width = aspect >= 1 ? longEdge : Math.round(longEdge * aspect);
		const height = aspect >= 1 ? Math.round(longEdge / aspect) : longEdge;
		return {
			variant: name,
			href,
			width,
			height,
			bytes: Math.round(width * height * bytesPerPixel * jitter),
			teamOnly
		};
	};
	return [
		variant('medium', 1024, 0.26, false),
		variant('large', 2048, 0.4, false),
		variant('original', 6000, 0.35, true)
	];
}

interface PhotoOptions {
	photographer: string;
	day: string;
	visibility?: Visibility;
}

function photo(id: number, motif: Motif, crop: Crop, options: PhotoOptions): Photo {
	const { suffix, width, height } = crops[crop];
	const url = `/demo/${motif}${suffix}.jpg`;
	return {
		id: String(id).padStart(4, '0'),
		title: motifs[motif],
		alt: motifs[motif],
		photographer: options.photographer,
		takenAt: options.day,
		visibility: options.visibility ?? 'PUBLIC',
		thumbUrl: url,
		url,
		width,
		height,
		mimeType: 'image/jpeg',
		downloads: downloads(url, width / height, id)
	};
}

/** Hands out sequential photos for one event, cycling through the demo motifs. */
function photoSource(pool: Motif[], options: PhotoOptions) {
	let next = 1;
	return {
		take(count: number, overrides: Partial<PhotoOptions> = {}) {
			return Array.from({ length: count }, () => {
				const n = next++;
				const motif = pool[n % pool.length];
				const crop = cropCycle[n % cropCycle.length];
				// Every ninth photo is team-private unless the category says otherwise
				const visibility = n % 9 === 0 ? 'TEAM' : 'PUBLIC';
				return photo(n, motif, crop, { visibility, ...options, ...overrides });
			});
		},
		pick(motif: Motif, crop: Crop = 'landscape') {
			return photo(next++, motif, crop, options);
		}
	};
}

type Source = ReturnType<typeof photoSource>;

function category(
	slug: string,
	name: string,
	content: Photo[] | DemoCategory[],
	cover?: Photo
): DemoCategory {
	const isLeaf = content.length === 0 || 'url' in content[0];
	return {
		slug,
		name,
		cover,
		photos: isLeaf ? (content as Photo[]) : [],
		children: isLeaf ? [] : (content as DemoCategory[])
	};
}

/** The fully designed event: MUN-SH 2026 with the category tree from the mockups. */
function munsh2026(): DemoEvent {
	const src = photoSource(['delegierte', 'gv-kiel', 'plenum-kiel', 'pause', 'abstimmung'], {
		photographer: 'M. Sayk',
		day: '2026-03-14'
	});
	const highlights = [
		src.pick('gv-kiel'),
		src.pick('delegierte', 'square'),
		src.pick('pause', 'portrait'),
		src.pick('plenum-kiel', 'square'),
		src.pick('delegierte'),
		src.pick('pause')
	];
	return {
		slug: '2026',
		name: 'MUN-SH',
		edition: '2026',
		subtitle: 'Model United Nations Schleswig-Holstein · Landeshaus Kiel',
		location: 'Landeshaus Kiel',
		description:
			'Vom 12. bis 16. März 2026 haben 380 Schüler*innen im Landeshaus Kiel die Vereinten Nationen simuliert – in neun Gremien, mit Pressestab, Rahmenprogramm und einer Abschlussveranstaltung im Plenarsaal. Die Bilder sind urheberrechtlich geschützt; eine Nutzung ist nach Freigabe durch DMUN e. V. möglich.',
		dates: { from: '2026-03-12', to: '2026-03-16', precision: 'day' },
		photographers: ['M. Sayk', 'Pressestab MUN-SH'],
		rights: '© DMUN e. V., alle Rechte vorbehalten',
		cover: src.pick('gv-kiel'),
		hero: src.pick('plenum-kiel'),
		highlights,
		categories: [
			category(
				'gremien',
				'Gremien',
				[
					category('generalversammlung', 'Generalversammlung', [
						category('debatte', 'Debatte', src.take(64)),
						category('abstimmungen', 'Abstimmungen', src.take(31)),
						category('informelle-sitzung', 'Informelle Sitzung', src.take(23))
					]),
					category('sicherheitsrat', 'Sicherheitsrat', src.take(12)),
					category('menschenrechtsrat', 'Menschenrechtsrat', src.take(9)),
					category('wiso', 'Wirtschafts- und Sozialrat', src.take(5)),
					category('unesco', 'UNESCO', src.take(4)),
					category('abrustung', 'Abrüstungsausschuss', src.take(3)),
					category('umwelt', 'Umweltprogramm', src.take(3)),
					category('who', 'Weltgesundheitsversammlung', src.take(2)),
					category('igh', 'Internationaler Gerichtshof', src.take(2))
				],
				src.pick('gv-kiel')
			),
			category(
				'eroeffnung-und-abschluss',
				'Eröffnung und Abschluss',
				[
					category('eroeffnung', 'Eröffnungsveranstaltung', src.take(24)),
					category('abschlussplenum', 'Abschlussplenum', src.take(18))
				],
				src.pick('plenum-kiel')
			),
			category(
				'presse',
				'Presse und Zeitung',
				[
					category('redaktion', 'Redaktion', src.take(17)),
					category('interviews', 'Interviews', src.take(12)),
					category('druck', 'Druck', src.take(8))
				],
				src.pick('delegierte')
			),
			category(
				'rahmenprogramm',
				'Rahmenprogramm',
				[
					category('stadtfuehrung', 'Stadtführung', src.take(19)),
					category('delegiertenabend', 'Delegiertenabend', src.take(22)),
					category('podiumsdiskussion', 'Podiumsdiskussion', src.take(10))
				],
				src.pick('pause')
			),
			category('team', 'Team und Sekretariat', [
				category('projektleitung', 'Projektleitung', src.take(8)),
				category('vorsitzende', 'Vorsitzende', src.take(14)),
				category('teamfotos', 'Teamfotos', src.take(12, { visibility: 'TEAM' }))
			])
		]
	};
}

/** Smaller tree for the other conference editions. */
function conferenceCategories(src: Source, scale: number): DemoCategory[] {
	const n = (count: number) => Math.max(1, Math.round(count * scale));
	return [
		category(
			'gremien',
			'Gremien',
			[
				category('generalversammlung', 'Generalversammlung', src.take(n(60))),
				category('sicherheitsrat', 'Sicherheitsrat', src.take(n(18))),
				category('menschenrechtsrat', 'Menschenrechtsrat', src.take(n(14)))
			],
			src.pick('delegierte')
		),
		category(
			'eroeffnung-und-abschluss',
			'Eröffnung und Abschluss',
			src.take(n(36)),
			src.pick('abstimmung')
		),
		category('presse', 'Presse und Zeitung', src.take(n(28)), src.pick('lobbying', 'square')),
		category('rahmenprogramm', 'Rahmenprogramm', src.take(n(40)), src.pick('pause')),
		category('team', 'Team und Sekretariat', src.take(n(22), { visibility: 'TEAM' }))
	];
}

interface ConferenceOptions {
	short: string;
	full: string;
	place: string;
	edition: string;
	dates: DateRange;
	pool: Motif[];
	cover: Motif;
	scale: number;
}

function conference(o: ConferenceOptions): DemoEvent {
	const src = photoSource(o.pool, { photographer: `Pressestab ${o.short}`, day: o.dates.from });
	const cover = src.pick(o.cover);
	return {
		slug: o.edition,
		name: o.short,
		edition: o.edition,
		subtitle: `${o.full} · ${o.place}`,
		location: o.place,
		description: `Eindrücke von ${o.short} ${o.edition}. Die Bilder sind urheberrechtlich geschützt; eine Nutzung ist nach Freigabe durch DMUN e. V. möglich.`,
		dates: o.dates,
		photographers: [`Pressestab ${o.short}`],
		rights: '© DMUN e. V., alle Rechte vorbehalten',
		cover,
		hero: cover,
		highlights: src.take(6),
		categories: conferenceCategories(src, o.scale)
	};
}

interface ProjectOptions {
	slug: string;
	name: string;
	edition: string;
	dates: DateRange;
	count: number;
	cover?: Motif;
}

function project(o: ProjectOptions): DemoEvent {
	const src = photoSource(['lobbying', 'pause', 'delegierte'], {
		photographer: 'DMUN e. V.',
		day: o.dates.from
	});
	const cover = o.cover ? src.pick(o.cover, 'square') : undefined;
	const photos = src.take(o.count);
	return {
		slug: o.slug,
		name: o.name,
		edition: o.edition,
		subtitle: `${o.name} ${o.edition} · Deutsche Model United Nations e. V.`,
		location: 'Deutschland',
		description: `Bilder aus dem Vereinsleben: ${o.name} ${o.edition}.`,
		dates: o.dates,
		photographers: ['DMUN e. V.'],
		rights: '© DMUN e. V., alle Rechte vorbehalten',
		cover,
		hero: cover,
		highlights: photos.slice(0, 6),
		categories: [category('alle', 'Alle Bilder', photos, cover)]
	};
}

export const demoSeries: DemoSeries[] = [
	{
		slug: 'mun-sh',
		name: 'Model United Nations Schleswig-Holstein',
		shortName: 'MUN-SH',
		region: 'Kiel · Schleswig-Holstein',
		kind: 'conference',
		events: [
			munsh2026(),
			conference({
				short: 'MUN-SH',
				full: 'Model United Nations Schleswig-Holstein',
				place: 'Landeshaus Kiel',
				edition: '2025',
				dates: { from: '2025-03-01', precision: 'month' },
				pool: ['plenum-kiel', 'gv-kiel', 'delegierte', 'pause'],
				cover: 'plenum-kiel',
				scale: 1.4
			}),
			conference({
				short: 'MUN-SH',
				full: 'Model United Nations Schleswig-Holstein',
				place: 'Landeshaus Kiel',
				edition: '2024',
				dates: { from: '2024-03-01', precision: 'month' },
				pool: ['pause', 'gv-kiel', 'delegierte'],
				cover: 'pause',
				scale: 1
			})
		]
	},
	{
		slug: 'munbw',
		name: 'Model United Nations Baden-Württemberg',
		shortName: 'MUNBW',
		region: 'Stuttgart · Baden-Württemberg',
		kind: 'conference',
		events: [
			conference({
				short: 'MUNBW',
				full: 'Model United Nations Baden-Württemberg',
				place: 'Landtag Stuttgart',
				edition: '2026',
				dates: { from: '2026-05-01', precision: 'month' },
				pool: ['abstimmung', 'saal-stuttgart', 'lobbying', 'delegierte'],
				cover: 'abstimmung',
				scale: 1.35
			}),
			conference({
				short: 'MUNBW',
				full: 'Model United Nations Baden-Württemberg',
				place: 'Landtag Stuttgart',
				edition: '2025',
				dates: { from: '2025-05-01', precision: 'month' },
				pool: ['lobbying', 'saal-stuttgart', 'abstimmung'],
				cover: 'lobbying',
				scale: 1.2
			})
		]
	},
	{
		slug: 'verein',
		name: 'Vereinsleben und Projekte',
		shortName: 'Verein',
		region: 'Verein',
		kind: 'association',
		events: [
			project({
				slug: 'vorsitzenden-workshop-2026',
				name: 'Vorsitzenden-Workshop',
				edition: '2026',
				dates: { from: '2026-01-01', precision: 'month' },
				count: 46,
				cover: 'lobbying'
			}),
			project({
				slug: 'mitgliederversammlung-2025',
				name: 'Mitgliederversammlung',
				edition: '2025',
				dates: { from: '2025-11-01', precision: 'month' },
				count: 31
			}),
			project({
				slug: 'schulbesuche-2025',
				name: 'Schulbesuche',
				edition: '2025',
				dates: { from: '2025-01-01', precision: 'year' },
				count: 58
			})
		]
	}
];
