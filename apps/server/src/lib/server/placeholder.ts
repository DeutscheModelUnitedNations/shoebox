/**
 * Server-rendered blurhash placeholders: a tiny PNG as data URL, so the blur is part of the
 * first paint instead of waiting for client code.
 */
import { crc32, deflateSync } from 'node:zlib';
import { decode } from 'blurhash';

/** Longer side in pixels, the browser smooths the upscale */
const SIZE = 16;
const MAX_CACHED = 5000;
const cache = new Map<string, string>();

/** The longer side gets SIZE pixels, so the placeholder keeps the photo's aspect ratio. */
export function placeholderSize(width = 1, height = 1) {
	const scale = SIZE / Math.max(width, height, 1);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

function chunk(type: string, data: Buffer) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

/** Encodes RGBA pixels as an RGB PNG (8 bit, no filter). */
function encodePng(rgba: Uint8ClampedArray, width: number, height: number) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 2, 0, 0, 0], 8);
	const rows = Buffer.alloc(height * (1 + width * 3));
	for (let y = 0; y < height; y++) {
		const row = y * (1 + width * 3);
		for (let x = 0; x < width; x++) {
			const from = (y * width + x) * 4;
			rows.set(rgba.subarray(from, from + 3), row + 1 + x * 3);
		}
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** The blurhash as PNG data URL in the photo's aspect ratio, null without a valid hash. */
export function placeholderUrl(
	hash: string | null | undefined,
	photo: { width?: number | null; height?: number | null } = {}
): string | null {
	if (!hash) return null;
	const { width, height } = placeholderSize(photo.width ?? undefined, photo.height ?? undefined);
	const key = `${hash}:${width}x${height}`;
	const cached = cache.get(key);
	if (cached) return cached;
	let url: string;
	try {
		url = `data:image/png;base64,${encodePng(decode(hash, width, height), width, height).toString('base64')}`;
	} catch {
		return null;
	}
	if (cache.size >= MAX_CACHED) cache.clear();
	cache.set(key, url);
	return url;
}
