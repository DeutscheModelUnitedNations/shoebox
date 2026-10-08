import { encode } from 'blurhash';
import exifr from 'exifr';
import sharp, { type Sharp } from 'sharp';
import { imageVariants, storageKeys, type DerivativeResult } from '@shoebox/shared';
import { markMediaReady } from '@shoebox/db';
import { downloadToBuffer, upload } from '../s3io';
import { applyWatermark } from '../watermark';
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

/**
 * Renders every configured variant as WebP. Watermarked variants go to the public derivatives
 * bucket with the DMUN watermark and to the private originals bucket without it.
 */
export async function renderVariants(
	ctx: HandlerContext,
	image: Sharp,
	mediaId: string,
	isPublic: boolean
): Promise<DerivativeResult[]> {
	// Team-private media never touches the public bucket
	const shownBucket = isPublic ? ctx.config.S3_BUCKET_DERIVATIVES : ctx.config.S3_BUCKET_ORIGINALS;
	const results: DerivativeResult[] = [];
	const store = async (
		bucket: string,
		key: string,
		variant: string,
		rendered: Awaited<ReturnType<typeof encodeWebp>>,
		flags: Pick<DerivativeResult, 'watermarked' | 'public'>
	) => {
		await upload(ctx.s3, bucket, key, rendered.data, 'image/webp');
		results.push({
			variant,
			key,
			width: rendered.info.width,
			height: rendered.info.height,
			bytes: rendered.info.size,
			mimeType: 'image/webp',
			...flags
		});
	};

	for (const variant of imageVariants) {
		const resized = image.clone().resize({
			width: variant.maxEdge,
			height: variant.maxEdge,
			fit: 'inside',
			withoutEnlargement: true
		});
		const publicKey = storageKeys.derivative(mediaId, variant.name, 'webp');
		if (!variant.watermark) {
			const clean = await encodeWebp(resized);
			await store(shownBucket, publicKey, variant.name, clean, {
				watermarked: false,
				public: isPublic
			});
			continue;
		}
		const [clean, marked] = await Promise.all([
			encodeWebp(resized.clone()),
			applyWatermark(resized.clone()).then(encodeWebp)
		]);
		await store(shownBucket, publicKey, variant.name, marked, {
			watermarked: true,
			public: isPublic
		});
		await store(
			ctx.config.S3_BUCKET_ORIGINALS,
			storageKeys.cleanDerivative(mediaId, variant.name, 'webp'),
			variant.name,
			clean,
			{ watermarked: false, public: false }
		);
	}
	return results;
}

export const imageDerivatives: JobHandler<'IMAGE_DERIVATIVES'> = async (ctx, payload) => {
	const original = await downloadToBuffer(ctx.s3, payload.bucket, payload.key);
	// `rotate()` without arguments applies the EXIF orientation so derivatives are upright.
	const image = sharp(original, { failOn: 'none' }).rotate();
	const meta = await image.metadata();
	const oriented = meta.autoOrient ?? { width: meta.width, height: meta.height };

	const [{ exif, gps }, blurhash, derivatives] = await Promise.all([
		extractMetadata(original),
		blurhashOf(image),
		renderVariants(ctx, image, payload.mediaId, payload.public)
	]);

	const result = {
		width: oriented.width,
		height: oriented.height,
		format: meta.format,
		bytes: original.byteLength,
		blurhash,
		exif,
		gps,
		derivatives
	};
	await markMediaReady(ctx.db, payload.mediaId, result);
	return result;
};
