/** The edit panel of the manage view (3d) as plain functions over the selected photos. */
import type { StudioMedia } from './types';

export interface EditForm {
	caption: string;
	photographer: string;
	/** A category id, `none` for no category, '' to keep the mixed values */
	category: string;
	/** PUBLIC, TEAM, or '' to keep the mixed values */
	visibility: string;
}

/** The shared value of a field, or undefined when the selection differs. */
function common<T>(selection: StudioMedia[], pick: (m: StudioMedia) => T): T | undefined {
	const values = new Set(selection.map(pick));
	return values.size === 1 ? [...values][0] : undefined;
}

export const mixed = (selection: StudioMedia[], pick: (m: StudioMedia) => unknown) =>
	common(selection, pick) === undefined;

function categoryValue(selection: StudioMedia[]) {
	const shared = common(selection, (m) => m.categoryId);
	if (shared === undefined) return '';
	return shared ?? 'none';
}

/** Prefills the form with what the selection has in common. */
export function formFromSelection(selection: StudioMedia[]): EditForm {
	return {
		caption: common(selection, (m) => m.title) ?? '',
		photographer: common(selection, (m) => m.photographer) ?? '',
		category: categoryValue(selection),
		visibility: common(selection, (m) => m.visibility) ?? ''
	};
}

/** A text field left empty over mixed values keeps them (null), otherwise it is written. */
function textChange(value: string, selection: StudioMedia[], pick: (m: StudioMedia) => string) {
	return value === '' && mixed(selection, pick) ? null : value;
}

/** The updateMedia arguments for the form, leaving untouched mixed fields alone. */
export function editInput(form: EditForm, selection: StudioMedia[]) {
	const target = form.category === 'none' ? null : form.category;
	const moveCategory = form.category !== '' && target !== common(selection, (m) => m.categoryId);
	const visibility = form.visibility === 'PUBLIC' || form.visibility === 'TEAM';
	return {
		mediaIds: selection.map((m) => m.id),
		title: textChange(form.caption, selection, (m) => m.title),
		photographer: textChange(form.photographer, selection, (m) => m.photographer),
		moveCategory,
		categoryId: moveCategory ? target : null,
		visibility: visibility ? (form.visibility as 'PUBLIC' | 'TEAM') : null
	};
}
