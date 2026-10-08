<script lang="ts">
	import { resolve } from '$app/paths';
	import { mutate } from '$lib/api/mutate';
	import { m } from '$lib/paraglide/messages';
	import { runAndReload } from '$lib/studio/toast.svelte';

	interface Props {
		eventId: string;
		assigned: { email: string; name: string | null; photos: number }[];
		/** Everyone with the photographer role */
		photographers: { email: string; name: string | null }[];
	}

	let { eventId, assigned, photographers }: Props = $props();

	let person = $state('');
	const available = $derived(
		photographers.filter((p) => !assigned.some((a) => a.email === p.email))
	);

	const unassign = (email: string) =>
		runAndReload(() => mutate('unassignPhotographer', { eventId, email }), m.adminSaved());

	async function assign() {
		const email = person;
		if (await runAndReload(() => mutate('assignPhotographer', { eventId, email }), m.adminSaved()))
			person = '';
	}
</script>

<section class="flex flex-col gap-3">
	<h2 class="text-primary text-2xl font-light">{m.adminPhotographersWithAccess()}</h2>
	{#each assigned as photographer (photographer.email)}
		<div class="border-base-300 flex items-center justify-between gap-4 border-b py-2">
			<span>
				{photographer.name ?? photographer.email}
				<span class="text-base-content/60">· {m.photoCount({ count: photographer.photos })}</span>
			</span>
			<button class="link link-primary text-sm" onclick={() => unassign(photographer.email)}>
				{m.adminRemove()}
			</button>
		</div>
	{:else}
		<p class="text-base-content/60 text-sm">{m.adminNobodyYet()}</p>
	{/each}
	<div class="flex items-end gap-3">
		<label class="fieldset flex-1">
			<span class="fieldset-legend">{m.adminAddPerson()}</span>
			<select class="select w-full" bind:value={person}>
				<option value="">{m.adminChoosePerson()}</option>
				{#each available as p (p.email)}
					<option value={p.email}>{p.name ? `${p.name} · ${p.email}` : p.email}</option>
				{/each}
			</select>
		</label>
		<button class="btn btn-outline" disabled={!person} onclick={assign}>{m.adminAdd()}</button>
	</div>
	<p class="text-base-content/60 text-sm">
		{m.adminPhotographersHint()}
		<a href={resolve('/(studio)/admin/users')} class="link link-primary">{m.adminUsers()}</a>
	</p>
</section>
