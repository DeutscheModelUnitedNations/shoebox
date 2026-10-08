import { describe, expect, it } from 'vitest';
import { parseSetting, variantSpecs } from './settings';

describe('settings', () => {
	it('falls back to the defaults for missing or broken values', () => {
		expect(parseSetting('watermark', undefined)).toEqual({
			position: 'bottom-right',
			size: 12,
			opacity: 60,
			credit: false
		});
		expect(parseSetting('watermark', { size: 'huge' }).size).toBe(12);
		expect(parseSetting('downloads', {}).web).toEqual({
			longEdge: 1920,
			guests: true,
			team: true,
			watermark: 'OPTIONAL'
		});
	});

	it('derives the rendered variants from the download sizes', () => {
		const downloads = parseSetting('downloads', {
			preview: { longEdge: 640, guests: true, team: true, watermark: 'ALWAYS' }
		});
		expect(variantSpecs(downloads).map((v) => [v.name, v.maxEdge])).toEqual([
			['thumb', 320],
			['medium', 640],
			['large', 1920]
		]);
		expect(variantSpecs(downloads, { hero: true }).at(-1)).toEqual({
			name: 'hero',
			maxEdge: 3840,
			watermark: true
		});
	});
});
