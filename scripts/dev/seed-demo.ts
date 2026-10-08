/**
 * Seeds the demo gallery from the "Galerie v2" design: series, events, category trees and
 * photos. Every photo is uploaded as an original to the private bucket and queued for the
 * processor, exactly like a real upload, so the pages render from S3.
 *
 * The photos live in `scripts/dev/demo-photos/` (gitignored, they show identifiable people).
 * Ask the maintainers for the archive.
 *
 *   bun run db:seed            seeds once, skips when demo data exists
 *   bun run db:seed --force    deletes the demo series (rows and S3 objects) and seeds again
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { createDb, enqueueJob, schema } from '@shoebox/db';
import {
	createS3Client,
	databaseEnvSchema,
	nanoid,
	s3EnvSchema,
	storageKeys
} from '@shoebox/shared';
import { eq, inArray } from 'drizzle-orm';

const env = databaseEnvSchema.extend(s3EnvSchema.shape).parse(process.env);
const db = createDb(env.DATABASE_URL);
const s3 = createS3Client(env);
const photoDir = join(import.meta.dirname, 'demo-photos');
const log = (msg: string) => console.log(`[seed] ${msg}`);

// ---------------------------------------------------------------------------------------------
// Demo content

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
const crops = ['', '-p', '', '-sq', '', '-p'];

/** A leaf holds photos, a branch holds children. `team` makes every photo team-private. */
interface CategorySpec {
	slug: string;
	name: string;
	photos?: number;
	children?: CategorySpec[];
	team?: boolean;
	noCover?: boolean;
}

interface EventSpec {
	slug: string;
	name: string;
	edition: string;
	subtitle: string;
	location: string;
	description: string;
	dateFrom: string;
	dateTo?: string;
	datePrecision: 'DAY' | 'MONTH' | 'YEAR';
	photographers: string[];
	pool: Motif[];
	categories: CategorySpec[];
	noCover?: boolean;
}

interface SeriesSpec {
	slug: string;
	name: string;
	shortName: string;
	region: string;
	kind: 'CONFERENCE' | 'ASSOCIATION';
	events: EventSpec[];
}

const rights = '© DMUN e. V., alle Rechte vorbehalten';

function conferenceTree(scale = 1): CategorySpec[] {
	const n = (count: number) => Math.max(2, Math.round(count * scale));
	return [
		{
			slug: 'gremien',
			name: 'Gremien',
			children: [
				{ slug: 'generalversammlung', name: 'Generalversammlung', photos: n(10) },
				{ slug: 'sicherheitsrat', name: 'Sicherheitsrat', photos: n(4) }
			]
		},
		{ slug: 'eroeffnung-und-abschluss', name: 'Eröffnung und Abschluss', photos: n(5) },
		{ slug: 'presse', name: 'Presse und Zeitung', photos: n(4) },
		{ slug: 'rahmenprogramm', name: 'Rahmenprogramm', photos: n(5) },
		{ slug: 'team', name: 'Team und Sekretariat', photos: n(4), team: true, noCover: true }
	];
}

interface ConferenceOptions {
	edition: string;
	dateFrom: string;
	pool: Motif[];
	scale: number;
}

const munsh = (o: ConferenceOptions): EventSpec => ({
	slug: o.edition,
	name: 'MUN-SH',
	edition: o.edition,
	subtitle: 'Model United Nations Schleswig-Holstein · Landeshaus Kiel',
	location: 'Landeshaus Kiel',
	description: `Eindrücke von MUN-SH ${o.edition}. Die Bilder sind urheberrechtlich geschützt; eine Nutzung ist nach Freigabe durch DMUN e. V. möglich.`,
	dateFrom: o.dateFrom,
	datePrecision: 'MONTH',
	photographers: ['Pressestab MUN-SH'],
	pool: o.pool,
	categories: conferenceTree(o.scale)
});

const munbw = (o: ConferenceOptions): EventSpec => ({
	slug: o.edition,
	name: 'MUNBW',
	edition: o.edition,
	subtitle: 'Model United Nations Baden-Württemberg · Landtag Stuttgart',
	location: 'Landtag Stuttgart',
	description: `Eindrücke von MUNBW ${o.edition}. Die Bilder sind urheberrechtlich geschützt; eine Nutzung ist nach Freigabe durch DMUN e. V. möglich.`,
	dateFrom: o.dateFrom,
	datePrecision: 'MONTH',
	photographers: ['Pressestab MUNBW'],
	pool: o.pool,
	categories: conferenceTree(o.scale)
});

interface ProjectOptions {
	slug: string;
	name: string;
	edition: string;
	dateFrom: string;
	datePrecision: 'MONTH' | 'YEAR';
	photos: number;
	noCover?: boolean;
}

const project = (o: ProjectOptions): EventSpec => ({
	slug: o.slug,
	name: o.name,
	edition: o.edition,
	subtitle: `${o.name} ${o.edition} · Deutsche Model United Nations e. V.`,
	location: 'Deutschland',
	description: `Bilder aus dem Vereinsleben: ${o.name} ${o.edition}.`,
	dateFrom: o.dateFrom,
	datePrecision: o.datePrecision,
	photographers: ['DMUN e. V.'],
	pool: ['lobbying', 'pause', 'delegierte'],
	categories: [{ slug: 'alle', name: 'Alle Bilder', photos: o.photos, noCover: o.noCover }],
	noCover: o.noCover
});

const demo: SeriesSpec[] = [
	{
		slug: 'mun-sh',
		name: 'Model United Nations Schleswig-Holstein',
		shortName: 'MUN-SH',
		region: 'Kiel · Schleswig-Holstein',
		kind: 'CONFERENCE',
		events: [
			{
				slug: '2026',
				name: 'MUN-SH',
				edition: '2026',
				subtitle: 'Model United Nations Schleswig-Holstein · Landeshaus Kiel',
				location: 'Landeshaus Kiel',
				description:
					'Vom 12. bis 16. März 2026 haben 380 Schüler*innen im Landeshaus Kiel die Vereinten Nationen simuliert – in neun Gremien, mit Pressestab, Rahmenprogramm und einer Abschlussveranstaltung im Plenarsaal. Die Bilder sind urheberrechtlich geschützt; eine Nutzung ist nach Freigabe durch DMUN e. V. möglich.',
				dateFrom: '2026-03-12',
				dateTo: '2026-03-16',
				datePrecision: 'DAY',
				photographers: ['M. Sayk', 'Pressestab MUN-SH'],
				pool: ['delegierte', 'gv-kiel', 'plenum-kiel', 'pause', 'abstimmung'],
				categories: [
					{
						slug: 'gremien',
						name: 'Gremien',
						children: [
							{
								slug: 'generalversammlung',
								name: 'Generalversammlung',
								children: [
									{ slug: 'debatte', name: 'Debatte', photos: 18 },
									{ slug: 'abstimmungen', name: 'Abstimmungen', photos: 10 },
									{ slug: 'informelle-sitzung', name: 'Informelle Sitzung', photos: 8 }
								]
							},
							{ slug: 'sicherheitsrat', name: 'Sicherheitsrat', photos: 6 },
							{ slug: 'menschenrechtsrat', name: 'Menschenrechtsrat', photos: 5 },
							{ slug: 'wiso', name: 'Wirtschafts- und Sozialrat', photos: 4 },
							{ slug: 'unesco', name: 'UNESCO', photos: 3 },
							{ slug: 'umwelt', name: 'Umweltprogramm', photos: 2 }
						]
					},
					{
						slug: 'eroeffnung-und-abschluss',
						name: 'Eröffnung und Abschluss',
						children: [
							{ slug: 'eroeffnung', name: 'Eröffnungsveranstaltung', photos: 8 },
							{ slug: 'abschlussplenum', name: 'Abschlussplenum', photos: 6 }
						]
					},
					{
						slug: 'presse',
						name: 'Presse und Zeitung',
						children: [
							{ slug: 'redaktion', name: 'Redaktion', photos: 6 },
							{ slug: 'interviews', name: 'Interviews', photos: 4 },
							{ slug: 'druck', name: 'Druck', photos: 3 }
						]
					},
					{
						slug: 'rahmenprogramm',
						name: 'Rahmenprogramm',
						children: [
							{ slug: 'stadtfuehrung', name: 'Stadtführung', photos: 6 },
							{ slug: 'delegiertenabend', name: 'Delegiertenabend', photos: 8 },
							{ slug: 'podiumsdiskussion', name: 'Podiumsdiskussion', photos: 4 }
						]
					},
					{
						slug: 'team',
						name: 'Team und Sekretariat',
						noCover: true,
						children: [
							{ slug: 'projektleitung', name: 'Projektleitung', photos: 4 },
							{ slug: 'vorsitzende', name: 'Vorsitzende', photos: 5 },
							{ slug: 'teamfotos', name: 'Teamfotos', photos: 6, team: true }
						]
					}
				]
			},
			munsh({
				edition: '2025',
				dateFrom: '2025-03-01',
				pool: ['plenum-kiel', 'gv-kiel', 'delegierte', 'pause'],
				scale: 1.2
			}),
			munsh({ edition: '2024', dateFrom: '2024-03-01', pool: ['pause', 'gv-kiel'], scale: 0.9 })
		]
	},
	{
		slug: 'munbw',
		name: 'Model United Nations Baden-Württemberg',
		shortName: 'MUNBW',
		region: 'Stuttgart · Baden-Württemberg',
		kind: 'CONFERENCE',
		events: [
			munbw({
				edition: '2026',
				dateFrom: '2026-05-01',
				pool: ['abstimmung', 'saal-stuttgart', 'lobbying', 'delegierte'],
				scale: 1.1
			}),
			munbw({
				edition: '2025',
				dateFrom: '2025-05-01',
				pool: ['lobbying', 'saal-stuttgart', 'abstimmung'],
				scale: 1
			})
		]
	},
	{
		slug: 'verein',
		name: 'Vereinsleben und Projekte',
		shortName: 'Verein',
		region: 'Verein',
		kind: 'ASSOCIATION',
		events: [
			project({
				slug: 'vorsitzenden-workshop-2026',
				name: 'Vorsitzenden-Workshop',
				edition: '2026',
				dateFrom: '2026-01-01',
				datePrecision: 'MONTH',
				photos: 12
			}),
			project({
				slug: 'mitgliederversammlung-2025',
				name: 'Mitgliederversammlung',
				edition: '2025',
				dateFrom: '2025-11-01',
				datePrecision: 'MONTH',
				photos: 8,
				noCover: true
			}),
			project({
				slug: 'schulbesuche-2025',
				name: 'Schulbesuche',
				edition: '2025',
				dateFrom: '2025-01-01',
				datePrecision: 'YEAR',
				photos: 10,
				noCover: true
			})
		]
	}
];

// ---------------------------------------------------------------------------------------------
// Seeding

type MediaRow = typeof schema.media.$inferInsert;

async function deleteObjects(bucket: string, prefix: string) {
	const { Contents = [] } = await s3.send(
		new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
	);
	if (Contents.length === 0) return;
	await s3.send(
		new DeleteObjectsCommand({
			Bucket: bucket,
			Delete: { Objects: Contents.map((c) => ({ Key: c.Key! })) }
		})
	);
}

async function reset() {
	const slugs = demo.map((s) => s.slug);
	const existing = await db
		.select({ mediaId: schema.media.id })
		.from(schema.media)
		.innerJoin(schema.event, eq(schema.media.eventId, schema.event.id))
		.innerJoin(schema.series, eq(schema.event.seriesId, schema.series.id))
		.where(inArray(schema.series.slug, slugs));
	for (const { mediaId } of existing) {
		await deleteObjects(env.S3_BUCKET_ORIGINALS, `media/${mediaId}/`);
		await deleteObjects(env.S3_BUCKET_DERIVATIVES, `media/${mediaId}/`);
	}
	await db.delete(schema.series).where(inArray(schema.series.slug, slugs));
	log(`removed demo series and ${existing.length} photos`);
}

/** Hands out photos for one event, cycling through its motif pool and the crops. */
function photoSource(eventId: string, spec: EventSpec) {
	let n = 0;
	const day = new Date(`${spec.dateFrom}T09:00:00Z`);
	return (categoryId: string, teamOnly: boolean): MediaRow => {
		n++;
		const motif = spec.pool[n % spec.pool.length];
		const filename = `${motif}${crops[n % crops.length]}.jpg`;
		const id = nanoid();
		return {
			id,
			eventId,
			categoryId,
			visibility: teamOnly || n % 9 === 0 ? 'TEAM' : 'PUBLIC',
			highlight: n % 7 === 1,
			sortOrder: n,
			title: motifs[motif],
			alt: motifs[motif],
			photographer: spec.photographers[0],
			takenAt: new Date(day.getTime() + n * 7 * 60_000),
			originalKey: storageKeys.original(id, filename),
			originalFilename: filename,
			mimeType: 'image/jpeg'
		};
	};
}

async function setCategoryCover(categoryId: string, media: MediaRow[]) {
	const cover = media.find((m) => m.visibility === 'PUBLIC')?.id;
	if (!cover) return;
	await db
		.update(schema.category)
		.set({ coverMediaId: cover })
		.where(eq(schema.category.id, categoryId));
}

/** Inserts one category with its own photos, then its children, depth first. */
// fallow-ignore-next-line complexity -- dev seed, exercised by running it
async function seedCategory(
	eventId: string,
	spec: CategorySpec,
	place: { parentId: string | null; sortOrder: number; team: boolean },
	take: ReturnType<typeof photoSource>
): Promise<MediaRow[]> {
	const [row] = await db
		.insert(schema.category)
		.values({
			eventId,
			parentId: place.parentId,
			slug: spec.slug,
			name: spec.name,
			sortOrder: place.sortOrder
		})
		.returning();
	const team = place.team || !!spec.team;
	const own = Array.from({ length: spec.photos ?? 0 }, () => take(row.id, team));
	if (own.length > 0) await db.insert(schema.media).values(own);
	const nested = await seedCategories(eventId, spec.children ?? [], row.id, take, team);
	const all = [...own, ...nested];
	if (!spec.noCover) await setCategoryCover(row.id, all);
	return all;
}

async function seedCategories(
	eventId: string,
	specs: CategorySpec[],
	parentId: string | null,
	take: ReturnType<typeof photoSource>,
	team = false
): Promise<MediaRow[]> {
	const media: MediaRow[] = [];
	for (const [sortOrder, spec] of specs.entries()) {
		media.push(...(await seedCategory(eventId, spec, { parentId, sortOrder, team }, take)));
	}
	return media;
}

async function seedEvent(seriesId: string, spec: EventSpec) {
	const [event] = await db
		.insert(schema.event)
		.values({
			seriesId,
			slug: spec.slug,
			name: spec.name,
			edition: spec.edition,
			subtitle: spec.subtitle,
			location: spec.location,
			description: spec.description,
			dateFrom: spec.dateFrom,
			dateTo: spec.dateTo,
			datePrecision: spec.datePrecision,
			photographers: spec.photographers,
			rights
		})
		.returning();

	const media = await seedCategories(event.id, spec.categories, null, photoSource(event.id, spec));
	return { event, media };
}

async function uploadAndQueue(rows: MediaRow[]) {
	let done = 0;
	for (const row of rows) {
		const body = readFileSync(join(photoDir, row.originalFilename));
		await s3.send(
			new PutObjectCommand({
				Bucket: env.S3_BUCKET_ORIGINALS,
				Key: row.originalKey,
				Body: body,
				ContentType: row.mimeType
			})
		);
		await db
			.update(schema.media)
			.set({ bytes: body.byteLength })
			.where(eq(schema.media.id, row.id!));
		await enqueueJob(db, 'IMAGE_DERIVATIVES', {
			mediaId: row.id!,
			bucket: env.S3_BUCKET_ORIGINALS,
			key: row.originalKey,
			public: row.visibility === 'PUBLIC'
		});
		if (++done % 50 === 0) log(`uploaded ${done}/${rows.length}`);
	}
}

const force = process.argv.includes('--force');
const present = await db.select({ id: schema.series.id }).from(schema.series).limit(1);
if (present.length > 0 && !force) {
	log('demo data exists, run with --force to replace it');
	process.exit(0);
}
if (force) await reset();

const allMedia: MediaRow[] = [];
for (const [i, seriesSpec] of demo.entries()) {
	const [row] = await db
		.insert(schema.series)
		.values({
			slug: seriesSpec.slug,
			name: seriesSpec.name,
			shortName: seriesSpec.shortName,
			region: seriesSpec.region,
			kind: seriesSpec.kind,
			sortOrder: i
		})
		.returning();
	for (const eventSpec of seriesSpec.events) {
		const { event, media } = await seedEvent(row.id, eventSpec);
		allMedia.push(...media);
		const firstPublic = media.find((m) => m.visibility === 'PUBLIC')?.id;
		if (firstPublic && !eventSpec.noCover) {
			await db
				.update(schema.event)
				.set({ coverMediaId: firstPublic, heroMediaId: firstPublic })
				.where(eq(schema.event.id, event.id));
		}
	}
	log(`seeded ${seriesSpec.shortName}`);
}

log(`uploading ${allMedia.length} originals and queueing them for the processor`);
await uploadAndQueue(allMedia);
log('done, the processor renders the derivatives in the background (bun run dev:processor)');
process.exit(0);
