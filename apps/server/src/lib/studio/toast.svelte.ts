import { invalidateAll } from '$app/navigation';

/** Short confirmations and errors on the work screens, rendered by Toasts.svelte. */
export interface Toast {
	id: number;
	kind: 'success' | 'error' | 'info';
	message: string;
}

let next = 0;
export const toasts = $state<Toast[]>([]);

export function toast(message: string, kind: Toast['kind'] = 'success', ms = 4000) {
	const id = ++next;
	toasts.push({ id, kind, message });
	setTimeout(() => {
		const index = toasts.findIndex((t) => t.id === id);
		if (index >= 0) toasts.splice(index, 1);
	}, ms);
}

/** Runs a mutation, reports failures as a toast and rethrows nothing. */
export async function attempt<T>(task: () => Promise<T>, success?: string): Promise<T | undefined> {
	try {
		const result = await task();
		if (success) toast(success);
		return result;
	} catch (error) {
		toast(error instanceof Error ? error.message : String(error), 'error', 7000);
		return undefined;
	}
}

/** Runs a mutation like attempt, reloads the page data on success and reports whether it worked. */
export async function runAndReload(task: () => Promise<unknown>, success?: string) {
	const ok = (await attempt(task, success)) !== undefined;
	if (ok) await invalidateAll();
	return ok;
}
