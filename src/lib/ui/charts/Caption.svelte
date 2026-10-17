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
		/** Start from this wording, so a row of charts can shorten together. */
		from?: number;
		/** Whether the first wording fits, whatever `from` is. */
		firstFits?: boolean;
	}
	// firstFits is bound by the chart and written in the effect below, which the linter can't follow.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-useless-assignment
	let { title, wordings, controls, from = 0, firstFits = $bindable() }: Props = $props();

	let room = $state(0);
	let measuring: (HTMLSpanElement | undefined)[] = $state([]);
	let widths: number[] = $state([]);
	const measure = () => (widths = measuring.map((el) => el?.offsetWidth ?? Infinity));
	$effect(() => {
		void wordings;
		measure();
		document.fonts?.ready.then(measure);
	});
	const fitsAt = (k: number) => room > 0 && (widths[k] ?? Infinity) <= room;
	const shown = $derived(
		wordings.find((t, k) => k >= Math.min(from, wordings.length - 1) && fitsAt(k)) ??
			wordings[wordings.length - 1]
	);
	$effect(() => {
		firstFits = wordings.length === 0 || room === 0 || fitsAt(0);
	});
</script>

<span class="text" bind:clientWidth={room} title={shown !== title ? title : undefined}>{shown ?? ''}</span
>{@render controls?.()}
<!-- Measured inside a clipped box of no size, so a long wording never makes the card scroll sideways. -->
<span class="measures" aria-hidden="true">
	{#each wordings as t, k (t)}
		<span class="measure" bind:this={measuring[k]}>{t}</span>
	{/each}
</span>

<style>
	/* The chart's figcaption, which holds this. */
	:global(figcaption.chart-caption) {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		/* One line of the chart's text always, in any font, so the row keeps its height. */
		height: 1lh;
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
	.measures {
		position: absolute;
		left: 0;
		top: 0;
		width: 0;
		height: 0;
		overflow: hidden;
		visibility: hidden;
	}
	.measure {
		position: absolute;
		white-space: nowrap;
		left: 0;
		top: 0;
	}
</style>
