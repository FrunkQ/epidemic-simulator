<script lang="ts">
	import { COLOURS } from '../sim/render';
	import type { RegionHistory, Telemetry } from '../sim/types';

	interface Props {
		telemetry: Telemetry;
		/** Daily history per region, refreshed by the page when telemetry.historyVersion changes. */
		history: RegionHistory[];
	}
	let { telemetry, history }: Props = $props();

	const SERIES = [
		{ key: 'infected', label: 'Infected now', colour: COLOURS.symptomatic },
		{ key: 'recovered', label: 'Recovered', colour: COLOURS.recovered },
		{ key: 'deceased', label: 'Died', colour: COLOURS.deceased }
	] as const;
	type Key = (typeof SERIES)[number]['key'];

	const W = 220;
	const H = 64;
	const PAD = 2;

	let canvases: HTMLCanvasElement[] = $state([]);
	let hover: { region: number; index: number } | null = $state(null);

	function seriesOf(region: number): { days: number[]; values: Record<Key, number[]>; max: number } {
		const h = history[region];
		const symptomatic = h.series.symptomatic;
		const infected = Array.from(h.series.silent, (v, i) => v + symptomatic[i]);
		const values = {
			infected,
			recovered: Array.from(h.series.recovered),
			deceased: Array.from(h.series.deceased)
		};
		const dots = telemetry.regions[region].dots;
		return { days: Array.from(h.days), values, max: Math.max(1, dots) };
	}

	$effect(() => {
		const dpr = window.devicePixelRatio || 1;
		history.forEach((_, r) => {
			const c = canvases[r];
			if (!c || !history[r]) return;
			c.width = W * dpr;
			c.height = H * dpr;
			const ctx = c.getContext('2d')!;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W, H);
			const { days, values, max } = seriesOf(r);
			// Baseline.
			ctx.strokeStyle = 'rgba(160,180,210,0.25)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, H - PAD + 0.5);
			ctx.lineTo(W, H - PAD + 0.5);
			ctx.stroke();
			if (days.length < 2) return;
			const span = Math.max(30, days[days.length - 1] - days[0]);
			const xs = (d: number) => ((d - days[0]) / span) * (W - 2 * PAD) + PAD;
			const ys = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
			for (const s of SERIES) {
				ctx.strokeStyle = s.colour;
				ctx.lineWidth = 2;
				ctx.lineJoin = 'round';
				ctx.beginPath();
				values[s.key].forEach((v, i) =>
					i === 0 ? ctx.moveTo(xs(days[i]), ys(v)) : ctx.lineTo(xs(days[i]), ys(v))
				);
				ctx.stroke();
			}
			if (hover && hover.region === r && hover.index < days.length) {
				const x = xs(days[hover.index]);
				ctx.strokeStyle = 'rgba(230,237,245,0.5)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(x + 0.5, 0);
				ctx.lineTo(x + 0.5, H);
				ctx.stroke();
			}
		});
	});

	function onmove(e: PointerEvent, r: number) {
		const { days } = seriesOf(r);
		if (days.length < 2) return;
		const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
		const span = Math.max(30, days[days.length - 1] - days[0]);
		const day = days[0] + ((e.clientX - rect.left - PAD) / (W - 2 * PAD)) * span;
		let best = 0;
		for (let i = 1; i < days.length; i++) if (Math.abs(days[i] - day) < Math.abs(days[best] - day)) best = i;
		hover = { region: r, index: best };
	}

	const people = (dots: number) => (dots * telemetry.peoplePerDot).toLocaleString();
</script>

<div class="charts">
	<div class="key">
		{#each SERIES as s (s.key)}
			<span><i style:background={s.colour}></i>{s.label}</span>
		{/each}
		<span class="note">Share of each population, by day</span>
	</div>
	<div class="row">
		{#each telemetry.regions as region, r (region.id)}
			<figure>
				<figcaption>{region.name}</figcaption>
				<canvas
					bind:this={canvases[r]}
					style:width="{W}px"
					style:height="{H}px"
					onpointermove={(e) => onmove(e, r)}
					onpointerleave={() => (hover = null)}
					aria-label="Chart of infections, recoveries and deaths in {region.name}"
				></canvas>
				{#if hover && hover.region === r}
					{@const s = seriesOf(r)}
					<div class="tip">
						<b>Day {s.days[hover.index]}</b>
						{#each SERIES as series (series.key)}
							<span
								><i style:background={series.colour}></i>{series.label}: {people(
									s.values[series.key][hover.index] ?? 0
								)}</span
							>
						{/each}
					</div>
				{/if}
			</figure>
		{/each}
	</div>
</div>

<style>
	.charts {
		font-size: 12px;
		color: #c7d4e2;
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-bottom: 4px;
	}
	.note {
		color: #9fb3c8;
	}
	i {
		display: inline-block;
		width: 9px;
		height: 3px;
		border-radius: 2px;
		margin-right: 6px;
		vertical-align: middle;
	}
	.row {
		display: flex;
		gap: 10px 16px;
		overflow-x: auto;
	}
	figure {
		position: relative;
		margin: 0;
	}
	figcaption {
		margin-bottom: 2px;
		color: #e6edf5;
	}
	canvas {
		display: block;
		cursor: crosshair;
	}
	.tip {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 0;
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
	}
</style>
