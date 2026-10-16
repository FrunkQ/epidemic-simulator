<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The chart's full title, shown on hover whenever a shorter wording is used. */
		title: string;
		/**
		 * Wordings to try in order, longest first: the first that fits the line is shown, each measured
		 * in the font actually used (again once web fonts load). The last is shown cut with an ellipsis
		 * if even it doesn't fit. An empty list shows only the controls. It fills the chart's
		 * `figcaption class="chart-caption"`.
		 */
		wordings: string[];
		/** Controls at the end of the line, such as a view switch. */
		controls?: Snippet;
	}
	let { title, wordings, controls }: Props = $props();

	let room = $state(0);
	let measuring: (HTMLSpanElement | undefined)[] = $state([]);
	let widths: number[] = $state([]);
	const measure = () => (widths = measuring.map((el) => el?.offsetWidth ?? Infinity));
	$effect(() => {
		void wordings;
		measure();
		document.fonts?.ready.then(measure);
	});
	const shown = $derived(
		wordings.find((t, k) => room > 0 && (widths[k] ?? Infinity) <= room) ?? wordings[wordings.length - 1]
	);
</script>

<span class="text" bind:clientWidth={room} title={shown !== title ? title : undefined}>{shown ?? ''}</span
>{@render controls?.()}
{#each wordings as t, k (t)}
	<span class="measure" bind:this={measuring[k]} aria-hidden="true">{t}</span>
{/each}

<style>
	/* The chart's figcaption, which holds this. */
	:global(figcaption.chart-caption) {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		/* One line always, so the row keeps its height. */
		height: 15px;
		margin-bottom: 2px;
		color: #e6edf5;
	}
	.text {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.measure {
		position: absolute;
		visibility: hidden;
		white-space: nowrap;
		left: 0;
		top: 0;
	}
</style>
