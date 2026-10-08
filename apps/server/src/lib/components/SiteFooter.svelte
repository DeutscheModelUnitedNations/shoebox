<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';
	import { getTheme, toggleTheme, type Theme } from '$lib/utils/theme.svelte';
	import MonitorIcon from 'phosphor-svelte/lib/MonitorIcon';
	import MoonIcon from 'phosphor-svelte/lib/MoonIcon';
	import SunIcon from 'phosphor-svelte/lib/SunIcon';
	import { onMount } from 'svelte';
	import Logo from './Logo.svelte';

	let { loggedIn }: { loggedIn: boolean } = $props();

	let theme = $state<Theme>('system');
	onMount(() => {
		theme = getTheme();
	});
</script>

<!-- Always the dark ground, so the footer carries the dark theme itself -->
<footer data-theme="dark" class="bg-base-100 text-base-content border-base-300 border-t">
	<div class="mx-auto flex max-w-7xl flex-col gap-12 px-5 pt-16 pb-10 lg:px-12">
		<div class="grid gap-10 md:grid-cols-3 md:gap-12">
			<Logo variant="full" onDark class="-mt-6 -ml-4 h-28" />
			<nav class="flex flex-col gap-3">
				<a href={resolve('/')} class="link link-hover">{m.home()}</a>
				<a href={resolve('/usage')} class="link link-hover">{m.usage()}</a>
				{#if loggedIn}
					<a href={resolve('/logout')} class="link link-hover" data-sveltekit-reload>
						{m.logout()}
					</a>
				{:else}
					<a href={resolve('/login')} class="link link-hover" data-sveltekit-reload>{m.login()}</a>
				{/if}
			</nav>
			<p class="leading-snug">{m.footerCopyright()}</p>
		</div>

		<div
			class="border-base-content/20 flex flex-col gap-4 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-base-content/70">
				Deutsche Model United Nations e. V. |
				<a href="https://dmun.de/legal#imprint" class="link link-hover">{m.imprint()}</a> |
				<a href="https://dmun.de/legal#privacy" class="link link-hover">{m.privacy()}</a>
			</p>
			<div class="flex items-center gap-2">
				<div class="join" role="radiogroup" aria-label={m.language()}>
					{#each locales as locale (locale)}
						<input
							type="radio"
							name="locale"
							class="btn btn-xs join-item"
							aria-label={locale.toUpperCase()}
							checked={getLocale() === locale}
							onchange={() => setLocale(locale)}
						/>
					{/each}
				</div>
				<button
					class="btn btn-xs btn-square"
					onclick={() => (theme = toggleTheme())}
					title={m.theme()}
					aria-label={m.theme()}
				>
					{#if theme === 'dark'}
						<MoonIcon size={16} weight="duotone" />
					{:else if theme === 'light'}
						<SunIcon size={16} weight="duotone" />
					{:else}
						<MonitorIcon size={16} weight="duotone" />
					{/if}
				</button>
			</div>
		</div>
	</div>
</footer>
