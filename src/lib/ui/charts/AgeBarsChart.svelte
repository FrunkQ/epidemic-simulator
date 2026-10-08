<script lang="ts">
	import { AGE_BANDS } from './ages';
	import { MARGIN, niceMax, short } from './scale';

	interface Props {
		/** Plain words saying what the chart shows. */
		title: string;
		/** One value per age band: 0-14, 15-64, 65+. People, or shares when `asShares` is set. */
		values: readonly [number, number, number];
		/** Show each band as its share of the total (e.g. who died, by age), in percent. */
		asShares?: boolean;
		yLabel?: string;
		width?: number;
		height?: number;
	}
	let { title, values, asShares = false, yLabel, width = 170, height = 110 }: Props = $props();

	const total = $derived(values[0] + values[1] + values[2]);
	const shown = $derived(
		asShares ? values.map((v) => (total > 0 ? (v / total) * 100 : 0)) : values.slice()
	);
	const top = $derived(asShares ? 100 : niceMax(Math.max(1, ...shown)));
	const plotW = $derived(width - MARGIN.left - MARGIN.right);
	const plotH = $derived(height - MARGIN.top - MARGIN.bottom);
	const slot = $derived(plotW / 3);
	const barW = $derived(Math.min(34, slot - 10));
	const ys = (v: number) => MARGIN.top + plotH - (Math.min(v, top) / top) * plotH;
	const label = (v: number) => (asShares ? `${Math.round(v)}%` : Math.round(v).toLocaleString());
	let hover: number | null = $state(null);
</script>

<figure>
	<figcaption>{title}</figcaption>
	<svg {width} {height} role="img" aria-label={title}>
		<line
			class="axis"
			x1={MARGIN.left}
			y1={MARGIN.top + plotH}
			x2={MARGIN.left + plotW}
			y2={MARGIN.top + plotH}
		/>
		<line class="grid" x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left + plotW} y2={MARGIN.top} />
		<text class="tick" x={MARGIN.left - 4} y={MARGIN.top + 4} text-anchor="end"
			>{asShares ? '100%' : short(top)}</text
		>
		<text class="tick" x={MARGIN.left - 4} y={MARGIN.top + plotH} text-anchor="end">0</text>
		<text
			x={8}
			y={MARGIN.top + plotH / 2}
			transform="rotate(-90 8 {MARGIN.top + plotH / 2})"
			text-anchor="middle">{yLabel ?? (asShares ? 'Share' : 'People')}</text
		>
		{#each AGE_BANDS as band, b (band.short)}
			{@const x = MARGIN.left + slot * b + (slot - barW) / 2}
			{@const y = ys(shown[b])}
			<!-- A wider invisible target than the bar, so hovering is easy. -->
			<rect
				class="hit"
				x={MARGIN.left + slot * b}
				y={MARGIN.top}
				width={slot}
				height={plotH}
				role="presentation"
				onpointerenter={() => (hover = b)}
				onpointerleave={() => (hover = null)}
			/>
			<path
				d="M{x},{MARGIN.top + plotH} V{y + 4} q0,-4 4,-4 H{x + barW - 4} q4,0 4,4 V{MARGIN.top + plotH} Z"
				fill={band.colour}
				opacity={shown[b] > 0 ? 1 : 0}
				pointer-events="none"
			/>
			<text class="value" x={x + barW / 2} y={y - 3} text-anchor="middle">{label(shown[b])}</text>
			<text x={x + barW / 2} y={height - 8} text-anchor="middle">{band.short}</text>
		{/each}
	</svg>
	{#if hover !== null}
		<div class="tip" role="status">
			<b>{AGE_BANDS[hover].label}</b>
			<span>{label(shown[hover])}{asShares ? ` (${Math.round(values[hover]).toLocaleString()})` : ''}</span>
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
	.hit {
		fill: transparent;
	}
	.axis {
		stroke: rgba(160, 180, 210, 0.45);
	}
	.grid {
		stroke: rgba(160, 180, 210, 0.15);
	}
	text {
		fill: #9fb3c8;
		font-size: 10px;
	}
	.value {
		fill: #e6edf5;
	}
	.tip {
		position: absolute;
		top: 18px;
		right: 4px;
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
