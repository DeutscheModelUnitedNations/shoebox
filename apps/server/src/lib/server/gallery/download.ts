import { storageKeys, type DownloadSettings } from '@shoebox/shared';
import type { MediaRow } from './assemble';

const variants = ['medium', 'large', 'original'] as const;
type Variant = (typeof variants)[number];

export interface DownloadRequest {
	variant: string | null;
	/** Asks for the watermark-free file */
	clean: boolean;
	isTeam: boolean;
	settings: DownloadSettings;
}

const settingFor = { medium: 'preview', large: 'web', original: 'original' } as const;

export type DownloadTarget =
	| { ok: true; bucket: 'originals' | 'derivatives'; key: string; filename: string }
	| { ok: false; status: 400 | 403 | 404 };

function filename(row: MediaRow, variant: Variant, ext: string, clean: boolean) {
	const base = row.title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
	return `${base || 'dmun'}-${row.id.slice(0, 8)}-${variant}${clean ? '-clean' : ''}.${ext}`;
}

function visible(row: MediaRow | undefined, isTeam: boolean): row is MediaRow {
	return (
		!!row && row.status === 'READY' && !row.deletedAt && (row.visibility === 'PUBLIC' || isTeam)
	);
}

type Target = Extract<DownloadTarget, { ok: true }>;

/** The stored derivative for a key, served from whichever bucket the processor put it in. */
function fromDerivative(row: MediaRow, key: string, filename: string): DownloadTarget {
	const derivative = row.derivatives.find((d) => d.key === key);
	if (!derivative) return { ok: false, status: 404 };
	return { ok: true, bucket: derivative.public ? 'derivatives' : 'originals', key, filename };
}

/** Team only: the untouched upload, or its full-resolution watermarked copy. */
function original(row: MediaRow, clean: boolean): DownloadTarget {
	if (!clean) {
		const name = filename(row, 'original', 'jpg', false);
		return fromDerivative(row, storageKeys.watermarkedOriginal(row.id), name);
	}
	const ext = row.originalFilename.split('.').pop() || 'bin';
	const target: Target = {
		ok: true,
		bucket: 'originals',
		key: row.originalKey,
		filename: filename(row, 'original', ext, true)
	};
	return target;
}

/**
 * Decides which object a download request gets, following the admin download settings: who
 * may fetch a size, and whether team members get the clean file (GUESTS), may ask for it
 * (OPTIONAL) or never get it (ALWAYS).
 */
export function resolveDownload(row: MediaRow | undefined, req: DownloadRequest): DownloadTarget {
	const variant = req.variant as Variant;
	if (!variants.includes(variant)) return { ok: false, status: 400 };
	if (!visible(row, req.isTeam)) return { ok: false, status: 404 };
	const size = req.settings[settingFor[variant]];
	if (!(req.isTeam ? size.team : size.guests)) return { ok: false, status: 403 };
	if (req.clean && !req.isTeam) return { ok: false, status: 403 };

	const clean =
		req.isTeam && size.watermark !== 'ALWAYS' && (req.clean || size.watermark === 'GUESTS');
	if (variant === 'original') return original(row, clean);
	const name = filename(row, variant, 'webp', clean);
	if (clean) {
		const key = storageKeys.cleanDerivative(row.id, variant, 'webp');
		return { ok: true, bucket: 'originals', key, filename: name };
	}
	return fromDerivative(row, storageKeys.derivative(row.id, variant, 'webp'), name);
}
