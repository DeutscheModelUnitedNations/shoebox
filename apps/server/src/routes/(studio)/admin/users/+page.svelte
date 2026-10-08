<script lang="ts">
	import AdminHeading from '$lib/components/studio/AdminHeading.svelte';
	import InviteDialog from '$lib/components/studio/InviteDialog.svelte';
	import PersonRow from '$lib/components/studio/PersonRow.svelte';
	import { m } from '$lib/paraglide/messages';
	import { filterPeople, type PersonRole } from '$lib/studio/people';

	let { data } = $props();

	let search = $state('');
	let roleFilter = $state<PersonRole | ''>('');
	let inviting = $state(false);

	const roleLabels: Record<PersonRole, () => string> = {
		ADMIN: m.roleAdmin,
		PHOTOGRAPHER: m.rolePhotographer,
		TEAM: m.roleTeamMember,
		GUEST: m.roleGuest
	};

	const roleTexts = [
		[m.roleTeamMember(), m.usersTeamText()],
		[m.rolePhotographer(), m.usersPhotographerText()],
		[m.roleAdmin(), m.usersAdminText()]
	];

	const filtered = $derived(filterPeople(data.people, search, roleFilter));
</script>

<svelte:head>
	<title>{m.adminUsers()} · {m.navAdmin()} · {m.appName()}</title>
</svelte:head>

<div class="flex flex-col gap-8">
	<AdminHeading title={m.adminUsers()}>
		<button class="btn btn-primary" onclick={() => (inviting = true)}>{m.usersInvite()}</button>
	</AdminHeading>

	<div class="grid gap-6 sm:grid-cols-3">
		{#each roleTexts as [title, text] (title)}
			<div class="border-base-content border-t pt-3">
				<p class="font-bold">{title}</p>
				<p class="text-base-content/70 text-sm leading-snug">{text}</p>
			</div>
		{/each}
	</div>

	<div class="flex flex-wrap gap-3">
		<input
			class="input flex-1"
			placeholder={m.usersSearch()}
			bind:value={search}
			aria-label={m.usersSearch()}
		/>
		<select class="select w-48" bind:value={roleFilter} aria-label={m.usersFilterRole()}>
			<option value="">{m.usersAllRoles()}</option>
			{#each Object.entries(roleLabels) as [value, label] (value)}
				<option {value}>{label()}</option>
			{/each}
		</select>
	</div>

	<div class="overflow-x-auto">
		<table class="table">
			<thead>
				<tr class="border-base-content">
					<th>{m.usersPerson()}</th>
					<th>{m.usersRole()}</th>
					<th>{m.usersConferences()}</th>
					<th>{m.usersLastSeen()}</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as person (person.email)}
					<PersonRow {person} {roleLabels} />
				{/each}
			</tbody>
		</table>
	</div>
	<p class="text-base-content/60 text-sm">{m.usersFootnote()}</p>
</div>

{#if inviting}
	<InviteDialog onClose={() => (inviting = false)} />
{/if}
