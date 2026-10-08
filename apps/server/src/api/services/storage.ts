import {
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	UploadPartCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client, deleteMediaObjects } from '@shoebox/shared';
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

/** True once the browser finished the presigned upload. */
export async function originalExists(key: string) {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: buckets.originals, Key: key }));
		return true;
	} catch {
		return false;
	}
}

/** Removes every object of a media item, in both buckets. */
export function deleteMediaFiles(mediaId: string) {
	return deleteMediaObjects(s3, configPrivate, mediaId);
}

/** ZIP archives go up in 64 MB parts, so a dropped connection only repeats one part. */
const MULTIPART_PART_SIZE = 64 * 1024 * 1024;

export async function startMultipartUpload(key: string, size: number, expiresIn = 24 * 60 * 60) {
	const { UploadId } = await s3.send(
		new CreateMultipartUploadCommand({
			Bucket: buckets.originals,
			Key: key,
			ContentType: 'application/zip'
		})
	);
	if (!UploadId) throw new Error('S3 did not return an upload id');
	const parts = Math.max(1, Math.ceil(size / MULTIPART_PART_SIZE));
	const partUrls = await Promise.all(
		Array.from({ length: parts }, (_, i) =>
			getSignedUrl(
				s3,
				new UploadPartCommand({
					Bucket: buckets.originals,
					Key: key,
					UploadId,
					PartNumber: i + 1
				}),
				{ expiresIn }
			)
		)
	);
	return { uploadId: UploadId, partSize: MULTIPART_PART_SIZE, partUrls };
}

export async function completeMultipartUpload(
	key: string,
	uploadId: string,
	parts: { partNumber: number; etag: string }[]
) {
	await s3.send(
		new CompleteMultipartUploadCommand({
			Bucket: buckets.originals,
			Key: key,
			UploadId: uploadId,
			MultipartUpload: {
				Parts: [...parts]
					.sort((a, b) => a.partNumber - b.partNumber)
					.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
			}
		})
	);
}

export async function abortMultipartUpload(key: string, uploadId: string) {
	await s3.send(
		new AbortMultipartUploadCommand({ Bucket: buckets.originals, Key: key, UploadId: uploadId })
	);
}
