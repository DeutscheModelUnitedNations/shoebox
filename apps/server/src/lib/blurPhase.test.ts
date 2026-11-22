import { describe, expect, it } from 'vitest';
import { initialPhase, loadFailed, settledPhase, sourcePhase } from './blurPhase';

describe('blur phases', () => {
	it('starts server-rendered images blurred and client ones waiting', () => {
		expect(initialPhase(false)).toBe('blurred');
		expect(initialPhase(true)).toBe('waiting');
	});

	it('animates only out of the blur', () => {
		expect(settledPhase('blurred')).toBe('revealing');
		expect(settledPhase('waiting')).toBe('shown');
		// Svelte replays load events at hydration, after the reveal has started
		expect(settledPhase('revealing')).toBe('revealing');
	});

	it('shows cached images instantly and blurs the others after the grace time', () => {
		expect(sourcePhase('shown', { changed: true, complete: true })).toEqual({
			phase: 'shown',
			blurLater: false
		});
		expect(sourcePhase('shown', { changed: true, complete: false })).toEqual({
			phase: 'waiting',
			blurLater: true
		});
	});

	it('keeps the first paint blurred and reveals what loaded before hydration', () => {
		expect(sourcePhase('blurred', { changed: false, complete: true }).phase).toBe('revealing');
		expect(sourcePhase('blurred', { changed: false, complete: false })).toEqual({
			phase: 'blurred',
			blurLater: false
		});
	});

	it('treats a finished image without pixels as failed', () => {
		expect(loadFailed({ complete: true, naturalWidth: 0 })).toBe(true);
		expect(loadFailed({ complete: true, naturalWidth: 1600 })).toBe(false);
		expect(loadFailed({ complete: false, naturalWidth: 0 })).toBe(false);
	});
});
