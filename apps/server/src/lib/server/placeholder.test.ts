import { inflateSync } from 'node:zlib';
import { encode } from 'blurhash';
import { describe, expect, it } from 'vitest';
import { placeholderSize, placeholderUrl } from './placeholder';

describe('placeholderSize', () => {
	it('keeps the aspect ratio with the longer side at 16 pixels', () => {
		expect(placeholderSize(3000, 2000)).toEqual({ width: 16, height: 11 });
		expect(placeholderSize(1000, 4000)).toEqual({ width: 4, height: 16 });
		expect(placeholderSize()).toEqual({ width: 16, height: 16 });
	});
});

describe('placeholderUrl', () => {
	const red = new Uint8ClampedArray(Array.from({ length: 4 * 4 }, () => [220, 30, 30, 255]).flat());
	const hash = encode(red, 4, 4, 3, 3);

	it('renders the blurhash as a PNG in the photo aspect ratio', () => {
		const url = placeholderUrl(hash, { width: 1200, height: 800 })!;
		expect(url).toMatch(/^data:image\/png;base64,/);
		const png = Buffer.from(url.split(',')[1], 'base64');
		// IHDR right after the signature: width, height, 8 bit RGB
		expect([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]]).toEqual([16, 11, 8, 2]);
		const idat = png.indexOf('IDAT');
		const rows = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
		// Row filter byte, then the first pixel: still red
		expect(rows[1]).toBeGreaterThan(180);
		expect(rows[2]).toBeLessThan(80);
	});

	it('returns null without a usable hash', () => {
		expect(placeholderUrl(null)).toBeNull();
		expect(placeholderUrl('not a hash')).toBeNull();
	});
});
