<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { CategoryEditor } from '$lib/studio/categoryEditor.svelte';

	interface Props {
		editor: CategoryEditor;
		placeholder: string;
		/** Left indent in rem, to line up below the parent */
		indent?: number;
	}

	let { editor, placeholder, indent = 0 }: Props = $props();
</script>

<div class="flex gap-2 pb-3" style:padding-left={`${indent}rem`}>
	<input
		class="input input-sm flex-1"
		{placeholder}
		bind:value={editor.newName}
		onkeydown={(e) => e.key === 'Enter' && editor.add()}
	/>
	<button class="btn btn-sm btn-outline" onclick={() => editor.add()}>{m.adminAdd()}</button>
</div>
