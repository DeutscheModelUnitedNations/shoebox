/** Selector of the photos BlurImage renders */
const PHOTO = 'img[data-blur-image]';

type DragSource = Pick<Element, 'getAttribute' | 'matches' | 'querySelector'>;

/**
 * Cancels dragging a photo out of the page, also when the drag starts on a link around it (the
 * browser then drags the link with the photo as preview). Elements that opt in with
 * `draggable="true"`, like the manage tiles for reordering, keep their drag.
 */
export function blockPhotoDrag(event: { target: EventTarget | null; preventDefault(): void }) {
	const source = event.target as Partial<DragSource> | null;
	if (!source?.matches || source.getAttribute?.('draggable') === 'true') return;
	if (source.matches(PHOTO) || source.querySelector?.(PHOTO)) event.preventDefault();
}
