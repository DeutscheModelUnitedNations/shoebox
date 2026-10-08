import { encode } from 'blurhash';
import exifr from 'exifr';
import sharp, { type Sharp } from 'sharp';
import { storageKeys, variantSpecs, type DerivativeResult } from '@shoebox/shared';
import { getSetting, markMediaReady, recordSimilarPhotos, schema } from '@shoebox/db';
import { eq } from 'drizzle-orm';
import { downloadToBuffer, upload } from '../s3io';
import { applyWatermark, type WatermarkOptions } from '../watermark';
import type { HandlerContext, JobHandler } from './index';

/** EXIF tags worth keeping. GPS is extracted separately so it can be withheld for public items. */
const EXIF_PICK = [
	'Make',
	'Model',
	'LensModel',
	'DateTimeOriginal',
	'ExposureTime',
	'FNumber',
	'ISO',
	'FocalLength',
	'Artist',
	'Copyright',
	'ImageDescription'
];

export async function extractMetadata(buffer: Buffer) {
	const [exif, gps] = await Promise.all([
		exifr.parse(buffer, { pick: EXIF_PICK, gps: false }).catch(() => undefined),
		exifr.gps(buffer).catch(() => undefined)
	]);
	return {
		exif: (exif ?? undefined) as Record<string, unknown> | undefined,
		gps: gps ? { latitude: gps.latitude, longitude: gps.longitude } : undefined
	};
}

/** Capture time from EXIF, if the camera recorded one. */
function takenAtOf(exif: Record<string, unknown> | undefined): Date | undefined {
	const value = exif?.DateTimeOriginal;
	return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined;
}

/**
 * 64 bit difference hash: each bit says whether a pixel of a 9x8 grayscale thumbnail is
 * brighter than its right neighbour. Survives resizing, recompression and light edits.
 */
async function differenceHash(image: Sharp): Promise<string> {
	const data = await image.clone().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
	let hash = 0n;
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			hash = (hash << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
		}
	}
	return hash.toString(16).padStart(16, '0');
}

export async function blurhashOf(image: Sharp) {
	const { data, info } = await image
		.clone()
		.resize(32, 32, { fit: 'inside' })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

function encodeWebp(image: Sharp) {
	return image.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
}

/** Sizes and watermark the admin configured, read fresh for every job. */
export interface RenderConfig {
	variants: ReturnType<typeof variantSpecs>;
	watermark: WatermarkOptions;
}

export async function loadRenderConfig(
	ctx: HandlerContext,
	mediaId: string
): Promise<RenderConfig> {
	const [downloads, watermark, row, heroOf] = await Promise.all([
		getSetting(ctx.db, 'downloads'),
		getSetting(ctx.db, 'watermark'),
		ctx.db
			.select({ photographer: schema.media.photographer })
			.from(schema.media)
			.where(eq(schema.media.id, mediaId))
			.then((rows) => rows[0]),
		// Conference banners get the extra large `hero` size
		ctx.db
			.select({ id: schema.event.id })
			.from(schema.event)
			.where(eq(schema.event.heroMediaId, mediaId))
			.limit(1)
	]);
	const credit = watermark.credit && row?.photographer ? `Foto: ${row.photographer}` : undefined;
	return {
		variants: variantSpecs(downloads, { hero: heroOf.length > 0 }),
		watermark: { ...watermark, credit }
	};
}

type Encoded = Awaited<ReturnType<typeof encodeWebp>>;

/**
 * Renders every configured variant as WebP. Watermarked variants go to the public derivatives
 * bucket with the DMUN watermark and to the private originals bucket without it.
 */
export async function renderVariants(
	ctx: HandlerContext,
	image: Sharp,
	mediaId: string,
	isPublic: boolean,
	config: RenderConfig
): Promise<DerivativeResult[]> {
	// Team-private media never touches the public bucket
	const shownBucket = isPublic ? ctx.config.S3_BUCKET_DERIVATIVES : ctx.config.S3_BUCKET_ORIGINALS;
	const results: DerivativeResult[] = [];
	const store = async (
		target: { bucket: string; key: string; variant: string },
		rendered: Encoded,
		flags: Pick<DerivativeResult, 'watermarked' | 'public'>
	) => {
		await upload(ctx.s3, target.bucket, target.key, rendered.data, 'image/webp');
		results.push({
			variant: target.variant,
			key: target.key,
			width: rendered.info.width,
			height: rendered.info.height,
			bytes: rendered.info.size,
			mimeType: 'image/webp',
			...flags
		});
	};

	for (const variant of config.variants) {
		const resized = image.clone().resize({
			width: variant.maxEdge,
			height: variant.maxEdge,
			fit: 'inside',
			withoutEnlargement: true
		});
		const shown = {
			bucket: shownBucket,
			key: storageKeys.derivative(mediaId, variant.name, 'webp'),
			variant: variant.name
		};
		if (!variant.watermark) {
			await store(shown, await encodeWebp(resized), { watermarked: false, public: isPublic });
			continue;
		}
		const [clean, marked] = await Promise.all([
			encodeWebp(resized.clone()),
			applyWatermark(resized.clone(), config.watermark).then(encodeWebp)
		]);
		await store(shown, marked, { watermarked: true, public: isPublic });
		const cleanTarget = {
			bucket: ctx.config.S3_BUCKET_ORIGINALS,
			key: storageKeys.cleanDerivative(mediaId, variant.name, 'webp'),
			variant: variant.name
		};
		await store(cleanTarget, clean, { watermarked: false, public: false });
	}
	return results;
}

/** Full-resolution JPEG with the watermark, kept private for team downloads. */
async function renderWatermarkedOriginal(
	ctx: HandlerContext,
	image: Sharp,
	mediaId: string,
	config: RenderConfig
): Promise<DerivativeResult> {
	const marked = await applyWatermark(image.clone(), config.watermark);
	const { data, info } = await marked
		.jpeg({ quality: 90, mozjpeg: true })
		.toBuffer({ resolveWithObject: true });
	const key = storageKeys.watermarkedOriginal(mediaId);
	await upload(ctx.s3, ctx.config.S3_BUCKET_ORIGINALS, key, data, 'image/jpeg');
	return {
		variant: 'original',
		key,
		width: info.width,
		height: info.height,
		bytes: info.size,
		mimeType: 'image/jpeg',
		watermarked: true,
		public: false
	};
}

export const imageDerivatives: JobHandler<'IMAGE_DERIVATIVES'> = async (ctx, payload) => {
	const original = await downloadToBuffer(ctx.s3, payload.bucket, payload.key);
	// `rotate()` without arguments applies the EXIF orientation so derivatives are upright.
	const image = sharp(original, { failOn: 'none' }).rotate();
	const meta = await image.metadata();
	const oriented = meta.autoOrient ?? { width: meta.width, height: meta.height };
	const config = await loadRenderConfig(ctx, payload.mediaId);

	const [{ exif, gps }, blurhash, phash, variants, watermarkedOriginal] = await Promise.all([
		extractMetadata(original),
		blurhashOf(image),
		differenceHash(image),
		renderVariants(ctx, image, payload.mediaId, payload.public, config),
		renderWatermarkedOriginal(ctx, image, payload.mediaId, config)
	]);

	const result = {
		width: oriented.width,
		height: oriented.height,
		format: meta.format,
		bytes: original.byteLength,
		blurhash,
		phash,
		takenAt: takenAtOf(exif),
		exif,
		gps,
		derivatives: [...variants, watermarkedOriginal]
	};
	await markMediaReady(ctx.db, payload.mediaId, result);
	const similar = payload.detectDuplicates ? await recordSimilarPhotos(ctx.db, payload.mediaId) : 0;
	return { ...result, similar };
};
