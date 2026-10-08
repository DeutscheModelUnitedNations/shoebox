import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

export async function downloadToBuffer(s3: S3Client, bucket: string, key: string): Promise<Buffer> {
	const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	if (!res.Body) throw new Error(`Empty body for s3://${bucket}/${key}`);
	return Buffer.from(await res.Body.transformToByteArray());
}

export async function downloadToFile(s3: S3Client, bucket: string, key: string, path: string) {
	const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	if (!res.Body) throw new Error(`Empty body for s3://${bucket}/${key}`);
	await pipeline(res.Body as Readable, createWriteStream(path));
}

export async function upload(
	s3: S3Client,
	bucket: string,
	key: string,
	body: Buffer,
	contentType: string
) {
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: 'public, max-age=31536000, immutable'
		})
	);
}
