import { describe, expect, it } from 'vitest';
import { storageKeys } from '@shoebox/shared';
import type { MediaRow } from './assemble';
import { resolveDownload } from './download';

const row = (overrides: Partial<MediaRow> = {}) =>
	({
		id: 'abcdefghijklmnop',
		title: 'Generalversammlung im Plenarsaal',
		status: 'READY',
		visibility: 'PUBLIC',
		originalKey: 'media/abcdefghijklmnop/original/a.jpg',
		originalFilename: 'a.jpg',
		derivatives: [
			{
				variant: 'large',
				key: storageKeys.derivative('abcdefghijklmnop', 'large', 'webp'),
				public: true
			},
			{
				variant: 'original',
				key: storageKeys.watermarkedOriginal('abcdefghijklmnop'),
				public: false
			}
		],
		...overrides
	}) as MediaRow;

const guest = { clean: false, isTeam: false };
const team = { clean: false, isTeam: true };

describe('resolveDownload', () => {
	it('serves the watermarked public variant to guests', () => {
		expect(resolveDownload(row(), { ...guest, variant: 'large' })).toEqual({
			ok: true,
			bucket: 'derivatives',
			key: 'media/abcdefghijklmnop/large.webp',
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-large.webp'
		});
	});

	it('keeps originals and clean copies for the team', () => {
		expect(resolveDownload(row(), { ...guest, variant: 'original' })).toEqual({
			ok: false,
			status: 403
		});
		expect(resolveDownload(row(), { ...guest, variant: 'large', clean: true })).toEqual({
			ok: false,
			status: 403
		});
		expect(resolveDownload(row(), { ...team, variant: 'large', clean: true })).toMatchObject({
			bucket: 'originals',
			key: 'media/abcdefghijklmnop/clean/large.webp',
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-large-clean.webp'
		});
	});

	it('gives the team a watermarked original unless they ask for the clean upload', () => {
		expect(resolveDownload(row(), { ...team, variant: 'original' })).toEqual({
			ok: true,
			bucket: 'originals',
			key: 'media/abcdefghijklmnop/original-watermarked.jpg',
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-original.jpg'
		});
		expect(resolveDownload(row(), { ...team, variant: 'original', clean: true })).toEqual({
			ok: true,
			bucket: 'originals',
			key: 'media/abcdefghijklmnop/original/a.jpg',
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-original-clean.jpg'
		});
		expect(resolveDownload(row({ derivatives: [] }), { ...team, variant: 'original' })).toEqual({
			ok: false,
			status: 404
		});
	});

	it('hides team-private, unprocessed and unknown media', () => {
		const status = (r: MediaRow | undefined, variant = 'large') =>
			resolveDownload(r, { ...guest, variant });
		expect(status(row({ visibility: 'TEAM' }))).toEqual({ ok: false, status: 404 });
		expect(status(row({ status: 'PENDING' }))).toEqual({ ok: false, status: 404 });
		expect(status(undefined)).toEqual({ ok: false, status: 404 });
		expect(status(row(), 'huge')).toEqual({ ok: false, status: 400 });
		expect(status(row(), 'medium')).toEqual({ ok: false, status: 404 });
	});
});
