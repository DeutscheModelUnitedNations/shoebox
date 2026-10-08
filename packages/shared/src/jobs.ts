import { z } from 'zod';

/**
 * Processing jobs handed from the server to the processor via the `processing_job` table.
 * The `type` column selects the handler, `payload` is validated against the schema here on
 * both ends, and `result` is whatever the handler returns.
 */
export const processingJobTypes = [
	'PING',
	'IMAGE_DERIVATIVES',
	'VIDEO_DERIVATIVES',
	'ZIP_IMPORT'
] as const;
export type ProcessingJobType = (typeof processingJobTypes)[number];

export const processingJobStatuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;
export type ProcessingJobStatus = (typeof processingJobStatuses)[number];

const mediaSource = z.object({
	/** Id of the media row the result belongs to, also the key prefix for derivatives. */
	mediaId: z.string(),
	/** Bucket and key of the uploaded original. */
	bucket: z.string(),
	key: z.string(),
	/** Team-private media keeps every derivative in the private bucket. */
	public: z.boolean(),
	/** Only fresh uploads look for similar photos, re-renders must not revive resolved pairs */
	detectDuplicates: z.boolean().default(false)
});

const zipImport = z.object({
	eventId: z.string(),
	/** Bucket and key of the uploaded archive, deleted after the import */
	bucket: z.string(),
	key: z.string(),
	/** Folder key (see zipFolderOf) to category id, null files the photos without category */
	folders: z.record(z.string(), z.string().nullable()),
	rootToSkip: z.string().nullable(),
	visibility: z.enum(['PUBLIC', 'TEAM']),
	photographer: z.string(),
	uploadedById: z.string().nullable(),
	batch: z.string()
});

export const jobPayloadSchemas = {
	PING: z.object({ message: z.string().optional() }),
	IMAGE_DERIVATIVES: mediaSource,
	VIDEO_DERIVATIVES: mediaSource,
	ZIP_IMPORT: zipImport
} satisfies Record<ProcessingJobType, z.ZodType>;

export type JobPayload<T extends ProcessingJobType> = z.infer<(typeof jobPayloadSchemas)[T]>;
/** What callers hand to enqueueJob, defaults still unapplied */
export type JobInput<T extends ProcessingJobType> = z.input<(typeof jobPayloadSchemas)[T]>;

export const derivativeResultSchema = z.object({
	variant: z.string(),
	key: z.string(),
	width: z.number(),
	height: z.number(),
	bytes: z.number(),
	mimeType: z.string(),
	/** Carries the DMUN watermark */
	watermarked: z.boolean(),
	/** In the public derivatives bucket. Private copies sit in the originals bucket. */
	public: z.boolean()
});
export type DerivativeResult = z.infer<typeof derivativeResultSchema>;
