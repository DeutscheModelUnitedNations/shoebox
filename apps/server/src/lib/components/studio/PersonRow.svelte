<script lang="ts">
	import { page } from '$app/state';
	import { mutate } from '$lib/api/mutate';
	import { formatDate } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { runAndReload, toast } from '$lib/studio/toast.svelte';
	import type { PersonRole } from '$lib/studio/people';

	interface Props {
		person: {
			email: string;
			name: string | null;
			role: PersonRole;
			fromConfig: boolean;
			events: string[];
			lastSeenAt: string | null;
			invitedAt: string | null;
		};
		roleLabels: Record<PersonRole, () => string>;
	}

	let { person, roleLabels }: Props = $props();

	/** "today", "3 days ago", or a date for anything older than a week. */
	function lastSeen(iso: string | null) {
		if (!iso) return m.usersPending();
		const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
		if (days > 7) return formatDate(iso);
		return new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }).format(-days, 'day');
	}

	const conferences: Record<PersonRole, () => string> = {
		ADMIN: m.usersAll,
		TEAM: m.usersAllView,
		PHOTOGRAPHER: () => person.events.join(', ') || '–',
		GUEST: () => '–'
	};

	function setRole(role: string) {
		const email = person.email;
		return runAndReload(
			(): Promise<unknown> =>
				role === 'PHOTOGRAPHER'
					? mutate('invitePhotographer', { email })
					: mutate('revokePhotographer', { email }),
			m.usersRoleChanged()
		);
	}

	async function copyInvite() {
		await navigator.clipboard.writeText(`${page.url.origin}/login`);
		toast(m.usersLinkCopied());
	}
</script>

{#snippet role()}
	{#if person.fromConfig}
		<span class={['badge uppercase', person.role === 'ADMIN' ? 'badge-neutral' : 'badge-ghost']}>
			{roleLabels[person.role]()}
		</span>
		<p class="text-base-content/50 mt-1 text-xs">{m.usersFromConfig()}</p>
	{:else}
		<select
			class="select select-sm w-full"
			value={person.role}
			onchange={(e) => setRole(e.currentTarget.value)}
		>
			<option value="GUEST">{m.roleGuest()}</option>
			<option value="PHOTOGRAPHER">{m.rolePhotographer()}</option>
		</select>
	{/if}
{/snippet}

<tr>
	<td>
		<p class="font-bold">{person.name ?? person.email}</p>
		<p class="text-base-content/60 text-sm">
			{person.invitedAt ? m.usersInvitedOn({ date: formatDate(person.invitedAt) }) : person.email}
		</p>
	</td>
	<td class="min-w-44">{@render role()}</td>
	<td>
		{#if person.invitedAt}
			<button class="link link-primary" onclick={copyInvite}>{m.usersCopyInvite()}</button>
		{:else}
			{conferences[person.role]()}
		{/if}
	</td>
	<td class="text-base-content/70">{lastSeen(person.lastSeenAt)}</td>
</tr>
