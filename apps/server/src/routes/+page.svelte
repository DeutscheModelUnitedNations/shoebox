<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';
	import { getTheme, toggleTheme, type Theme } from '$lib/utils/theme.svelte';
	import { onMount } from 'svelte';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import CloudIcon from 'phosphor-svelte/lib/CloudIcon';
	import DatabaseIcon from 'phosphor-svelte/lib/DatabaseIcon';
	import ImagesSquareIcon from 'phosphor-svelte/lib/ImagesSquareIcon';
	import MonitorIcon from 'phosphor-svelte/lib/MonitorIcon';
	import MoonIcon from 'phosphor-svelte/lib/MoonIcon';
	import QueueIcon from 'phosphor-svelte/lib/QueueIcon';
	import SignInIcon from 'phosphor-svelte/lib/SignInIcon';
	import SignOutIcon from 'phosphor-svelte/lib/SignOutIcon';
	import SunIcon from 'phosphor-svelte/lib/SunIcon';
	import TranslateIcon from 'phosphor-svelte/lib/TranslateIcon';
	import UserCircleIcon from 'phosphor-svelte/lib/UserCircleIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';

	let { data } = $props();

	let theme = $state<Theme>('system');
	onMount(() => {
		theme = getTheme();
	});

	const health = $derived(data.health);
	const storageOk = $derived(health.storage.originals && health.storage.derivatives);
	const queue = $derived(health.queue);

	const checks = $derived([
		{ label: m.healthDatabase(), ok: health.database, icon: DatabaseIcon, detail: undefined },
		{ label: m.healthStorage(), ok: storageOk, icon: CloudIcon, detail: undefined },
		{
			label: m.healthQueue(),
			ok: queue !== null,
			icon: QueueIcon,
			detail: queue
				? m.healthQueueStats({
						pending: queue.PENDING,
						running: queue.RUNNING,
						failed: queue.FAILED
					})
				: undefined
		}
	]);

	const roleLabel = $derived(
		data.isAdmin ? m.roleAdmin() : data.isTeam ? m.roleTeam() : m.roleUser()
	);

	function switchLocale(locale: Locale) {
		setLocale(locale);
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
	<section class="card bg-base-100 w-full max-w-xl shadow-xl">
		<div class="card-body gap-6">
			<header class="flex items-center gap-4">
				<span class="bg-primary/10 text-primary rounded-2xl p-3">
					<ImagesSquareIcon size={40} weight="duotone" />
				</span>
				<div>
					<h1 class="text-3xl font-bold tracking-tight">{m.appName()}</h1>
					<p class="text-base-content/70">{m.tagline()}</p>
				</div>
			</header>

			<div class="alert alert-info alert-soft text-sm">
				<MonitorIcon size={20} weight="duotone" />
				<span>{m.backboneNotice()}</span>
			</div>

			<div>
				<h2 class="mb-2 text-sm font-semibold tracking-wide uppercase opacity-60">
					{m.healthTitle()}
				</h2>
				<ul class="divide-base-200 divide-y">
					{#each checks as check (check.label)}
						<li class="flex items-center gap-3 py-2">
							<check.icon size={24} weight="duotone" class="opacity-70" />
							<div class="flex-1">
								<div class="font-medium">{check.label}</div>
								{#if check.detail}
									<div class="text-xs opacity-60">{check.detail}</div>
								{/if}
							</div>
							{#if check.ok}
								<span class="badge badge-success badge-soft gap-1">
									<CheckCircleIcon size={14} weight="fill" />
									{m.healthOk()}
								</span>
							{:else}
								<span class="badge badge-error badge-soft gap-1">
									<XCircleIcon size={14} weight="fill" />
									{m.healthFailing()}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex items-center justify-between gap-3">
				{#if data.user}
					<div class="flex items-center gap-3">
						<UserCircleIcon size={32} weight="duotone" class="text-primary" />
						<div>
							<div class="font-medium">{data.user.given_name} {data.user.family_name}</div>
							<div class="text-xs opacity-60">
								{data.user.email} · <span class="badge badge-xs badge-primary">{roleLabel}</span>
							</div>
						</div>
					</div>
					<a class="btn btn-ghost btn-sm" href={resolve('/logout')} data-sveltekit-reload>
						<SignOutIcon size={18} weight="duotone" />
						{m.logout()}
					</a>
				{:else}
					<p class="text-sm opacity-70">{m.notLoggedIn()}</p>
					<a class="btn btn-primary btn-sm" href={resolve('/login')} data-sveltekit-reload>
						<SignInIcon size={18} weight="duotone" />
						{m.login()}
					</a>
				{/if}
			</div>
		</div>
	</section>

	<footer class="flex items-center gap-2 text-sm">
		<div class="join">
			{#each locales as locale (locale)}
				<button
					class="btn btn-xs join-item"
					class:btn-active={getLocale() === locale}
					onclick={() => switchLocale(locale)}
					aria-label={m.language()}
				>
					{locale.toUpperCase()}
				</button>
			{/each}
		</div>
		<TranslateIcon size={16} weight="duotone" class="opacity-50" />
		<span class="opacity-30">·</span>
		<button
			class="btn btn-ghost btn-xs gap-1"
			onclick={() => (theme = toggleTheme())}
			title={m.theme()}
		>
			{#if theme === 'dark'}
				<MoonIcon size={16} weight="duotone" />
			{:else if theme === 'light'}
				<SunIcon size={16} weight="duotone" />
			{:else}
				<MonitorIcon size={16} weight="duotone" />
			{/if}
			{theme}
		</button>
		{#if health.version}
			<span class="opacity-30">·</span>
			<span class="opacity-50">{health.version}</span>
		{/if}
	</footer>
</main>
