import type { S3Client } from '@aws-sdk/client-s3';
import type { JobPayload, ProcessingJobType } from '@shoebox/shared';
import type { ProcessorConfig } from '../config';
import { imageDerivatives } from './image';
import { ping } from './ping';
import { videoDerivatives } from './video';

export type HandlerContext = {
	s3: S3Client;
	config: ProcessorConfig;
	jobId: string;
};

export type JobHandler<T extends ProcessingJobType> = (
	ctx: HandlerContext,
	payload: JobPayload<T>
) => Promise<Record<string, unknown>>;

export const handlers: { [T in ProcessingJobType]: JobHandler<T> } = {
	PING: ping,
	IMAGE_DERIVATIVES: imageDerivatives,
	VIDEO_DERIVATIVES: videoDerivatives
};
