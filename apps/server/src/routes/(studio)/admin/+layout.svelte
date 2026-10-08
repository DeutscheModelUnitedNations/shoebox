<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';

	let { children } = $props();

	const sections = [
		{
			href: resolve('/(studio)/admin/events'),
			label: m.adminEvents(),
			id: '/(studio)/admin/events'
		},
		{ href: resolve('/(studio)/admin/users'), label: m.adminUsers(), id: '/(studio)/admin/users' },
		{
			href: resolve('/(studio)/admin/settings'),
			label: m.adminSettings(),
			id: '/(studio)/admin/settings'
		},
		{ href: resolve('/(studio)/admin/usage'), label: m.usage(), id: '/(studio)/admin/usage' }
	];

	// Editing one conference uses the full width, as in the design
	const withSidebar = $derived(page.route.id !== '/(studio)/admin/events/[id]');
</script>

{#if withSidebar}
	<div class="grid flex-1 lg:grid-cols-[16rem_1fr]">
		<aside class="bg-base-200 flex flex-col gap-4 px-5 py-10 lg:px-8">
			<p class="text-base-content/60 text-xs tracking-widest uppercase">{m.navAdmin()}</p>
			<ul class="menu w-full p-0">
				{#each sections as section (section.id)}
					<li>
						<a
							href={section.href}
							class={page.route.id === section.id ? 'menu-active font-bold' : ''}
							aria-current={page.route.id === section.id ? 'page' : undefined}
						>
							{section.label}
						</a>
					</li>
				{/each}
			</ul>
		</aside>
		<div class="min-w-0 px-5 py-10 lg:px-12">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}
