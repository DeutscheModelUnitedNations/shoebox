<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- crumb hrefs come resolved from the page */
	import type { Snippet } from 'svelte';

	interface Props {
		/** The trail above the title, the last one being the current page */
		crumbs: { label: string; href?: string }[];
		title: string;
		/** Bold part after the title, e.g. the edition */
		emphasis?: string;
		/** Light text after the emphasis, e.g. "bearbeiten" */
		suffix?: string;
		children?: Snippet;
	}

	let { crumbs, title, emphasis, suffix, children }: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="breadcrumbs py-0 text-sm">
		<ul>
			{#each crumbs as crumb (crumb.label)}
				<li>
					{#if crumb.href}
						<a href={crumb.href} class="link-primary">{crumb.label}</a>
					{:else}
						{crumb.label}
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<h1 class="text-5xl leading-none font-extralight">
		{title}
		{#if emphasis}<span class="font-bold">{emphasis}</span>{/if}
		{suffix}
	</h1>
	{@render children?.()}
</div>
