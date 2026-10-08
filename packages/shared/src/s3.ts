import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { S3Env } from './env';

export function createS3Client(env: S3Env) {
	return new S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		forcePathStyle: env.S3_FORCE_PATH_STYLE,
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY
		}
	});
}

export type S3Buckets = Pick<S3Env, 'S3_BUCKET_ORIGINALS' | 'S3_BUCKET_DERIVATIVES'>;

/** Resolves to true when the bucket exists and the configured key may access it. */
export async function bucketReachable(s3: S3Client, bucket: string): Promise<boolean> {
	try {
		await s3.send(new HeadBucketCommand({ Bucket: bucket }));
		return true;
	} catch {
		return false;
	}
}

/** Key layout inside the buckets. Keep every path decision here. */
export const storageKeys = {
	/** Uploaded original, kept byte for byte. */
	original: (mediaId: string, filename: string) => `media/${mediaId}/original/${filename}`,
	/** Derivatives live next to each other under the media id. */
	derivative: (mediaId: string, variant: string, ext: string) =>
		`media/${mediaId}/${variant}.${ext}`,
	/** Watermark-free copy of a derivative, kept in the private originals bucket. */
	cleanDerivative: (mediaId: string, variant: string, ext: string) =>
		`media/${mediaId}/clean/${variant}.${ext}`,
	/** Full-resolution copy with the watermark, the default original download for the team. */
	watermarkedOriginal: (mediaId: string) => `media/${mediaId}/original-watermarked.jpg`
};
