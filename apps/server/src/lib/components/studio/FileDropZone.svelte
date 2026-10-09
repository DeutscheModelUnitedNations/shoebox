<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { ACCEPTED_TYPES } from '$lib/studio/uploads.svelte';

	interface Props {
		/** Called with at least one file */
		onFiles: (files: File[]) => void;
		accept?: string;
		multiple?: boolean;
		title?: string;
		hint?: string;
	}

	let {
		onFiles,
		accept = ACCEPTED_TYPES.join(','),
		multiple = true,
		title = m.uploadDropHere(),
		hint = m.uploadAccepted()
	}: Props = $props();

	let dragOver = $state(false);
	let input = $state<HTMLInputElement>();

	function take(files: FileList | null | undefined) {
		if (files?.length) onFiles([...files]);
	}
</script>

<div
	role="region"
	aria-label={title}
	class={[
		'bg-base-200 border-base-content/30 flex flex-col items-center gap-3 border border-dashed px-6 py-12 text-center',
		dragOver && 'border-primary bg-base-300'
	]}
	ondragover={(e) => {
		e.preventDefault();
		dragOver = true;
	}}
	ondragleave={() => (dragOver = false)}
	ondrop={(e) => {
		e.preventDefault();
		dragOver = false;
		take(e.dataTransfer?.files);
	}}
>
	<p class="text-xl font-bold">{title}</p>
	<p class="text-base-content/70 text-sm">{hint}</p>
	<input
		bind:this={input}
		type="file"
		{multiple}
		{accept}
		class="hidden"
		onchange={(e) => {
			take(e.currentTarget.files);
			e.currentTarget.value = '';
		}}
	/>
	<button class="btn btn-outline" onclick={() => input?.click()}>{m.uploadChoose()}</button>
</div>
