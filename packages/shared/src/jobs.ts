import { z } from 'zod';

/**
 * Processing jobs handed from the server to the processor via the `processing_job` table.
 * The `type` column selects the handler, `payload` is validated against the schema here on
 * both ends, and `result` is whatever the handler returns.
 */
export const processingJobTypes = ['PING', 'IMAGE_DERIVATIVES', 'VIDEO_DERIVATIVES'] as const;
export type ProcessingJobType = (typeof processingJobTypes)[number];

export const processingJobStatuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;
export type ProcessingJobStatus = (typeof processingJobStatuses)[number];

const mediaSource = z.object({
	/** Id of the media row the result belongs to, also the key prefix for derivatives. */
	mediaId: z.string(),
	/** Bucket and key of the uploaded original. */
	bucket: z.string(),
	key: z.string()
});

export const jobPayloadSchemas = {
	PING: z.object({ message: z.string().optional() }),
	IMAGE_DERIVATIVES: mediaSource,
	VIDEO_DERIVATIVES: mediaSource
} satisfies Record<ProcessingJobType, z.ZodType>;

export type JobPayload<T extends ProcessingJobType> = z.infer<(typeof jobPayloadSchemas)[T]>;

/** Variants the processor renders for every photo and every video poster frame. */
export const imageVariants = [
	{ name: 'thumb', maxEdge: 320 },
	{ name: 'medium', maxEdge: 1024 },
	{ name: 'large', maxEdge: 2048 }
] as const;
export type ImageVariantName = (typeof imageVariants)[number]['name'];

export const derivativeResultSchema = z.object({
	variant: z.string(),
	key: z.string(),
	width: z.number(),
	height: z.number(),
	bytes: z.number(),
	mimeType: z.string()
});
export type DerivativeResult = z.infer<typeof derivativeResultSchema>;
