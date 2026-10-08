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

/**
 * Variants the processor renders for every photo and every video poster frame. Watermarked
 * variants are public with the DMUN watermark, their clean copy stays in the private bucket
 * for team downloads.
 */
export const imageVariants = [
	{ name: 'thumb', maxEdge: 320, watermark: false },
	{ name: 'medium', maxEdge: 1024, watermark: true },
	{ name: 'large', maxEdge: 2048, watermark: true }
] as const;
export type ImageVariantName = (typeof imageVariants)[number]['name'];

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
