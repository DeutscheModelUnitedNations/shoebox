import { readFileSync } from 'node:fs';
import sharp, { type Sharp } from 'sharp';

/**
 * The white DMUN Wort-Bild-Marke (dmun-darkmode.svg from cdn.dmun.de). The file carries its
 * own Schutzzone, which doubles as the margin to the image edge.
 */
const logo = readFileSync(new URL('../assets/watermark.svg', import.meta.url), 'utf8')
	// librsvg needs absolute dimensions, the file ships with 100%
	.replace(/width="100%" height="100%"/, 'width="11221" height="7306"');

/** Share of the image's short edge the logo box takes, and its opacity. */
const SIZE = 0.28;
const OPACITY = 0.55;
const MIN_WIDTH = 96;

async function renderMark(width: number) {
	const { data, info } = await sharp(Buffer.from(logo))
		.resize({ width })
		.png()
		.toBuffer({ resolveWithObject: true });
	// Scale the logo's own alpha down to OPACITY
	const fade = {
		create: {
			width: info.width,
			height: info.height,
			channels: 4 as const,
			background: { r: 255, g: 255, b: 255, alpha: OPACITY }
		}
	};
	return sharp(data)
		.composite([{ input: fade, blend: 'dest-in' }])
		.png()
		.toBuffer();
}

/** Composites a subtle white DMUN logo into the bottom-right corner of an already resized image. */
export async function applyWatermark(image: Sharp): Promise<Sharp> {
	const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
	const width = Math.max(MIN_WIDTH, Math.round(Math.min(info.width, info.height) * SIZE));
	const mark = await renderMark(Math.min(width, info.width));
	const raw = { width: info.width, height: info.height, channels: info.channels };
	const marked = await sharp(data, { raw })
		.composite([{ input: mark, gravity: 'southeast' }])
		.raw()
		.toBuffer({ resolveWithObject: true });
	// Compositing adds an alpha channel, drop it again for opaque photos
	const result = sharp(marked.data, { raw: { ...raw, channels: marked.info.channels } });
	return info.channels === 3 ? result.removeAlpha() : result;
}
