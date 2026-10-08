import { encode } from 'blurhash';
import exifr from 'exifr';
import sharp, { type Sharp } from 'sharp';
import { imageVariants, storageKeys, type DerivativeResult } from '@shoebox/shared';
import { downloadToBuffer, upload } from '../s3io';
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

/** Renders every configured variant as WebP into the derivatives bucket. */
export async function renderVariants(
	ctx: HandlerContext,
	image: Sharp,
	mediaId: string
): Promise<DerivativeResult[]> {
	const results: DerivativeResult[] = [];
	for (const variant of imageVariants) {
		const { data, info } = await image
			.clone()
			.resize({
				width: variant.maxEdge,
				height: variant.maxEdge,
				fit: 'inside',
				withoutEnlargement: true
			})
			.webp({ quality: 82 })
			.toBuffer({ resolveWithObject: true });
		const key = storageKeys.derivative(mediaId, variant.name, 'webp');
		await upload(ctx.s3, ctx.config.S3_BUCKET_DERIVATIVES, key, data, 'image/webp');
		results.push({
			variant: variant.name,
			key,
			width: info.width,
			height: info.height,
			bytes: info.size,
			mimeType: 'image/webp'
		});
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
		renderVariants(ctx, image, payload.mediaId)
	]);

	return {
		width: oriented.width,
		height: oriented.height,
		format: meta.format,
		bytes: original.byteLength,
		blurhash,
		exif,
		gps,
		derivatives
	};
};
