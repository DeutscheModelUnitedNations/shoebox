import { describe, expect, it } from 'vitest';
import { downloadSettingsSchema, storageKeys } from '@shoebox/shared';
import type { MediaRow } from './assemble';
import { resolveDownload } from './download';

const ID = 'abcdefghijklmnop';

const row = (overrides: Partial<MediaRow> = {}) =>
	({
		id: ID,
		title: 'Generalversammlung im Plenarsaal',
		status: 'READY',
		visibility: 'PUBLIC',
		deletedAt: null,
		originalKey: `media/${ID}/original/a.jpg`,
		originalFilename: 'a.jpg',
		derivatives: [
			{ variant: 'medium', key: storageKeys.derivative(ID, 'medium', 'webp'), public: true },
			{ variant: 'large', key: storageKeys.derivative(ID, 'large', 'webp'), public: true },
			{ variant: 'original', key: storageKeys.watermarkedOriginal(ID), public: false }
		],
		...overrides
	}) as MediaRow;

/** Defaults: preview ALWAYS, web OPTIONAL, original OPTIONAL and team only. */
const settings = downloadSettingsSchema.parse({});
const guest = { clean: false, isTeam: false, settings };
const team = { clean: false, isTeam: true, settings };

describe('resolveDownload', () => {
	it('serves the watermarked public variant to guests', () => {
		expect(resolveDownload(row(), { ...guest, variant: 'large' })).toEqual({
			ok: true,
			bucket: 'derivatives',
			key: `media/${ID}/large.webp`,
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-large.webp'
		});
	});

	it('keeps originals and clean copies from guests', () => {
		expect(resolveDownload(row(), { ...guest, variant: 'original' })).toEqual({
			ok: false,
			status: 403
		});
		expect(resolveDownload(row(), { ...guest, variant: 'large', clean: true })).toEqual({
			ok: false,
			status: 403
		});
	});

	it('lets the team opt out of the watermark on OPTIONAL sizes', () => {
		expect(resolveDownload(row(), { ...team, variant: 'large' })).toMatchObject({
			key: `media/${ID}/large.webp`
		});
		expect(resolveDownload(row(), { ...team, variant: 'large', clean: true })).toMatchObject({
			bucket: 'originals',
			key: `media/${ID}/clean/large.webp`,
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-large-clean.webp'
		});
	});

	it('never removes the watermark on ALWAYS sizes', () => {
		expect(resolveDownload(row(), { ...team, variant: 'medium', clean: true })).toMatchObject({
			bucket: 'derivatives',
			key: `media/${ID}/medium.webp`
		});
	});

	it('gives the team the clean file on GUESTS sizes without asking', () => {
		const forGuests = downloadSettingsSchema.parse({
			web: { longEdge: 1920, guests: true, team: true, watermark: 'GUESTS' }
		});
		expect(
			resolveDownload(row(), { ...team, settings: forGuests, variant: 'large' })
		).toMatchObject({ key: `media/${ID}/clean/large.webp` });
		expect(
			resolveDownload(row(), { ...guest, settings: forGuests, variant: 'large' })
		).toMatchObject({ key: `media/${ID}/large.webp` });
	});

	it('gives the team a watermarked original unless they ask for the clean upload', () => {
		expect(resolveDownload(row(), { ...team, variant: 'original' })).toEqual({
			ok: true,
			bucket: 'originals',
			key: `media/${ID}/original-watermarked.jpg`,
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-original.jpg'
		});
		expect(resolveDownload(row(), { ...team, variant: 'original', clean: true })).toEqual({
			ok: true,
			bucket: 'originals',
			key: `media/${ID}/original/a.jpg`,
			filename: 'generalversammlung-im-plenarsaal-abcdefgh-original-clean.jpg'
		});
	});

	it('refuses sizes switched off for a group', () => {
		const noWeb = downloadSettingsSchema.parse({
			web: { longEdge: 1920, guests: false, team: true, watermark: 'OPTIONAL' }
		});
		expect(resolveDownload(row(), { ...guest, settings: noWeb, variant: 'large' })).toEqual({
			ok: false,
			status: 403
		});
	});

	it('hides team-private, unprocessed, trashed and unknown media', () => {
		const status = (r: MediaRow | undefined, variant = 'large') =>
			resolveDownload(r, { ...guest, variant });
		expect(status(row({ visibility: 'TEAM' }))).toEqual({ ok: false, status: 404 });
		expect(status(row({ status: 'PENDING' }))).toEqual({ ok: false, status: 404 });
		expect(status(row({ deletedAt: new Date() }))).toEqual({ ok: false, status: 404 });
		expect(status(undefined)).toEqual({ ok: false, status: 404 });
		expect(status(row(), 'huge')).toEqual({ ok: false, status: 400 });
	});
});
