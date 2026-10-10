<script lang="ts">
	import { MARGIN, nearest, niceMax, short, type Line, type Reference } from './scale';

	interface Props {
		/** Plain words saying what the chart shows. */
		title: string;
		days: readonly number[];
		lines: Line[];
		/** Labelled horizontal lines, e.g. hospital capacity. */
		references?: Reference[];
		/** Top of the y axis; defaults to the highest value or reference. Rounded up to a nice number. */
		max?: number;
		yLabel?: string;
		width?: number;
		height?: number;
	}
	let {
		title,
		days,
		lines,
		references = [],
		max,
		yLabel = 'People',
		width = 240,
		height = 110
	}: Props = $props();

	const plotW = $derived(width - MARGIN.left - MARGIN.right);
	const plotH = $derived(height - MARGIN.top - MARGIN.bottom);
	const top = $derived(
		niceMax(max ?? Math.max(1, ...lines.flatMap((l) => l.values), ...references.map((r) => r.value)))
	);
	const first = $derived(days[0] ?? 0);
	const span = $derived(Math.max(30, (days[days.length - 1] ?? 0) - first));
	const xs = (d: number) => MARGIN.left + ((d - first) / span) * plotW;
	const ys = (v: number) => MARGIN.top + plotH - (Math.min(v, top) / top) * plotH;
	const points = (values: readonly number[]) =>
		days.map((d, i) => `${xs(d).toFixed(1)},${ys(values[i] ?? 0).toFixed(1)}`).join(' ');

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
			<text
				class="reference-label"
				x={r.labelStart ? MARGIN.left + 2 : MARGIN.left + plotW}
				y={r.labelStart ? ys(r.value) + 10 : ys(r.value) - 3}
				text-anchor={r.labelStart ? 'start' : 'end'}>{r.label}</text
			>
		{/each}
		{#each lines as l (l.key)}
			<polyline points={points(l.values)} stroke={l.colour} stroke-dasharray={l.dash} />
		{/each}
		{#if hover !== null}
			<line class="cross" x1={xs(days[hover])} y1={MARGIN.top} x2={xs(days[hover])} y2={MARGIN.top + plotH} />
		{/if}
	</svg>
	<!-- Room for two lines when there are several, so the key wrapping as other charts arrive doesn't resize the map. -->
	<div class="key" class:several={lines.length > 2}>
		{#each lines as l (l.key)}
			<span
				><svg width="18" height="6" aria-hidden="true"
					><line x1="0" y1="3" x2="18" y2="3" stroke={l.colour} stroke-dasharray={l.dash} /></svg
				>{l.label}</span
			>
		{/each}
	</div>
	{#if hover !== null}
		<div class="tip" role="status">
			<b>Day {days[hover]}</b>
			{#each lines as l (l.key)}
				<span>{l.label}: {Math.round(l.values[hover] ?? 0).toLocaleString()}</span>
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
	.cross {
		stroke: rgba(230, 237, 245, 0.6);
	}
	text {
		fill: #9fb3c8;
		font-size: 10px;
	}
	.reference-label {
		fill: #e6edf5;
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
</style>
