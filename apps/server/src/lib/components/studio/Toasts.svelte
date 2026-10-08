<script lang="ts">
	import { toasts } from '$lib/studio/toast.svelte';
</script>

<div class="toast toast-end z-50" aria-live="polite">
	{#each toasts as t (t.id)}
		<div
			class={[
				'alert',
				t.kind === 'error' && 'alert-error',
				t.kind === 'success' && 'alert-success',
				t.kind === 'info' && 'alert-info'
			]}
		>
			<span>{t.message}</span>
		</div>
	{/each}
</div>
