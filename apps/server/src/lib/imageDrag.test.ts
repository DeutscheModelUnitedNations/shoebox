import { describe, expect, it, vi } from 'vitest';
import { blockPhotoDrag } from './imageDrag';

/** Stand-in for a DOM element: `photo` when it is one, `holdsPhoto` when one is inside */
function element({ draggable = null as string | null, photo = false, holdsPhoto = false }) {
	return {
		getAttribute: (name: string) => (name === 'draggable' ? draggable : null),
		matches: () => photo,
		querySelector: () => (holdsPhoto ? {} : null)
	};
}

function drag(target: unknown) {
	const event = { target: target as EventTarget, preventDefault: vi.fn() };
	blockPhotoDrag(event);
	return event.preventDefault.mock.calls.length > 0;
}

describe('blockPhotoDrag', () => {
	it('blocks photos and links around them', () => {
		expect(drag(element({ photo: true }))).toBe(true);
		expect(drag(element({ holdsPhoto: true }))).toBe(true);
	});

	it('keeps elements that opt in, other drags and non-elements', () => {
		expect(drag(element({ holdsPhoto: true, draggable: 'true' }))).toBe(false);
		expect(drag(element({}))).toBe(false);
		expect(drag(null)).toBe(false);
	});
});
