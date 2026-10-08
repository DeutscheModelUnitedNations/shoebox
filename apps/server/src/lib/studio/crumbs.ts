import { resolve } from '$app/paths';
import { m } from '$lib/paraglide/messages';

/** Breadcrumbs of a page below an event in the manage view (duplicates, trash). */
export function eventPageCrumbs(
	event: { id: string; name: string; edition: string },
	current: string
) {
	return [
		{ label: m.navManage(), href: resolve('/(studio)/manage') },
		{
			label: `${event.name} ${event.edition}`,
			href: resolve('/(studio)/manage/[eventId]', { eventId: event.id })
		},
		{ label: current }
	];
}
