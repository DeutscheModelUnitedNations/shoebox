import { readFileSync } from 'node:fs';
import sharp, { type Sharp } from 'sharp';
import type { WatermarkPosition, WatermarkSettings } from '@shoebox/shared';

/**
 * The long white DMUN Wort-Bild-Marke with the full name (dmun-lang-darkmode.svg from
 * cdn.dmun.de), the same file the admin settings preview shows. The file carries its own
 * Schutzzone, which doubles as the margin to the image edge.
 */
const logo = readFileSync(new URL('../assets/watermark.svg', import.meta.url), 'utf8')
	// librsvg needs absolute dimensions, the file ships with 100%
	.replace(/width="100%" height="100%"/, 'width="16588" height="7306"');

/** The visible artwork is roughly this share of the logo file's width, the rest is Schutzzone. */
const ARTWORK_SHARE = 0.62;
const MIN_WIDTH = 96;

const gravities: Record<WatermarkPosition, string> = {
	'bottom-right': 'southeast',
	'bottom-left': 'southwest',
	'top-right': 'northeast',
	'top-left': 'northwest',
	center: 'centre'
};

export interface WatermarkOptions extends Pick<WatermarkSettings, 'position' | 'size' | 'opacity'> {
	/** Printed under the logo when set, e.g. "Foto: M. Sayk" */
	credit?: string;
}

const defaultWatermark: WatermarkOptions = {
	position: 'bottom-right',
	size: 12,
	opacity: 60
};

function escapeXml(text: string) {
	return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** White credit line, sized relative to the logo's height. */
function creditSvg(text: string, width: number, logoHeight: number) {
	const fontSize = Math.max(10, Math.round(logoHeight * 0.115));
	const height = Math.round(fontSize * 1.4);
	return {
		height,
		svg: Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
				`<text x="50%" y="${fontSize}" text-anchor="middle" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="#fff">${escapeXml(text)}</text></svg>`
		)
	};
}

/** Renders the logo (and the credit) as one PNG with the configured opacity. */
async function renderMark(width: number, options: WatermarkOptions) {
	const logoPng = await sharp(Buffer.from(logo))
		.resize({ width })
		.png()
		.toBuffer({ resolveWithObject: true });
	let mark = logoPng.data;
	let height = logoPng.info.height;
	if (options.credit) {
		const credit = creditSvg(options.credit, width, height);
		// The credit tucks into the logo's bottom Schutzzone
		const top = Math.round(height * 0.78);
		height = Math.max(height, top + credit.height);
		mark = await sharp({
			create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
		})
			.composite([
				{ input: logoPng.data, top: 0, left: 0 },
				{ input: credit.svg, top, left: 0 }
			])
			.png()
			.toBuffer();
	}
	// Scale the mark's own alpha down to the configured opacity
	const fade = {
		create: {
			width,
			height,
			channels: 4 as const,
			background: { r: 255, g: 255, b: 255, alpha: options.opacity / 100 }
		}
	};
	return sharp(mark)
		.composite([{ input: fade, blend: 'dest-in' }])
		.png()
		.toBuffer();
}

/** Composites the white DMUN logo into an already resized image. */
export async function applyWatermark(
	image: Sharp,
	options: WatermarkOptions = defaultWatermark
): Promise<Sharp> {
	const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
	const target = Math.round((info.width * options.size) / 100 / ARTWORK_SHARE);
	const rendered = await renderMark(Math.min(Math.max(MIN_WIDTH, target), info.width), options);
	// Tiny images: never let the mark overflow the photo
	const mark = await sharp(rendered)
		.resize({ width: info.width, height: info.height, fit: 'inside', withoutEnlargement: true })
		.png()
		.toBuffer();
	const raw = { width: info.width, height: info.height, channels: info.channels };
	const marked = await sharp(data, { raw })
		.composite([{ input: mark, gravity: gravities[options.position] }])
		.raw()
		.toBuffer({ resolveWithObject: true });
	// Compositing adds an alpha channel, drop it again for opaque photos
	const result = sharp(marked.data, { raw: { ...raw, channels: marked.info.channels } });
	return info.channels === 3 ? result.removeAlpha() : result;
}
