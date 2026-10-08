import { storageKeys } from '@shoebox/shared';
import type { MediaRow } from './assemble';

const variants = ['medium', 'large', 'original'] as const;
type Variant = (typeof variants)[number];

export interface DownloadRequest {
	variant: string | null;
	/** Watermark-free copy of medium or large */
	clean: boolean;
	isTeam: boolean;
}

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
	return !!row && row.status === 'READY' && (row.visibility === 'PUBLIC' || isTeam);
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
 * Decides which object a download request gets. Every size comes watermarked by default.
 * Team members may also fetch originals and, with `clean`, watermark-free copies.
 */
export function resolveDownload(row: MediaRow | undefined, req: DownloadRequest): DownloadTarget {
	const variant = req.variant as Variant;
	if (!variants.includes(variant)) return { ok: false, status: 400 };
	if (!visible(row, req.isTeam)) return { ok: false, status: 404 };
	if ((variant === 'original' || req.clean) && !req.isTeam) return { ok: false, status: 403 };

	if (variant === 'original') return original(row, req.clean);
	const name = filename(row, variant, 'webp', req.clean);
	if (req.clean) {
		const key = storageKeys.cleanDerivative(row.id, variant, 'webp');
		return { ok: true, bucket: 'originals', key, filename: name };
	}
	return fromDerivative(row, storageKeys.derivative(row.id, variant, 'webp'), name);
}
