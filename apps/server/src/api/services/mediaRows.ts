/** Row shapes for uploads and bulk edits, kept free of database access so they are testable. */
import { storageKeys } from '@shoebox/shared';
import type { schema } from '$api/db';

export type Visibility = 'PUBLIC' | 'TEAM';

export interface UploadFile {
	name: string;
	size: number;
	type: string;
	sha256: string;
}

export interface UploadTarget {
	eventId: string;
	categoryId: string | null;
	visibility: Visibility;
	photographer: string;
	caption: string;
	batch: string;
	uploadedById: string;
}

export interface MediaChanges {
	title?: string | null;
	categoryId?: string | null;
	/** Distinguishes "keep the category" from "move to no category" */
	moveCategory?: boolean;
	visibility?: Visibility | null;
	photographer?: string | null;
}

type MediaInsert = typeof schema.media.$inferInsert;

/** The UPLOADING row of one file, before its original reaches S3. */
export function uploadingRow(
	id: string,
	target: UploadTarget,
	file: UploadFile,
	sortOrder: number
): MediaInsert & { id: string; originalKey: string; originalFilename: string } {
	const filename = file.name.replace(/[/\\]/g, '_');
	return {
		id,
		eventId: target.eventId,
		categoryId: target.categoryId,
		status: 'UPLOADING',
		visibility: target.visibility,
		title: target.caption,
		alt: target.caption,
		photographer: target.photographer,
		sortOrder,
		originalKey: storageKeys.original(id, filename),
		originalFilename: filename,
		mimeType: file.type,
		bytes: file.size,
		sha256: file.sha256,
		uploadedById: target.uploadedById,
		uploadBatch: target.batch
	};
}

/** What the browser shows next to a file that is an exact copy of an earlier photo. */
export function duplicateFields(duplicateOf: { id: string; filename: string } | undefined) {
	if (!duplicateOf) return { duplicateOfId: null, duplicateOfName: null };
	return { duplicateOfId: duplicateOf.id, duplicateOfName: duplicateOf.filename };
}

/** The columns a bulk edit touches, empty when nothing changes. */
export function mediaChangeSet(changes: MediaChanges): Partial<MediaInsert> {
	return {
		...(changes.title != null && { title: changes.title, alt: changes.title }),
		...(changes.moveCategory && { categoryId: changes.categoryId ?? null }),
		...(changes.visibility && { visibility: changes.visibility }),
		...(changes.photographer != null && { photographer: changes.photographer })
	};
}

/** Photos whose visibility a bulk edit changes, none when it leaves visibility alone. */
export function flippedIds(
	before: { id: string; visibility: Visibility }[],
	visibility: Visibility | null | undefined
) {
	if (!visibility) return [];
	return before.filter((m) => m.visibility !== visibility).map((m) => m.id);
}
