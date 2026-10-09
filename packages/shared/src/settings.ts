import { z } from 'zod';

/**
 * Gallery settings edited in the admin area (watermark, download sizes, usage notes). Stored
 * as JSON in the `setting` table, one document per key, read by the server and the processor.
 */

export const watermarkPositions = [
	'bottom-right',
	'bottom-left',
	'top-right',
	'top-left',
	'center'
] as const;
export type WatermarkPosition = (typeof watermarkPositions)[number];

export const watermarkSettingsSchema = z.object({
	position: z.enum(watermarkPositions).default('bottom-right'),
	/** Width of the logo as percent of the image width */
	size: z.number().int().min(4).max(40).default(12),
	/** 10 to 100 percent */
	opacity: z.number().int().min(10).max(100).default(60),
	/** Prints "Foto: <photographer>" under the logo */
	credit: z.boolean().default(false)
});
export type WatermarkSettings = z.infer<typeof watermarkSettingsSchema>;

/**
 * ALWAYS: everyone gets the watermarked file.
 * GUESTS: guests get the watermark, team members the clean file.
 * OPTIONAL: watermarked by default, team members may ask for the clean file.
 */
export const watermarkPolicies = ['ALWAYS', 'GUESTS', 'OPTIONAL'] as const;
export type WatermarkPolicy = (typeof watermarkPolicies)[number];

const sizeSchema = z.object({
	guests: z.boolean(),
	team: z.boolean(),
	watermark: z.enum(watermarkPolicies)
});

export const downloadSettingsSchema = z.object({
	/** Rendered as the `medium` derivative */
	preview: sizeSchema.extend({ longEdge: z.number().int().min(320).max(4096) }).default({
		longEdge: 800,
		guests: true,
		team: true,
		watermark: 'ALWAYS'
	}),
	/** Rendered as the `large` derivative, also shown in the lightbox */
	web: sizeSchema.extend({ longEdge: z.number().int().min(640).max(6000) }).default({
		longEdge: 1920,
		guests: true,
		team: true,
		watermark: 'OPTIONAL'
	}),
	original: sizeSchema.default({ guests: false, team: true, watermark: 'OPTIONAL' })
});
export type DownloadSettings = z.infer<typeof downloadSettingsSchema>;

export const usageSettingsSchema = z.object({
	de: z.string().default(''),
	en: z.string().default('')
});
export type UsageSettings = z.infer<typeof usageSettingsSchema>;

export const settingSchemas = {
	watermark: watermarkSettingsSchema,
	downloads: downloadSettingsSchema,
	usage: usageSettingsSchema
} as const;
export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

/** Parses a stored value, falling back to the defaults for anything missing or invalid. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
	const schema = settingSchemas[key];
	const parsed = schema.safeParse(value ?? {});
	return (parsed.success ? parsed.data : schema.parse({})) as SettingValue<K>;
}

/** Long edge of the conference banner, wide enough for large high-density screens */
export const HERO_LONG_EDGE = 3840;

interface VariantSpec {
	name: 'thumb' | 'medium' | 'large' | 'hero';
	maxEdge: number;
	watermark: boolean;
}

/**
 * The two configurable derivative sizes plus the fixed grid thumbnail, and the `hero` banner
 * size for photos that are some conference's hero image.
 */
export function variantSpecs(downloads: DownloadSettings, { hero = false } = {}): VariantSpec[] {
	const variants: VariantSpec[] = [
		{ name: 'thumb', maxEdge: 320, watermark: false },
		{ name: 'medium', maxEdge: downloads.preview.longEdge, watermark: true },
		{ name: 'large', maxEdge: downloads.web.longEdge, watermark: true }
	];
	return hero
		? [...variants, { name: 'hero', maxEdge: HERO_LONG_EDGE, watermark: true }]
		: variants;
}

interface RenderSettings {
	watermark: WatermarkSettings;
	downloads: DownloadSettings;
}

/**
 * Whether saving `next` over `current` changes the rendered files, so every photo has to be
 * rendered again. Who may download which size is decided at request time and needs no render.
 */
export function needsRerender(current: RenderSettings, next: RenderSettings): boolean {
	return (
		JSON.stringify(current.watermark) !== JSON.stringify(next.watermark) ||
		current.downloads.preview.longEdge !== next.downloads.preview.longEdge ||
		current.downloads.web.longEdge !== next.downloads.web.longEdge
	);
}
