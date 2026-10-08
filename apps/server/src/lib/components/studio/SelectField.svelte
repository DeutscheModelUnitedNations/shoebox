<script lang="ts" generics="T extends string | number">
	interface Props {
		legend: string;
		value: T;
		/** Value and label pairs */
		options: [T, string][];
	}

	let { legend, value = $bindable(), options }: Props = $props();
</script>

<label class="fieldset">
	<span class="fieldset-legend">{legend}</span>
	<select class="select w-full" bind:value>
		{#each options as [optionValue, text] (optionValue)}
			<option value={optionValue}>{text}</option>
		{/each}
	</select>
</label>
