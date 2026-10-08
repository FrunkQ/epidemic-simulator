<script lang="ts">
	import { untrack } from 'svelte';
	import { COLOURS } from '../sim/render';
	import type { RegionHistory, Telemetry } from '../sim/types';
	import { BEHAVIOUR } from '../config/behaviour';
	import AgeBarsChart from './charts/AgeBarsChart.svelte';
	import LineChart from './charts/LineChart.svelte';
	import StackedAreaChart from './charts/StackedAreaChart.svelte';
	import type { Band, Line } from './charts/scale';

	interface Props {
		telemetry: Telemetry;
		/** Daily history per region, refreshed by the page when telemetry.historyVersion changes. */
		history: RegionHistory[];
	}
	let { telemetry, history }: Props = $props();

	/** The stack, bottom first, in the dot colours so the map legend carries over. */
	const BANDS = [
		{ key: 'symptomatic', label: 'Ill', colour: COLOURS.symptomatic },
		{ key: 'silent', label: 'Infected, no symptoms yet', colour: COLOURS.silent },
		{ key: 'recovered', label: 'Recovered', colour: COLOURS.recovered },
		{ key: 'deceased', label: 'Died', colour: COLOURS.deceased }
	] as const;
	/** One dash pattern per city, so the lines differ without relying on colour. */
	const DASHES = [undefined, '6 3', '2 3', '8 3 2 3'];

	const people = (values: Int32Array, perDot: number) => Array.from(values, (v) => v * perDot);

	// Rebuilt only when a new day's history arrives, not on every 10 Hz snapshot: names, dots and
	// people per dot only change on a restart, which also brings new history.
	const perRegion = $derived.by(() => {
		const t = untrack(() => telemetry);
		return history.map((h, r) => ({
			name: t.regions[r]?.name ?? '',
			id: t.regions[r]?.id ?? r,
			days: Array.from(h.days),
			max: (t.regions[r]?.dots ?? 1) * t.peoplePerDot,
			bands: BANDS.map((b) => ({ ...b, values: people(h.series[b.key], t.peoplePerDot) })) as Band[]
		}));
	});

	/**
	 * Hospital pressure per city, in percent, with the strain threshold and 100% marked (6.6). The
	 * axis grows with the data, so a badly overwhelmed city stays on the chart.
	 */
	const pressureLines = $derived(
		history.map((h, r): Line => ({
			key: String(perRegion[r]?.id ?? r),
			label: perRegion[r]?.name ?? '',
			colour: '#c7d4e2',
			dash: DASHES[r % DASHES.length],
			values: Array.from(h.series.pressure, (v) => v / 10)
		}))
	);
	const threshold = Math.round(BEHAVIOUR.strainThreshold.value * 100);
	// Pressure is 0 only when hospitals are switched off or a city has no beds (6.6).
	const hospitalsOn = $derived(telemetry.regions.some((r) => r.pressure > 0));

	const illLines = $derived(
		perRegion.map((p, r): Line => ({
			key: String(p.id),
			label: p.name,
			colour: COLOURS.symptomatic,
			dash: DASHES[r % DASHES.length],
			values: p.bands[0].values
		}))
	);
</script>

<div class="charts">
	<div class="row">
		{#each perRegion as p (p.id)}
			<StackedAreaChart
				title="{p.name}: who has caught it so far"
				days={p.days}
				bands={p.bands}
				max={p.max}
			/>
		{/each}
		{#if perRegion.length > 1}
			<LineChart title="Ill right now, in each city" days={perRegion[0].days} lines={illLines} />
		{/if}
		{#if hospitalsOn && perRegion.length > 0}
			<LineChart
				title="Hospital beds in use, in each city"
				days={perRegion[0].days}
				lines={pressureLines}
				yLabel="% of beds"
				references={[
					{ label: `${threshold}%: strain starts`, value: threshold, labelStart: true },
					{ label: '100%: full', value: 100 }
				]}
			/>
		{/if}
		{#each telemetry.regions as r (r.id)}
			{#if r.counts.deceased > 0}
				<AgeBarsChart
					title="{r.name}: who died, by age"
					values={[
						r.deathsByAge[0] * telemetry.peoplePerDot,
						r.deathsByAge[1] * telemetry.peoplePerDot,
						r.deathsByAge[2] * telemetry.peoplePerDot
					]}
					asShares
				/>
			{/if}
		{/each}
	</div>
</div>

<style>
	.charts {
		font-size: 12px;
		color: #c7d4e2;
	}
	.row {
		display: flex;
		gap: 10px 20px;
		overflow-x: auto;
		padding-top: 2px;
	}
</style>
