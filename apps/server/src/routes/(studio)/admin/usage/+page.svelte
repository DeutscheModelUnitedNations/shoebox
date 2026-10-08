<script lang="ts">
	import { resolve } from '$app/paths';
	import { mutate } from '$lib/api/mutate';
	import AdminHeading from '$lib/components/studio/AdminHeading.svelte';
	import { formatDate } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';
	import { runAndReload } from '$lib/studio/toast.svelte';

	let { data } = $props();

	let de = $state('');
	let en = $state('');
	$effect(() => {
		de = data.usage.de;
		en = data.usage.en;
	});

	const save = () => runAndReload(() => mutate('saveUsageNotes', { de, en }), m.adminSaved());
</script>

<svelte:head>
	<title>{m.usage()} · {m.navAdmin()} · {m.appName()}</title>
</svelte:head>

<div class="flex flex-col gap-8">
	<AdminHeading title={m.usage()}>
		<button class="btn btn-primary" onclick={save}>{m.adminSave()}</button>
	</AdminHeading>

	<p class="text-base-content/70 text-sm">
		{#if data.updatedAt}
			{m.usageLastChanged({ date: formatDate(data.updatedAt), name: data.updatedBy ?? '–' })} ·
		{/if}
		<a href={resolve('/usage')} class="link link-primary">{m.usageViewPage()}</a>
	</p>

	<div class="grid gap-6 xl:grid-cols-2">
		<label class="fieldset">
			<span class="fieldset-legend">{m.usageGerman()}</span>
			<textarea class="textarea h-80 w-full" bind:value={de}></textarea>
		</label>
		<label class="fieldset">
			<span class="fieldset-legend">{m.usageEnglish()}</span>
			<textarea class="textarea h-80 w-full" bind:value={en}></textarea>
		</label>
	</div>
	<p class="text-base-content/60 text-sm leading-snug">{m.usageEditHint()}</p>
</div>
