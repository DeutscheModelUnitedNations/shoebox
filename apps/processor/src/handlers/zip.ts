import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { enqueueJob, mediaByHash, nextMediaSortOrder, schema } from '@shoebox/db';
import {
	isIgnoredZipEntry,
	nanoid,
	storageKeys,
	zipFileName,
	zipFolderOf,
	type JobPayload
} from '@shoebox/shared';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { downloadToFile, upload } from '../s3io';
import type { HandlerContext, JobHandler } from './index';

/** Same limit as the single file upload. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const mimeTypes: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp'
};

function openZip(path: string): Promise<ZipFile> {
	return new Promise((resolve, reject) =>
		yauzl.open(path, { lazyEntries: true, autoClose: false }, (error, zip) =>
			error || !zip ? reject(error) : resolve(zip)
		)
	);
}

function readEntry(zip: ZipFile, entry: Entry): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		zip.openReadStream(entry, (error, stream) => {
			if (error || !stream) return reject(error);
			const chunks: Buffer[] = [];
			stream.on('data', (chunk: Buffer) => chunks.push(chunk));
			stream.on('end', () => resolve(Buffer.concat(chunks)));
			stream.on('error', reject);
		})
	);
}

/** Walks the archive one entry at a time without loading it into memory. */
async function* entries(zip: ZipFile): AsyncGenerator<Entry> {
	let resolveNext: ((entry: Entry | null) => void) | undefined;
	let failed: unknown;
	zip.on('entry', (entry: Entry) => resolveNext?.(entry));
	zip.on('end', () => resolveNext?.(null));
	zip.on('error', (error) => {
		failed = error;
		resolveNext?.(null);
	});
	while (true) {
		const next = await new Promise<Entry | null>((resolve) => {
			resolveNext = resolve;
			zip.readEntry();
		});
		if (failed) throw failed;
		if (!next) return;
		yield next;
	}
}

type Payload = JobPayload<'ZIP_IMPORT'>;

/** Uploads one archive image as a new original and describes it. */
async function storeOriginal(ctx: HandlerContext, path: string, data: Buffer) {
	const filename = zipFileName(path);
	const id = nanoid();
	const key = storageKeys.original(id, filename);
	const mimeType = mimeTypes[filename.split('.').pop()!.toLowerCase()];
	await upload(ctx.s3, ctx.config.S3_BUCKET_ORIGINALS, key, data, mimeType);
	return { id, key, filename, mimeType, sha256: createHash('sha256').update(data).digest('hex') };
}

type Stored = Awaited<ReturnType<typeof storeOriginal>>;

function mediaRow(
	payload: Payload,
	file: { path: string; bytes: number; sortOrder: number },
	stored: Stored,
	held: boolean
) {
	return {
		id: stored.id,
		eventId: payload.eventId,
		categoryId: payload.folders[zipFolderOf(file.path, payload.rootToSkip)] ?? null,
		status: held ? ('HELD' as const) : ('PENDING' as const),
		visibility: payload.visibility,
		photographer: payload.photographer,
		sortOrder: file.sortOrder,
		originalKey: stored.key,
		originalFilename: stored.filename,
		mimeType: stored.mimeType,
		bytes: file.bytes,
		sha256: stored.sha256,
		uploadedById: payload.uploadedById,
		uploadBatch: payload.batch
	};
}

/** Stores one image from the archive as a new media item and queues its processing. */
async function importImage(
	ctx: HandlerContext,
	payload: Payload,
	file: { path: string; data: Buffer; sortOrder: number },
	hashes: Map<string, { id: string }>
) {
	const stored = await storeOriginal(ctx, file.path, file.data);
	const duplicateOf = hashes.get(stored.sha256)?.id;
	const row = mediaRow(payload, { ...file, bytes: file.data.byteLength }, stored, !!duplicateOf);
	await ctx.db.insert(schema.media).values(row);
	if (duplicateOf) {
		await ctx.db.insert(schema.duplicateCandidate).values({
			eventId: payload.eventId,
			mediaId: duplicateOf,
			otherMediaId: stored.id,
			similarity: 100
		});
	} else {
		hashes.set(stored.sha256, { id: stored.id });
	}
	await enqueueJob(ctx.db, 'IMAGE_DERIVATIVES', {
		mediaId: stored.id,
		bucket: ctx.config.S3_BUCKET_ORIGINALS,
		key: stored.key,
		public: payload.visibility === 'PUBLIC',
		detectDuplicates: true
	});
	return duplicateOf ? 'held' : 'imported';
}

/**
 * Unpacks an uploaded archive: every image becomes a media item in the category its folder
 * was mapped to, exact duplicates are held for review. The archive is deleted afterwards.
 */
export const zipImport: JobHandler<'ZIP_IMPORT'> = async (ctx, payload) => {
	const dir = await mkdtemp(join(tmpdir(), 'shoebox-zip-'));
	const counts = { imported: 0, held: 0, skipped: 0 };
	try {
		const path = join(dir, 'archive.zip');
		await downloadToFile(ctx.s3, payload.bucket, payload.key, path);
		const zip = await openZip(path);
		const hashes = await mediaByHash(ctx.db, payload.eventId);
		let sortOrder = await nextMediaSortOrder(ctx.db, payload.eventId);
		try {
			for await (const entry of entries(zip)) {
				if (isIgnoredZipEntry(entry.fileName) || entry.uncompressedSize > MAX_FILE_BYTES) {
					counts.skipped++;
					continue;
				}
				const data = await readEntry(zip, entry);
				const file = { path: entry.fileName, data, sortOrder: sortOrder++ };
				counts[await importImage(ctx, payload, file, hashes)]++;
			}
		} finally {
			zip.close();
		}
		await ctx.s3.send(new DeleteObjectCommand({ Bucket: payload.bucket, Key: payload.key }));
		return counts;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
};
