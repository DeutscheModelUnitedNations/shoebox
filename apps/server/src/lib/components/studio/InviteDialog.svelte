<script lang="ts">
	import { mutate } from '$lib/api/mutate';
	import { m } from '$lib/paraglide/messages';
	import { runAndReload } from '$lib/studio/toast.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let email = $state('');
	const valid = $derived(email.includes('@'));

	async function invite() {
		if (!valid) return;
		const done = await runAndReload(
			() => mutate('invitePhotographer', { email }),
			m.usersInvited()
		);
		if (done) onClose();
	}
</script>

<Modal title={m.usersInvite()} {onClose}>
	<p class="text-base-content/70 text-sm leading-snug">{m.usersInviteText()}</p>
	<label class="fieldset">
		<span class="fieldset-legend">{m.usersEmail()}</span>
		<input
			type="email"
			class="input w-full"
			bind:value={email}
			onkeydown={(e) => e.key === 'Enter' && invite()}
		/>
	</label>
	{#snippet actions()}
		<button class="btn btn-outline" onclick={onClose}>{m.cancel()}</button>
		<button class="btn btn-primary" disabled={!valid} onclick={invite}>
			{m.usersInviteSubmit()}
		</button>
	{/snippet}
</Modal>
