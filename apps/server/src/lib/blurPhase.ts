/**
 * Phases of a BlurImage. `blurred`: image hidden under its blurhash, `waiting`: shown as it is
 * while a client-side image gets a moment to come from the cache, `revealing`: animating from
 * the blur to the photo, `shown`: plain photo.
 */
export type BlurPhase = 'blurred' | 'waiting' | 'revealing' | 'shown';

/** Server-rendered images start blurred, images created on the client wait for the cache first. */
export const initialPhase = (hydrated: boolean): BlurPhase => (hydrated ? 'waiting' : 'blurred');

/** Loaded or failed: animate only when the blur was showing, a running reveal keeps going. */
export const settledPhase = (phase: BlurPhase): BlurPhase =>
	phase === 'blurred' || phase === 'revealing' ? 'revealing' : 'shown';

/**
 * What a (new) source means right after the DOM has it: settled when the image is already
 * complete, else blurred later unless it was blurred from the start.
 */
export function sourcePhase(
	phase: BlurPhase,
	{ changed, complete }: { changed: boolean; complete: boolean }
): { phase: BlurPhase; blurLater: boolean } {
	const current = changed ? 'waiting' : phase;
	if (complete) return { phase: settledPhase(current), blurLater: false };
	return { phase: current, blurLater: current === 'waiting' };
}
