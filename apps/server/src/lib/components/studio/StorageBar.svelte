<script lang="ts">
	import { formatBytes } from '$lib/gallery/format';
	import { m } from '$lib/paraglide/messages';

	interface Props {
		/** Bytes per series */
		parts: { id: string; shortName: string; bytes: number }[];
		/** Null when STORAGE_CAPACITY_GB is not configured */
		capacityBytes: number | null;
	}

	let { parts, capacityBytes }: Props = $props();

	const used = $derived(parts.reduce((sum, s) => sum + s.bytes, 0));
	const scale = $derived(capacityBytes ?? Math.max(used, 1));
	const shades = [
		'bg-base-content/80',
		'bg-base-content/55',
		'bg-base-content/35',
		'bg-base-content/20'
	];
	const shade = (i: number) => shades[i % shades.length];
</script>

<section class="flex flex-col gap-3">
	<div class="flex items-baseline justify-between gap-4">
		<h2 class="font-bold">{m.adminStorage()}</h2>
		<p class="text-sm">
			<span class="font-bold">{formatBytes(used)}</span>
			{capacityBytes
				? m.adminStorageOf({ capacity: formatBytes(capacityBytes) })
				: m.adminStorageUsed()}
		</p>
	</div>
	<div class="bg-base-300 flex h-4 w-full overflow-hidden" role="img" aria-label={m.adminStorage()}>
		{#each parts as part, i (part.id)}
			<div class={shade(i)} style:width={`${(part.bytes / scale) * 100}%`}></div>
		{/each}
	</div>
	<ul class="text-base-content/70 flex flex-wrap gap-x-8 gap-y-1 text-sm">
		{#each parts as part, i (part.id)}
			<li class="flex items-center gap-2">
				<span class={['inline-block size-3', shade(i)]}></span>
				{part.shortName} · {formatBytes(part.bytes)}
			</li>
		{/each}
		{#if capacityBytes}
			<li class="flex items-center gap-2">
				<span class="bg-base-300 inline-block size-3"></span>
				{m.adminStorageFree()} · {formatBytes(Math.max(capacityBytes - used, 0))}
			</li>
		{/if}
	</ul>
</section>
