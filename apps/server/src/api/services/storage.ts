import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client } from '@shoebox/shared';
import { configPrivate } from '$config/private';
import { configPublic } from '$config/public';

export const s3 = createS3Client(configPrivate);

export const buckets = {
	originals: configPrivate.S3_BUCKET_ORIGINALS,
	derivatives: configPrivate.S3_BUCKET_DERIVATIVES
};

/** Presigned PUT so the browser uploads an original straight into the private bucket. */
export function presignUpload(key: string, contentType: string, expiresIn = 15 * 60) {
	return getSignedUrl(
		s3,
		new PutObjectCommand({ Bucket: buckets.originals, Key: key, ContentType: contentType }),
		{ expiresIn }
	);
}

/** Short-lived GET for originals and anything team-private. A filename makes it a download. */
export function presignDownload(
	bucket: string,
	key: string,
	expiresIn = 5 * 60,
	filename?: string
) {
	return getSignedUrl(
		s3,
		new GetObjectCommand({
			Bucket: bucket,
			Key: key,
			ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined
		}),
		{ expiresIn }
	);
}

/** Derivatives are public and served without signing, from a CDN or the bucket website. */
export function publicDerivativeUrl(key: string) {
	return `${configPublic.PUBLIC_MEDIA_BASE_URL}/${key}`;
}
