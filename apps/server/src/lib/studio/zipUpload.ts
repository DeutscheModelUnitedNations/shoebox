import { mutate } from '$lib/api/mutate';
import { folderTarget, type Mapping, type ZipFolder } from './zipMapping';

export interface ZipImportOptions {
	eventId: string;
	folders: ZipFolder[];
	mapping: Record<string, Mapping>;
	rootToSkip: string | null;
	visibility: 'PUBLIC' | 'TEAM';
	photographer: string;
	hideNewCategories: boolean;
}

async function putPart(url: string, blob: Blob) {
	const response = await fetch(url, { method: 'PUT', body: blob });
	if (!response.ok) throw new Error(`Upload failed (${response.status})`);
	const etag = response.headers.get('ETag');
	if (!etag) throw new Error('S3 did not expose the ETag header');
	return etag;
}

/**
 * Uploads the archive straight to S3 in presigned parts, then hands the folder mapping to the
 * server, which queues the import. Returns the upload batch for the "show imported" link.
 */
export async function uploadArchive(
	file: File,
	options: ZipImportOptions,
	onProgress: (fraction: number) => void
) {
	const batch = crypto.randomUUID();
	const started = (await mutate(
		'startZipUpload',
		{ eventId: options.eventId, batch, size: file.size },
		{ uploadId: true, partSize: true, partUrls: true, batch: true }
	)) as unknown as { uploadId: string; partSize: number; partUrls: string[] };
	try {
		const parts: { partNumber: number; etag: string }[] = [];
		for (const [i, url] of started.partUrls.entries()) {
			const blob = file.slice(i * started.partSize, (i + 1) * started.partSize);
			// One retry per part covers a flaky conference Wi-Fi
			const etag = await putPart(url, blob).catch(() => putPart(url, blob));
			parts.push({ partNumber: i + 1, etag });
			onProgress((i + 1) / started.partUrls.length);
		}
		await mutate('completeZipUpload', {
			eventId: options.eventId,
			batch,
			uploadId: started.uploadId,
			parts,
			folders: options.folders.map((f) => ({
				folder: f.key,
				...folderTarget(options.mapping[f.key])
			})),
			rootToSkip: options.rootToSkip,
			visibility: options.visibility,
			photographer: options.photographer.trim(),
			hideNewCategories: options.hideNewCategories
		});
		return batch;
	} catch (error) {
		await mutate('abortZipUpload', {
			eventId: options.eventId,
			batch,
			uploadId: started.uploadId
		}).catch(() => {});
		throw error;
	}
}
