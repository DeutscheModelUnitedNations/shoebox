<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
</script>

<main class="flex min-h-screen items-center justify-center p-6">
	<div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body items-center text-center">
			<h1 class="text-primary text-6xl font-bold">{page.status}</h1>
			<p class="text-base-content/70">{page.error?.message}</p>
			<a class="btn btn-primary mt-4" href={resolve('/')}>{m.appName()}</a>
		</div>
	</div>
</main>
