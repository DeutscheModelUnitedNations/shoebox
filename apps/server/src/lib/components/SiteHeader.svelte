<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
	import UserCircleIcon from 'phosphor-svelte/lib/UserCircleIcon';
	import Logo from './Logo.svelte';

	interface Props {
		user: { given_name?: string | null; family_name?: string | null; email?: string | null } | null;
		isTeam: boolean;
		isAdmin: boolean;
	}

	let { user, isTeam, isAdmin }: Props = $props();

	const role = $derived(isAdmin ? m.roleAdmin() : isTeam ? m.roleTeam() : m.roleUser());
	const name = $derived(
		[user?.given_name, user?.family_name].filter(Boolean).join(' ') || user?.email
	);
</script>

<header class="navbar border-base-300 bg-base-100 min-h-15 border-b px-5 py-0 lg:min-h-19 lg:px-12">
	<div class="flex-1">
		<a href={resolve('/')} class="inline-flex hover:opacity-80">
			<Logo variant="short" class="-my-1 h-14 sm:hidden" />
			<Logo variant="full" class="-my-3 hidden h-22 sm:block" />
		</a>
	</div>

	<nav class="hidden items-center gap-8 sm:flex">
		<a href={resolve('/usage')} class="link link-hover text-base-content">{m.usage()}</a>
		{#if user}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-sm">
					<UserCircleIcon size={20} weight="duotone" />
					{name}
				</div>
				<ul tabindex="-1" class="dropdown-content menu bg-base-100 z-20 mt-2 w-60 p-2 shadow">
					<li class="menu-title">
						<span class="flex items-center justify-between gap-2">
							<span class="truncate">{user.email}</span>
							<span class="badge badge-neutral badge-sm">{role}</span>
						</span>
					</li>
					<li>
						<a href={resolve('/logout')} data-sveltekit-reload>
							<SignOutIcon size={18} weight="duotone" />
							{m.logout()}
						</a>
					</li>
				</ul>
			</div>
		{:else}
			<a href={resolve('/login')} class="btn btn-primary btn-sm" data-sveltekit-reload>
				{m.login()}
			</a>
		{/if}
	</nav>

	<div class="dropdown dropdown-end sm:hidden">
		<div tabindex="0" role="button" class="btn btn-ghost btn-sm px-0 font-bold">
			<ListIcon size={20} weight="duotone" />
			{m.menu()}
		</div>
		<ul tabindex="-1" class="dropdown-content menu bg-base-100 z-20 mt-2 w-56 p-2 shadow">
			<li><a href={resolve('/')}>{m.home()}</a></li>
			<li><a href={resolve('/usage')}>{m.usage()}</a></li>
			{#if user}
				<li>
					<a href={resolve('/logout')} data-sveltekit-reload>
						<SignOutIcon size={18} weight="duotone" />
						{m.logout()}
					</a>
				</li>
			{:else}
				<li><a href={resolve('/login')} data-sveltekit-reload>{m.login()}</a></li>
			{/if}
		</ul>
	</div>
</header>
