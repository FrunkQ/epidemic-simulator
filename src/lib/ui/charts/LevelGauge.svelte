<script lang="ts">
	interface Threshold {
		/** Where the line sits, on the same scale as `value`. */
		at: number;
		label: string;
	}
	interface Props {
		/** Plain words saying what the gauge shows. */
		title: string;
		value: number;
		/** Right-hand end of the gauge. Values beyond it fill the gauge and say so. */
		max: number;
		thresholds: Threshold[];
		/** The plain-word reading, e.g. Coping / Under pressure / Overwhelmed, as the engine gives it. */
		reading: string;
		/** Set when the reading is a warning, so it gets a sign as well as words. */
		warn?: boolean;
		format: (v: number) => string;
		width?: number;
		/** Lines kept for the caption, so the gauge doesn't change height when the reading wraps. */
		lines?: number;
	}
	let {
		title,
		value,
		max,
		thresholds,
		reading,
		warn = false,
		format,
		width = 200,
		lines = 1
	}: Props = $props();

	const H = 12;
	const xs = (v: number) => (Math.min(Math.max(v, 0), max) / max) * width;
</script>

<figure>
	<figcaption style:min-height="{lines * 1.3}em">
		{title}: <b>{format(value)}</b>
		<span class="reading" class:warn>{warn ? '⚠ ' : ''}{reading}</span>
	</figcaption>
	<svg {width} height={H + 14} role="img" aria-label="{title}: {format(value)}, {reading}">
		<rect class="track" x="0" y="0" {width} height={H} rx="4" />
		<rect class="fill" x="0" y="0" width={Math.max(0, xs(value))} height={H} rx="4" />
		{#each thresholds as t, k (t.label)}
			<line x1={xs(t.at)} y1={-2} x2={xs(t.at)} y2={H + 2} />
			<!-- Close thresholds would collide, so labels sit either side of their line. -->
			<text x={xs(t.at) + (k === 0 ? -3 : 3)} y={H + 12} text-anchor={k === 0 ? 'end' : 'start'}
				>{t.label}</text
			>
		{/each}
	</svg>
</figure>

<style>
	figure {
		margin: 4px 0;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 0 6px;
		margin-bottom: 3px;
		line-height: 1.3;
		color: #e6edf5;
	}
	.reading {
		color: #c7d4e2;
	}
	.reading.warn {
		color: #ffd2dc;
		font-weight: 600;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.track {
		fill: rgba(160, 180, 210, 0.15);
	}
	.fill {
		fill: #c7d4e2;
	}
	line {
		stroke: #e6edf5;
		stroke-width: 2;
	}
	text {
		fill: #9fb3c8;
		font-size: 10px;
	}
</style>
