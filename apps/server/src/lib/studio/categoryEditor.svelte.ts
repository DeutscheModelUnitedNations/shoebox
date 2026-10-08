import { mutate } from '$lib/api/mutate';
import { m } from '$lib/paraglide/messages';
import { runAndReload } from './toast.svelte';
import type { StudioCategory } from './types';

const subtreeIds = (n: StudioCategory): string[] => [n.id, ...n.children.flatMap(subtreeIds)];

/** Editing state of the category list on the event page (3e), shared by all rows. */
export class CategoryEditor {
	renaming = $state<{ id: string; name: string } | null>(null);
	/** Parent id of the category being added, null for a main category, undefined when idle */
	addingTo = $state<string | null | undefined>(undefined);
	newName = $state('');
	removing = $state<StudioCategory | null>(null);
	moveTarget = $state('');
	dragged = $state<{ id: string; parentId: string | null } | null>(null);

	constructor(private eventId: () => string) {}

	/** The category being deleted and everything below it, not valid move targets. */
	removedIds = $derived(this.removing ? subtreeIds(this.removing) : []);

	startAdding(parentId: string | null) {
		this.addingTo = parentId;
		this.newName = '';
	}

	startRemoving(node: StudioCategory) {
		this.removing = node;
		this.moveTarget = '';
	}

	async rename() {
		if (!this.renaming?.name.trim()) return;
		const { id, name } = this.renaming;
		if (await runAndReload(() => mutate('renameCategory', { id, name }), m.adminSaved()))
			this.renaming = null;
	}

	async add() {
		const parentId = this.addingTo;
		if (!this.newName.trim() || parentId === undefined) return;
		const input = { eventId: this.eventId(), parentId, name: this.newName };
		if (!(await runAndReload(() => mutate('createCategory', input), m.adminSaved()))) return;
		this.newName = '';
		this.addingTo = undefined;
	}

	async remove() {
		if (!this.removing) return;
		const input = { id: this.removing.id, moveTo: this.moveTarget || null };
		const ok = await runAndReload(() => mutate('deleteCategory', input), m.adminDeleted());
		if (ok) this.removing = null;
	}

	toggleHidden(node: StudioCategory) {
		return runAndReload(
			() => mutate('setCategoryHidden', { id: node.id, hidden: !node.hidden }),
			m.adminSaved()
		);
	}

	/** Drops the dragged category before `target`, both must share a parent. */
	async reorder(siblings: StudioCategory[], target: StudioCategory) {
		const moving = this.dragged;
		this.dragged = null;
		if (!moving || moving.id === target.id || moving.parentId !== target.parentId) return;
		const ids = siblings.map((s) => s.id).filter((id) => id !== moving.id);
		ids.splice(ids.indexOf(target.id), 0, moving.id);
		await runAndReload(
			() => mutate('reorderCategories', { eventId: this.eventId(), orderedIds: ids }),
			m.adminSaved()
		);
	}
}
