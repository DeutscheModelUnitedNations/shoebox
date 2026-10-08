<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import ListIcon from 'phosphor-svelte/lib/ListIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
	import Logo from './Logo.svelte';

	interface Props {
		user: { given_name?: string | null; family_name?: string | null; email?: string | null } | null;
		isTeam: boolean;
		isAdmin: boolean;
		isPhotographer: boolean;
	}

	let { user, isTeam, isAdmin, isPhotographer }: Props = $props();

	const role = $derived(
		isAdmin
			? m.roleAdmin()
			: isPhotographer
				? m.rolePhotographer()
				: isTeam
					? m.roleTeam()
					: m.roleUser()
	);
	const name = $derived(
		[user?.given_name, user?.family_name].filter(Boolean).join(' ') || user?.email
	);
	const canUpload = $derived(isAdmin || isPhotographer);

	/** Gallery, upload, manage and admin entries for the people who may use them. */
	const links = $derived(
		[
			{ href: resolve('/'), label: m.navGallery(), section: 'gallery', show: canUpload },
			{ href: resolve('/upload'), label: m.navUpload(), section: 'upload', show: canUpload },
			{ href: resolve('/manage'), label: m.navManage(), section: 'manage', show: canUpload },
			{ href: resolve('/admin'), label: m.navAdmin(), section: 'admin', show: isAdmin },
			{ href: resolve('/usage'), label: m.usage(), section: 'usage', show: !canUpload }
		].filter((l) => l.show)
	);

	/** The first path segment decides which entry is highlighted. */
	const current = $derived.by(() => {
		const segment = page.url.pathname.split('/')[1] ?? '';
		return ['upload', 'manage', 'admin', 'usage'].includes(segment) ? segment : 'gallery';
	});
</script>

<header
	class="navbar border-base-300 bg-base-100 min-h-15 gap-6 border-b px-5 py-0 lg:min-h-19 lg:px-12"
>
	<div class="flex-1">
		<a href={resolve('/')} class="inline-flex hover:opacity-80">
			<!-- Wrapped: Logo swaps its own artwork for dark mode, which would override hidden here -->
			<span class="sm:hidden"><Logo variant="short" class="-my-1 h-14" /></span>
			<span class="hidden sm:block"><Logo variant="full" class="-my-3 h-22" /></span>
		</a>
	</div>

	<nav class="hidden items-center gap-7 md:flex">
		{#each links as link (link.section)}
			<a
				href={link.href}
				class={[
					'link link-hover',
					current === link.section ? 'text-primary font-bold' : 'text-base-content'
				]}
				aria-current={current === link.section ? 'page' : undefined}
			>
				{link.label}
			</a>
		{/each}
		{#if user}
			<div class="border-base-300 flex items-center border-l pl-6">
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-3 px-2">
						{name}
						<span class={['badge badge-sm uppercase', isAdmin ? 'badge-neutral' : 'badge-ghost']}>
							{role}
						</span>
					</div>
					<ul tabindex="-1" class="dropdown-content menu bg-base-100 z-20 mt-2 w-60 p-2 shadow">
						<li class="menu-title truncate">{user.email}</li>
						<li>
							<a href={resolve('/logout')} data-sveltekit-reload>
								<SignOutIcon size={18} weight="duotone" />
								{m.logout()}
							</a>
						</li>
					</ul>
				</div>
			</div>
		{:else}
			<a href={resolve('/login')} class="btn btn-primary btn-sm" data-sveltekit-reload>
				{m.login()}
			</a>
		{/if}
	</nav>

	<div class="dropdown dropdown-end md:hidden">
		<div tabindex="0" role="button" class="btn btn-ghost btn-sm">
			<ListIcon size={20} weight="duotone" />
			{m.menu()}
		</div>
		<ul tabindex="-1" class="dropdown-content menu bg-base-100 z-20 mt-2 w-56 p-2 shadow">
			{#if !canUpload}
				<li><a href={resolve('/')}>{m.home()}</a></li>
			{/if}
			{#each links as link (link.section)}
				<li><a href={link.href}>{link.label}</a></li>
			{/each}
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
