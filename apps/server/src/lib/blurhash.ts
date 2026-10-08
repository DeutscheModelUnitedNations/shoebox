/**
 * Blurhash placeholders: the processor stores a blurhash per photo, `{@attach blurhash(hash)}`
 * paints it as the image's own background until the image has loaded.
 */
import { decode } from 'blurhash';
import type { Attachment } from 'svelte/attachments';

/** Decoding this small and letting the browser scale up keeps it cheap */
const SIZE = 32;
const decoded = new Map<string, string>();

/** The longer side gets SIZE pixels, so the placeholder keeps the photo's aspect ratio. */
export function placeholderSize(width = 1, height = 1) {
	const scale = SIZE / Math.max(width, height, 1);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

function placeholderUrl(hash: string, width: number, height: number): string | undefined {
	const key = `${hash}:${width}x${height}`;
	const cached = decoded.get(key);
	if (cached) return cached;
	const canvas = Object.assign(document.createElement('canvas'), { width, height });
	const context = canvas.getContext('2d');
	if (!context) return undefined;
	try {
		const image = context.createImageData(width, height);
		image.data.set(decode(hash, width, height));
		context.putImageData(image, 0, 0);
	} catch {
		return undefined;
	}
	const url = canvas.toDataURL();
	decoded.set(key, url);
	return url;
}

/**
 * Shows the blurhash behind the image while it loads, fitted like the image itself
 * (object-fit cover or contain), and removes it afterwards so transparent PNGs stay clean.
 */
export function blurhash(
	hash: string | null | undefined,
	photo: { width?: number | null; height?: number | null } = {}
): Attachment<HTMLImageElement> {
	return (img) => {
		if (!hash || (img.complete && img.naturalWidth > 0)) return;
		const size = placeholderSize(photo.width ?? undefined, photo.height ?? undefined);
		const url = placeholderUrl(hash, size.width, size.height);
		if (!url) return;
		const { objectFit, objectPosition } = getComputedStyle(img);
		Object.assign(img.style, {
			backgroundImage: `url(${url})`,
			backgroundSize: objectFit === 'contain' ? 'contain' : 'cover',
			backgroundPosition: objectPosition,
			backgroundRepeat: 'no-repeat'
		});
		const clear = () => (img.style.backgroundImage = '');
		img.addEventListener('load', clear, { once: true });
		return () => img.removeEventListener('load', clear);
	};
}
