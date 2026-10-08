<script lang="ts">
	import { MARGIN, nearest, niceMax, short, type Band } from './scale';

	interface Props {
		/** Plain words saying what the chart shows. */
		title: string;
		days: readonly number[];
		bands: Band[];
		/** Top of the y axis (e.g. the population); rounded up to a nice number. */
		max: number;
		yLabel?: string;
		width?: number;
		height?: number;
	}
	let { title, days, bands, max, yLabel = 'People', width = 240, height = 110 }: Props = $props();

	const plotW = $derived(width - MARGIN.left - MARGIN.right);
	const plotH = $derived(height - MARGIN.top - MARGIN.bottom);
	const top = $derived(niceMax(max));
	const first = $derived(days[0] ?? 0);
	const span = $derived(Math.max(30, (days[days.length - 1] ?? 0) - first));
	const xs = (d: number) => MARGIN.left + ((d - first) / span) * plotW;
	const ys = (v: number) => MARGIN.top + plotH - (Math.min(v, top) / top) * plotH;

	/** Each band's closed outline: its upper edge left to right, then the band below right to left. */
	const paths = $derived.by(() => {
		const below = new Array(days.length).fill(0);
		return bands.map((b) => {
			const upper = days.map((_, i) => below[i] + (b.values[i] ?? 0));
			const up = days.map((d, i) => `${xs(d).toFixed(1)},${ys(upper[i]).toFixed(1)}`);
			const down = days.map((d, i) => `${xs(d).toFixed(1)},${ys(below[i]).toFixed(1)}`).reverse();
			for (let i = 0; i < days.length; i++) below[i] = upper[i];
			return { ...b, d: days.length > 1 ? `M${up.join('L')}L${down.join('L')}Z` : '' };
		});
	});

	let hover: number | null = $state(null);
	function onmove(e: PointerEvent) {
		if (days.length < 2) return;
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const day = first + ((e.clientX - rect.left - MARGIN.left) / plotW) * span;
		hover = nearest(days, day);
	}
</script>

<figure>
	<figcaption>{title}</figcaption>
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
		<text class="tick" x={MARGIN.left - 4} y={MARGIN.top + 4} text-anchor="end">{short(top)}</text>
		<text class="tick" x={MARGIN.left - 4} y={MARGIN.top + plotH} text-anchor="end">0</text>
		<text
			class="axis-label"
			x={8}
			y={MARGIN.top + plotH / 2}
			transform="rotate(-90 8 {MARGIN.top + plotH / 2})"
			text-anchor="middle">{yLabel}</text
		>
		<text class="tick" x={MARGIN.left} y={height - 8} text-anchor="start">{first}</text>
		<text class="tick" x={MARGIN.left + plotW} y={height - 8} text-anchor="end">{first + span}</text>
		<text class="axis-label" x={MARGIN.left + plotW / 2} y={height - 8} text-anchor="middle">Day</text>
		{#each paths as p (p.key)}
			<path d={p.d} fill={p.colour} />
		{/each}
		{#if hover !== null}
			<line class="cross" x1={xs(days[hover])} y1={MARGIN.top} x2={xs(days[hover])} y2={MARGIN.top + plotH} />
		{/if}
	</svg>
	{#if hover !== null}
		<div class="tip" role="status">
			<b>Day {days[hover]}</b>
			{#each [...bands].reverse() as b (b.key)}
				<span
					><i style:background={b.colour}></i>{b.label}: {Math.round(
						b.values[hover] ?? 0
					).toLocaleString()}</span
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
	figcaption {
		margin-bottom: 2px;
		color: #e6edf5;
	}
	svg {
		display: block;
		cursor: crosshair;
		overflow: visible;
	}
	path {
		stroke: #0e1d30;
		stroke-width: 1;
	}
	.axis {
		stroke: rgba(160, 180, 210, 0.45);
	}
	.grid {
		stroke: rgba(160, 180, 210, 0.15);
	}
	.cross {
		stroke: rgba(230, 237, 245, 0.6);
	}
	text {
		fill: #9fb3c8;
		font-size: 10px;
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
	i {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		margin-right: 6px;
	}
</style>
