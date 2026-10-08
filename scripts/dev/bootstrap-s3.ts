/**
 * Idempotent bootstrap of the local Garage instance started by dev.docker-compose.yml.
 *
 * Garage itself creates the originals bucket and the access key (single-node mode with
 * GARAGE_DEFAULT_*). This script adds what the S3 API can do with that key:
 *   1. the derivatives bucket
 *   2. a global alias for it via the admin API. A bucket created over S3 only gets an alias
 *      local to the key, and the web endpoint resolves global aliases only
 *   3. website access on it, so derivatives are served anonymously from the web endpoint
 *   4. CORS rules on both buckets, so the browser can PUT presigned uploads and GET derivatives
 *
 * Runs as the `s3` task of `bun run dev` and exits once done. Safe to rerun at any time.
 */
import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutBucketCorsCommand,
	PutBucketWebsiteCommand
} from '@aws-sdk/client-s3';
import { createS3Client, s3EnvSchema } from '@shoebox/shared';

const env = s3EnvSchema.parse(process.env);
const s3 = createS3Client(env);
const corsOrigins = (process.env.DEV_CORS_ORIGINS ?? 'https://localhost:5173')
	.split(',')
	.map((o) => o.trim())
	.filter(Boolean);

const garageAdmin = process.env.GARAGE_ADMIN_URL ?? 'http://localhost:3903';
const garageAdminToken = process.env.GARAGE_ADMIN_TOKEN ?? 'shoebox-dev-admin-token';

const log = (msg: string) => console.log(`[s3] ${msg}`);

async function waitForGarage(attempts = 60) {
	for (let i = 1; i <= attempts; i++) {
		try {
			await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET_ORIGINALS }));
			return;
		} catch (error) {
			if (i === attempts) throw error;
			if (i === 1 || i % 10 === 0) log(`waiting for ${env.S3_ENDPOINT} (${i}/${attempts})...`);
			await Bun.sleep(1000);
		}
	}
}

async function ensureBucket(bucket: string) {
	try {
		await s3.send(new HeadBucketCommand({ Bucket: bucket }));
		log(`bucket ${bucket} exists`);
	} catch {
		await s3.send(new CreateBucketCommand({ Bucket: bucket }));
		log(`created bucket ${bucket}`);
	}
}

interface GarageBucket {
	id: string;
	globalAliases: string[];
	localAliases: { accessKeyId: string; alias: string }[];
}

async function garage<T>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${garageAdmin}${path}`, {
		method: body ? 'POST' : 'GET',
		headers: { Authorization: `Bearer ${garageAdminToken}`, 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	if (!res.ok) throw new Error(`Garage admin ${path}: ${res.status} ${await res.text()}`);
	return (await res.json()) as T;
}

async function ensureGlobalAlias(bucket: string) {
	const buckets = await garage<GarageBucket[]>('/v2/ListBuckets');
	const found = buckets.find(
		(b) => b.globalAliases.includes(bucket) || b.localAliases.some((l) => l.alias === bucket)
	);
	if (!found) throw new Error(`bucket ${bucket} not found via the admin API`);
	if (found.globalAliases.includes(bucket)) {
		log(`global alias ${bucket} exists`);
		return;
	}
	await garage('/v2/AddBucketAlias', { bucketId: found.id, globalAlias: bucket });
	log(`added global alias ${bucket}`);
}

async function enableWebsite(bucket: string) {
	await s3.send(
		new PutBucketWebsiteCommand({
			Bucket: bucket,
			WebsiteConfiguration: { IndexDocument: { Suffix: 'index.html' } }
		})
	);
	log(`website access enabled on ${bucket}`);
}

async function putCors(bucket: string) {
	await s3.send(
		new PutBucketCorsCommand({
			Bucket: bucket,
			CORSConfiguration: {
				CORSRules: [
					{
						AllowedOrigins: corsOrigins,
						AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST'],
						AllowedHeaders: ['*'],
						ExposeHeaders: ['ETag'],
						MaxAgeSeconds: 3600
					}
				]
			}
		})
	);
	log(`CORS set on ${bucket} for ${corsOrigins.join(', ')}`);
}

await waitForGarage();
await ensureBucket(env.S3_BUCKET_ORIGINALS);
await ensureBucket(env.S3_BUCKET_DERIVATIVES);
await ensureGlobalAlias(env.S3_BUCKET_DERIVATIVES);
await enableWebsite(env.S3_BUCKET_DERIVATIVES);
await putCors(env.S3_BUCKET_ORIGINALS);
await putCors(env.S3_BUCKET_DERIVATIVES);
log('done');
