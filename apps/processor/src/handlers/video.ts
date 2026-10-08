import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { downloadToFile } from '../s3io';
import { markMediaReady } from '@shoebox/db';
import { blurhashOf, loadRenderConfig, renderVariants } from './image';
import type { HandlerContext, JobHandler } from './index';

const run = promisify(execFile);

type Probe = {
	durationSeconds?: number;
	width?: number;
	height?: number;
	codec?: string;
	container?: string;
};

export async function probe(ctx: HandlerContext, file: string): Promise<Probe> {
	const { stdout } = await run(ctx.config.FFPROBE_PATH, [
		'-v',
		'error',
		'-print_format',
		'json',
		'-show_format',
		'-show_streams',
		file
	]);
	const json = JSON.parse(stdout) as {
		format?: { duration?: string; format_name?: string };
		streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
	};
	const video = json.streams?.find((s) => s.codec_type === 'video');
	const duration = json.format?.duration ? Number(json.format.duration) : undefined;
	return {
		durationSeconds: Number.isFinite(duration) ? duration : undefined,
		width: video?.width,
		height: video?.height,
		codec: video?.codec_name,
		container: json.format?.format_name
	};
}

/** Grabs one frame as PNG. Falls back to the first frame for clips shorter than a second. */
export async function posterFrame(ctx: HandlerContext, file: string, atSeconds: number) {
	const grab = (seek: number) =>
		run(
			ctx.config.FFMPEG_PATH,
			[
				'-v',
				'error',
				'-ss',
				String(seek),
				'-i',
				file,
				'-frames:v',
				'1',
				'-f',
				'image2',
				'-c:v',
				'png',
				'pipe:1'
			],
			{ encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }
		);
	let { stdout } = await grab(atSeconds);
	if (stdout.length === 0 && atSeconds > 0) ({ stdout } = await grab(0));
	if (stdout.length === 0) throw new Error('ffmpeg produced no poster frame');
	return stdout;
}

export const videoDerivatives: JobHandler<'VIDEO_DERIVATIVES'> = async (ctx, payload) => {
	const dir = await mkdtemp(join(tmpdir(), 'shoebox-'));
	try {
		const file = join(dir, 'source');
		await downloadToFile(ctx.s3, payload.bucket, payload.key, file);
		const info = await probe(ctx, file);
		const seek = Math.min(1, (info.durationSeconds ?? 0) / 2);
		const poster = sharp(await posterFrame(ctx, file, seek));
		const [blurhash, derivatives] = await Promise.all([
			blurhashOf(poster),
			loadRenderConfig(ctx, payload.mediaId).then((config) =>
				renderVariants(ctx, poster, payload.mediaId, payload.public, config)
			)
		]);
		const result = { ...info, blurhash, derivatives };
		await markMediaReady(ctx.db, payload.mediaId, result);
		return result;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
};
