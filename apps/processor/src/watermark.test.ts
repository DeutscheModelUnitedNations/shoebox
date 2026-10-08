import sharp, { type Region, type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import { applyWatermark } from './watermark';

const grey = (width: number, height: number) =>
	sharp({ create: { width, height, channels: 3, background: { r: 60, g: 60, b: 60 } } });

/** `stats()` ignores pipeline operations, so the crop is materialized first. */
async function meanOf(image: Sharp, region: Region) {
	const crop = await image.clone().extract(region).png().toBuffer();
	const { channels } = await sharp(crop).stats();
	return channels[0].mean;
}

describe('applyWatermark', () => {
	it('lightens the bottom-right corner and leaves the rest untouched', async () => {
		const marked = sharp(await (await applyWatermark(grey(1200, 800))).png().toBuffer());

		expect(await marked.metadata()).toMatchObject({ width: 1200, height: 800, channels: 3 });
		expect(await meanOf(marked, { left: 0, top: 0, width: 400, height: 300 })).toBeCloseTo(60, 0);
		expect(await meanOf(marked, { left: 900, top: 650, width: 300, height: 150 })).toBeGreaterThan(
			65
		);
	});

	it('handles images smaller than the minimum logo width', async () => {
		const marked = await (await applyWatermark(grey(80, 60))).png().toBuffer();
		expect(await sharp(marked).metadata()).toMatchObject({ width: 80, height: 60 });
	});
});
