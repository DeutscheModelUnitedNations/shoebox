import { GraphQLError } from 'graphql';
import { enqueueJob } from '@shoebox/db';
import { storageKeys } from '@shoebox/shared';
import { db } from '$api/db';
import { enum_, schemaBuilder } from '$api/rumble';
import {
	abandonUploads,
	assertCategoryInEvent,
	completeUploads,
	eventsOf,
	prepareUploads
} from '$api/services/manage';
import { createCategory } from '$api/services/catalog';
import {
	abortMultipartUpload,
	buckets,
	completeMultipartUpload,
	startMultipartUpload
} from '$api/services/storage';

export const MediaVisibilityEnum = enum_({ tsName: 'mediaVisibility' });

/** ZIP archives up to 20 GB, uploaded in presigned parts. */
const MAX_ZIP_BYTES = 20 * 1024 * 1024 * 1024;

const UploadFileInput = schemaBuilder.inputType('UploadFileInput', {
	fields: (t) => ({
		name: t.string({ required: true }),
		size: t.int({ required: true }),
		type: t.string({ required: true }),
		sha256: t.string({ required: true })
	})
});

interface PreparedUpload {
	mediaId: string;
	uploadUrl: string;
	duplicateOfId: string | null;
	duplicateOfName: string | null;
}

const PreparedUploadRef = schemaBuilder.objectRef<PreparedUpload>('PreparedUpload');
schemaBuilder.objectType(PreparedUploadRef, {
	fields: (t) => ({
		mediaId: t.exposeID('mediaId'),
		uploadUrl: t.exposeString('uploadUrl'),
		duplicateOfId: t.exposeID('duplicateOfId', { nullable: true }),
		duplicateOfName: t.exposeString('duplicateOfName', { nullable: true })
	})
});

interface ZipUpload {
	batch: string;
	uploadId: string;
	partSize: number;
	partUrls: string[];
}

const ZipUploadRef = schemaBuilder.objectRef<ZipUpload>('ZipUpload');
schemaBuilder.objectType(ZipUploadRef, {
	fields: (t) => ({
		batch: t.exposeString('batch'),
		uploadId: t.exposeString('uploadId'),
		partSize: t.exposeInt('partSize'),
		partUrls: t.exposeStringList('partUrls')
	})
});

const UploadedPartInput = schemaBuilder.inputType('UploadedPartInput', {
	fields: (t) => ({
		partNumber: t.int({ required: true }),
		etag: t.string({ required: true })
	})
});

const ZipFolderInput = schemaBuilder.inputType('ZipFolderInput', {
	description:
		'Where the photos of one archive folder go: an existing category, a new category with `newName` below the category of the parent folder, or nowhere (neither set).',
	fields: (t) => ({
		folder: t.string({ required: true }),
		categoryId: t.id(),
		newName: t.string()
	})
});

/** Throws unless every media item belongs to an event the person manages. */
async function mustManageAll(ctx: { mustManage: (eventId: string) => unknown }, ids: string[]) {
	const events = await eventsOf(ids);
	if (events.size !== new Set(ids).size) throw new GraphQLError('Unknown photo');
	for (const eventId of new Set(events.values())) ctx.mustManage(eventId);
}

/** Folder keys sorted parents first, so new sub categories find their parent. */
function byDepth(a: { folder: string }, b: { folder: string }) {
	return a.folder.split('/').length - b.folder.split('/').length;
}

type FolderEntry = { folder: string; categoryId?: string | null; newName?: string | null };

/** The category one folder lands in: existing, newly created below its parent's, or none. */
async function resolveFolder(
	eventId: string,
	entry: FolderEntry,
	resolved: Record<string, string | null>,
	hideNew: boolean
) {
	if (entry.categoryId) {
		await assertCategoryInEvent(entry.categoryId, eventId);
		return entry.categoryId;
	}
	if (!entry.newName?.trim()) return null;
	const parentFolder = entry.folder.split('/').slice(0, -1).join('/');
	const parentId = resolved[parentFolder] ?? null;
	return (await createCategory(eventId, parentId, entry.newName, hideNew)).id;
}

/** Creates the categories a ZIP mapping asks for and returns folder key → category id. */
async function resolveFolders(eventId: string, folders: FolderEntry[], hideNew: boolean) {
	const resolved: Record<string, string | null> = {};
	for (const entry of [...folders].sort(byDepth)) {
		resolved[entry.folder] = await resolveFolder(eventId, entry, resolved, hideNew);
	}
	return resolved;
}

schemaBuilder.mutationFields((t) => ({
	prepareUpload: t.field({
		type: [PreparedUploadRef],
		description:
			'Creates media rows for files about to be uploaded and returns a presigned PUT for each. Exact duplicates of photos in the event are reported and held after the upload.',
		args: {
			eventId: t.arg.id({ required: true }),
			categoryId: t.arg.id(),
			visibility: t.arg({ type: MediaVisibilityEnum, required: true }),
			photographer: t.arg.string({ required: true }),
			caption: t.arg.string(),
			batch: t.arg.string({ required: true }),
			files: t.arg({ type: [UploadFileInput], required: true })
		},
		resolve: (_root, args, ctx) => {
			const user = ctx.mustManage(String(args.eventId));
			return prepareUploads(
				{
					eventId: String(args.eventId),
					categoryId: args.categoryId ? String(args.categoryId) : null,
					visibility: args.visibility,
					photographer: args.photographer.trim(),
					caption: args.caption?.trim() ?? '',
					batch: args.batch,
					uploadedById: user.sub
				},
				args.files
			);
		}
	}),

	completeUpload: t.field({
		type: 'Int',
		description: 'Queues finished uploads for processing. Returns how many were queued.',
		args: { mediaIds: t.arg.idList({ required: true }) },
		resolve: async (_root, args, ctx) => {
			const ids = args.mediaIds.map(String);
			await mustManageAll(ctx, ids);
			return completeUploads(ids);
		}
	}),

	abandonUpload: t.field({
		type: 'Int',
		description: 'Removes uploads the browser cancelled before they finished.',
		args: { mediaIds: t.arg.idList({ required: true }) },
		resolve: async (_root, args, ctx) => {
			const ids = args.mediaIds.map(String);
			await mustManageAll(ctx, ids);
			return abandonUploads(ids);
		}
	}),

	startZipUpload: t.field({
		type: ZipUploadRef,
		description:
			'Starts a multipart upload of a ZIP archive and returns one presigned URL per part.',
		args: {
			eventId: t.arg.id({ required: true }),
			batch: t.arg.string({ required: true }),
			size: t.arg.float({ required: true })
		},
		resolve: async (_root, args, ctx) => {
			ctx.mustManage(String(args.eventId));
			if (args.size <= 0 || args.size > MAX_ZIP_BYTES) throw new GraphQLError('Archive too large');
			const upload = await startMultipartUpload(storageKeys.zipUpload(args.batch), args.size);
			return { batch: args.batch, ...upload };
		}
	}),

	completeZipUpload: t.field({
		type: 'Boolean',
		description:
			'Finishes the multipart upload, creates the mapped categories and queues the import.',
		args: {
			eventId: t.arg.id({ required: true }),
			batch: t.arg.string({ required: true }),
			uploadId: t.arg.string({ required: true }),
			parts: t.arg({ type: [UploadedPartInput], required: true }),
			folders: t.arg({ type: [ZipFolderInput], required: true }),
			rootToSkip: t.arg.string(),
			visibility: t.arg({ type: MediaVisibilityEnum, required: true }),
			photographer: t.arg.string({ required: true }),
			hideNewCategories: t.arg.boolean({ required: true })
		},
		resolve: async (_root, args, ctx) => {
			const eventId = String(args.eventId);
			const user = ctx.mustManage(eventId);
			const key = storageKeys.zipUpload(args.batch);
			await completeMultipartUpload(key, args.uploadId, args.parts);
			const folders = await resolveFolders(eventId, args.folders, args.hideNewCategories);
			await enqueueJob(db, 'ZIP_IMPORT', {
				eventId,
				bucket: buckets.originals,
				key,
				folders,
				rootToSkip: args.rootToSkip ?? null,
				visibility: args.visibility,
				photographer: args.photographer.trim(),
				uploadedById: user.sub,
				batch: args.batch
			});
			return true;
		}
	}),

	abortZipUpload: t.field({
		type: 'Boolean',
		args: {
			eventId: t.arg.id({ required: true }),
			batch: t.arg.string({ required: true }),
			uploadId: t.arg.string({ required: true })
		},
		resolve: async (_root, args, ctx) => {
			ctx.mustManage(String(args.eventId));
			await abortMultipartUpload(storageKeys.zipUpload(args.batch), args.uploadId);
			return true;
		}
	})
}));
