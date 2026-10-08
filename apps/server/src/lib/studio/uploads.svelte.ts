import { mutate } from '$lib/api/mutate';
import { m } from '$lib/paraglide/messages';

/**
 * The upload queue of 3a. It lives at module level so uploads keep running while the person
 * navigates to other screens of the app.
 */

export type QueueStatus = 'hashing' | 'waiting' | 'uploading' | 'done' | 'held' | 'error';

export interface QueueItem {
	key: string;
	file: File;
	previewUrl: string;
	status: QueueStatus;
	/** 0 to 1 */
	progress: number;
	mediaId?: string;
	uploadUrl?: string;
	duplicateOfName?: string | null;
	error?: string;
}

export interface UploadTarget {
	eventId: string;
	categoryId: string | null;
	visibility: 'PUBLIC' | 'TEAM';
	photographer: string;
	caption: string;
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 50 * 1024 * 1024;
const PARALLEL_UPLOADS = 3;
const PREPARE_CHUNK = 25;

export const uploads = $state({
	items: [] as QueueItem[],
	/** Groups everything uploaded until the person clicks "done" */
	batch: crypto.randomUUID(),
	eventId: null as string | null
});

let active = 0;
let nextKey = 0;

async function sha256(file: File) {
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** XHR instead of fetch for upload progress. */
function put(item: QueueItem) {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', item.uploadUrl!);
		xhr.setRequestHeader('Content-Type', item.file.type);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) item.progress = e.loaded / e.total;
		};
		xhr.onload = () =>
			xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
		xhr.onerror = () => reject(new Error('Network error'));
		xhr.send(item.file);
	});
}

async function uploadOne(item: QueueItem) {
	item.status = 'uploading';
	try {
		await put(item);
		await mutate('completeUpload', { mediaIds: [item.mediaId!] });
		item.progress = 1;
		item.status = item.duplicateOfName ? 'held' : 'done';
	} catch (error) {
		item.status = 'error';
		item.error = error instanceof Error ? error.message : String(error);
		await mutate('abandonUpload', { mediaIds: [item.mediaId!] }).catch(() => {});
	}
}

/** Keeps PARALLEL_UPLOADS uploads running until the queue is empty. */
function pump() {
	while (active < PARALLEL_UPLOADS) {
		const item = uploads.items.find((i) => i.status === 'waiting');
		if (!item) return;
		active++;
		void uploadOne(item).finally(() => {
			active--;
			pump();
		});
	}
}

async function prepare(items: QueueItem[], target: UploadTarget) {
	for (const item of items) item.status = 'hashing';
	const files = await Promise.all(
		items.map(async (item) => ({
			name: item.file.name,
			size: item.file.size,
			type: item.file.type,
			sha256: await sha256(item.file)
		}))
	);
	const prepared = (await mutate(
		'prepareUpload',
		{ ...target, batch: uploads.batch, files },
		{ mediaId: true, uploadUrl: true, duplicateOfId: true, duplicateOfName: true }
	)) as unknown as {
		mediaId: string;
		uploadUrl: string;
		duplicateOfName: string | null;
	}[];
	prepared.forEach((p, i) => {
		Object.assign(items[i], {
			mediaId: p.mediaId,
			uploadUrl: p.uploadUrl,
			duplicateOfName: p.duplicateOfName,
			status: 'waiting'
		});
	});
}

/** Why a file cannot be uploaded, or null when it can. */
function rejection(file: File) {
	if (!ACCEPTED_TYPES.includes(file.type)) return m.uploadUnsupported();
	return file.size > MAX_BYTES ? m.uploadTooLarge() : null;
}

function queueItem(file: File): QueueItem {
	const error = rejection(file);
	return {
		key: `${++nextKey}`,
		file,
		previewUrl: URL.createObjectURL(file),
		status: error ? 'error' : 'hashing',
		progress: 0,
		error: error ?? undefined
	};
}

async function prepareChunk(chunk: QueueItem[], target: UploadTarget) {
	try {
		await prepare(chunk, target);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		for (const item of chunk) Object.assign(item, { status: 'error', error: message });
	}
	pump();
}

/** Puts files into the queue. Unsupported or too large files are reported, not uploaded. */
export async function enqueue(files: File[], target: UploadTarget) {
	uploads.eventId = target.eventId;
	uploads.items.push(...files.map(queueItem));
	// Work on the reactive proxies, not the plain objects pushed above
	const queued = uploads.items.slice(-files.length).filter((i) => i.status !== 'error');
	for (let i = 0; i < queued.length; i += PREPARE_CHUNK) {
		await prepareChunk(queued.slice(i, i + PREPARE_CHUNK), target);
	}
}

/** Starts a new batch and forgets finished items, e.g. after "done". */
export function finishBatch() {
	const keep = uploads.items.filter((i) => ['hashing', 'waiting', 'uploading'].includes(i.status));
	for (const item of uploads.items) if (!keep.includes(item)) URL.revokeObjectURL(item.previewUrl);
	uploads.items = keep;
	const batch = uploads.batch;
	uploads.batch = crypto.randomUUID();
	return batch;
}

export const uploadStats = () => {
	const items = uploads.items;
	return {
		total: items.length,
		done: items.filter((i) => i.status === 'done' || i.status === 'held').length,
		held: items.filter((i) => i.status === 'held' || (i.duplicateOfName && i.status !== 'error'))
			.length,
		busy: items.some((i) => ['hashing', 'waiting', 'uploading'].includes(i.status)),
		errors: items.filter((i) => i.status === 'error').length
	};
};
