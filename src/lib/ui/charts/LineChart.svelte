<script lang="ts">
	import Caption from './Caption.svelte';
	import { about } from '../harmText';
	import type { Snippet } from 'svelte';
	import {
		MARGIN,
		nearest,
		niceMax,
		percentReading,
		short,
		wordings,
		type Line,
		type Reference
	} from './scale';

	interface Props {
		/** Plain words saying what the chart shows. */
		title: string;
		/** A shorter title for a narrow chart; the full title then shows on hover. Empty: controls only. */
		caption?: string;
		/** A shorter wording still, used when the caption doesn't fit the chart's width. */
		brief?: string;
		/** Start from this wording (1: the shorter one), so a row of charts can shorten together. */
		from?: number;
		/** Whether the first wording fits, whatever `from` is. */
		firstFits?: boolean;
		/** Controls at the end of the header line, such as a view switch, kept within the chart's width. */
		controls?: Snippet;
		days: readonly number[];
		lines: Line[];
		/** Labelled horizontal lines, e.g. hospital capacity. */
		references?: Reference[];
		/**
		 * One label for all the references, shown instead of theirs when they would crowd each other or
		 * the day axis, or are too wide. `shortLabel` is used when even that is too wide, and the
		 * references' values alone when both are.
		 */
		combinedLabel?: string;
		shortLabel?: string;
		/** Top of the y axis; defaults to the highest value or reference. Rounded up to a nice number. */
		max?: number;
		yLabel?: string;
		/** '%' for a chart in percent: ticks and values then read "5,000%", never like a count. */
		unit?: '%';
		width?: number;
		height?: number;
		/**
		 * Days something began (a lockdown): each is marked on the plot, and the lines start afresh
		 * there rather than joining the day before. `startLabel` names the mark in the key.
		 */
		starts?: readonly number[];
		startLabel?: string;
		/** Show the hover readout under the chart rather than over the plot (charts in a card). */
		tipBelow?: boolean;
		/** No key under the chart, for a single line its caption already names. */
		keyless?: boolean;
	}
	let {
		title,
		caption,
		brief,
		from = 0,
		firstFits = $bindable(),
		controls,
		days,
		lines,
		references = [],
		combinedLabel,
		shortLabel,
		max,
		yLabel = 'People',
		unit,
		width = 240,
		height = 110,
		starts = [],
		startLabel,
		tipBelow = false,
		keyless = false
	}: Props = $props();

	const plotW = $derived(width - MARGIN.left - MARGIN.right);
	const plotH = $derived(height - MARGIN.top - MARGIN.bottom);
	const top = $derived(
		niceMax(
			max ??
				Math.max(
					1,
					...lines.flatMap((l) => l.values.filter(Number.isFinite)),
					...references.map((r) => r.value)
				)
		)
	);
	const value = (v: number) => (unit === '%' ? `${Math.round(v).toLocaleString()}%` : short(v));
	/** A label needs this much height (px): references closer together, or to the day axis, are crowded. */
	const LABEL_ROOM = 12;
	/**
	 * Every label this chart might show, drawn hidden so each is measured in the font actually used
	 * (a wider fallback font can't overrun). Until they are measured, a generous estimate per
	 * character stands in.
	 */
	const candidates = $derived([
		...new Set(
			[
				...references.map((r) => r.label),
				combinedLabel,
				shortLabel,
				references.map((r) => value(r.value)).join(' · ')
			].filter((t): t is string => !!t)
		)
	]);
	let measuring: (SVGTextElement | undefined)[] = $state([]);
	let widths: Record<string, number> = $state({});
	$effect(() => {
		const next: Record<string, number> = {};
		candidates.forEach((t, k) => {
			const el = measuring[k];
			if (el) next[t] = el.getComputedTextLength();
		});
		widths = next;
	});
	const CHAR_W = 6;
	const textWidth = (text: string) => widths[text] ?? text.length * CHAR_W;
	const fits = (text: string) => textWidth(text) <= plotW - 4;
	/** Above its line, unless that would leave the plot's top: then below it. */
	const labelY = (y: number) => (y - MARGIN.top < LABEL_ROOM ? y + 10 : y - 3);
	/** Where a reference's own label sits: its baseline and its left and right edges. */
	const labelBox = (r: Reference) => {
		const w = textWidth(r.label);
		const x0 = r.labelStart ? MARGIN.left + 2 : MARGIN.left + plotW - w;
		return { x0, x1: x0 + w, y: r.labelStart ? ys(r.value) + 10 : labelY(ys(r.value)) };
	};
	const crowded = $derived.by(() => {
		if (!combinedLabel) return false;
		const boxes = references.map(labelBox);
		// Two labels whose boxes (a 10px line, with a little room) meet, or one too wide or too low.
		return (
			boxes.some((p, k) =>
				boxes.some((q, j) => j > k && p.x0 < q.x1 && q.x0 < p.x1 && Math.abs(p.y - q.y) < LABEL_ROOM + 2)
			) ||
			boxes.some((p) => p.y > MARGIN.top + plotH - 2) ||
			references.some((r) => !fits(r.label))
		);
	});
	/**
	 * The one label shown when the references' own labels are crowded: the first that fits, ending
	 * with just their values ("85% · 100%"), which fits any chart.
	 */
	const combined = $derived(
		[combinedLabel, shortLabel, references.map((r) => value(r.value)).join(' · ')].find(
			(t): t is string => t !== undefined && fits(t)
		)
	);
	const highest = $derived(Math.max(...references.map((r) => r.value)));
	const first = $derived(days[0] ?? 0);
	const span = $derived(Math.max(30, (days[days.length - 1] ?? 0) - first));
	const xs = (d: number) => MARGIN.left + ((d - first) / span) * plotW;
	const ys = (v: number) => MARGIN.top + plotH - (Math.min(v, top) / top) * plotH;
	/**
	 * A line's runs of points: a missing value (NaN, such as before a city's first lockdown) leaves a
	 * gap, and so does each of `starts`, so a new lockdown's line never joins the last one's.
	 */
	const segments = (values: readonly number[]) => {
		const runs: string[][] = [];
		let run: string[] = [];
		days.forEach((d, i) => {
			const v = values[i] ?? 0;
			if (!Number.isFinite(v) || (starts.includes(d) && run.length > 0)) {
				if (run.length > 0) runs.push(run);
				run = [];
				if (!Number.isFinite(v)) return;
			}
			run.push(`${xs(d).toFixed(1)},${ys(v).toFixed(1)}`);
		});
		if (run.length > 0) runs.push(run);
		return runs.map((r) => r.join(' '));
	};

	let hover: number | null = $state(null);
	function onmove(e: PointerEvent) {
		if (days.length < 2) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const day = first + ((e.clientX - rect.left - MARGIN.left) / plotW) * span;
		hover = nearest(days, day);
	}
</script>

<figure style:width="{width}px">
	<figcaption class="chart-caption">
		<Caption {title} wordings={wordings(title, caption, brief)} {from} bind:firstFits {controls} />
	</figcaption>
	<svg
		{width}
		{height}
		role="img"
		aria-label={title}
		onpointermove={onmove}
		onpointerleave={() => (hover = null)}
	>
		<line
			class="axis"
			x1={MARGIN.left}
			y1={MARGIN.top + plotH}
			x2={MARGIN.left + plotW}
			y2={MARGIN.top + plotH}
		/>
		<line class="grid" x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left + plotW} y2={MARGIN.top} />
		<text class="tick" x={MARGIN.left - 4} y={MARGIN.top + 4} text-anchor="end">{value(top)}</text>
		<text class="tick" x={MARGIN.left - 4} y={MARGIN.top + plotH} text-anchor="end">0</text>
		<text
			x={8}
			y={MARGIN.top + plotH / 2}
			transform="rotate(-90 8 {MARGIN.top + plotH / 2})"
			text-anchor="middle">{yLabel}</text
		>
		<text x={MARGIN.left} y={height - 8} text-anchor="start">{first}</text>
		<text x={MARGIN.left + plotW} y={height - 8} text-anchor="end">{first + span}</text>
		<text x={MARGIN.left + plotW / 2} y={height - 8} text-anchor="middle">Day</text>
		{#each references as r (r.label)}
			<line class="reference" x1={MARGIN.left} y1={ys(r.value)} x2={MARGIN.left + plotW} y2={ys(r.value)} />
		{/each}
		{#each starts as d (d)}
			<line class="start" x1={xs(d)} y1={MARGIN.top} x2={xs(d)} y2={MARGIN.top + plotH} />
		{/each}
		{#each lines as l (l.key)}
			{#each segments(l.values) as pts, k (k)}
				<polyline points={pts} stroke={l.colour} stroke-dasharray={l.dash} />
			{/each}
		{/each}
		{#each candidates as t, k (t)}
			<text class="reference-label measure" bind:this={measuring[k]} aria-hidden="true">{t}</text>
		{/each}
		<!-- Labels after the lines, with a halo, so no line runs through the text. -->
		{#if !crowded}
			{#each references as r (r.label)}
				<text
					class="reference-label"
					x={r.labelStart ? MARGIN.left + 2 : MARGIN.left + plotW}
					y={labelBox(r).y}
					text-anchor={r.labelStart ? 'start' : 'end'}>{r.label}</text
				>
			{/each}
		{:else if combined}
			<!-- By the highest line, from the plot's right edge, and only when it fits the plot; a
				shortened label gives the full wording on hover. -->
			<text class="reference-label" x={MARGIN.left + plotW} y={labelY(ys(highest))} text-anchor="end"
				>{#if combined !== combinedLabel}<title>{combinedLabel}</title>{/if}{combined}</text
			>
		{/if}
		{#if hover !== null}
			<line class="cross" x1={xs(days[hover])} y1={MARGIN.top} x2={xs(days[hover])} y2={MARGIN.top + plotH} />
		{/if}
	</svg>
	<!-- Room for two lines when there are several, so the key wrapping as other charts arrive doesn't resize the map. -->
	{#if !keyless}<div class="key" class:several={lines.length > 2}>
			{#each lines as l (l.key)}
				<span
					><svg width="18" height="6" aria-hidden="true"
						><line x1="0" y1="3" x2="18" y2="3" stroke={l.colour} stroke-dasharray={l.dash} /></svg
					>{l.label}</span
				>
			{/each}
			{#if startLabel && starts.length > 0}
				<span
					><svg width="18" height="6" aria-hidden="true"
						><line class="start" x1="9" y1="0" x2="9" y2="6" /></svg
					>{startLabel}</span
				>
			{/if}
		</div>{/if}
	{#if hover !== null}
		<div class="tip" class:below={tipBelow} role="status">
			<b>Day {days[hover]}</b>
			{#each lines as l (l.key)}
				<span
					>{l.label}: {!Number.isFinite(l.values[hover] ?? 0)
						? 'not yet'
						: unit === '%'
							? percentReading(l.values[hover] ?? 0)
							: about(l.values[hover] ?? 0)}</span
				>
			{/each}
		</div>
	{/if}
</figure>

<style>
	figure {
		position: relative;
		margin: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	figure > svg {
		cursor: crosshair;
	}
	polyline {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.axis {
		stroke: rgba(160, 180, 210, 0.45);
	}
	.grid {
		stroke: rgba(160, 180, 210, 0.15);
	}
	.reference {
		stroke: #e6edf5;
		stroke-dasharray: 2 3;
	}
	.start {
		stroke: #e6edf5;
		stroke-width: 1;
		stroke-dasharray: 1 2;
	}
	.cross {
		stroke: rgba(230, 237, 245, 0.6);
	}
	text {
		fill: #9fb3c8;
		font-size: 10px;
	}
	.measure {
		visibility: hidden;
	}
	.reference-label {
		fill: #e6edf5;
		/* A halo in the panel's colour, so lines crossing the label don't run through the text. */
		paint-order: stroke;
		stroke: #11233a;
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 10px;
		margin-top: 2px;
		line-height: 15px;
		color: #c7d4e2;
	}
	.key.several {
		min-height: 32px;
	}
	.key svg {
		display: inline-block;
		margin-right: 4px;
		vertical-align: middle;
	}
	.key line {
		stroke-width: 2;
	}
	.tip {
		position: absolute;
		/* Inside the chart: the chart row scrolls sideways, which would clip anything above it. */
		top: 18px;
		right: 10px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 8px;
		background: #0b1a2e;
		border: 1px solid #2a4562;
		border-radius: 6px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 3;
		color: #e6edf5;
	}
	/* Under the plot, over the key and what follows, so it never covers the lines it reads out. */
	.tip.below {
		top: 100%;
		left: 0;
		right: auto;
		white-space: normal;
	}
</style>
