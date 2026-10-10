<script lang="ts">
	import { untrack } from 'svelte';
	import { COLOURS } from '../sim/render';
	import type { MortalityBasis, RegionHistory, Telemetry } from '../sim/types';
	import { BEHAVIOUR } from '../config/behaviour';
	import AgeBarsChart from './charts/AgeBarsChart.svelte';
	import LineChart from './charts/LineChart.svelte';
	import StackedAreaChart from './charts/StackedAreaChart.svelte';
	import type { Band, Line } from './charts/scale';

	interface Props {
		telemetry: Telemetry;
		/** The care basis of the disease's death rate: strain never applies to an 'era' rate (6.6). */
		mortalityBasis: MortalityBasis;
		/** Daily history per region, refreshed by the page when telemetry.historyVersion changes. */
		history: RegionHistory[];
	}
	let { telemetry, history, mortalityBasis }: Props = $props();

	/** The stack, bottom first, in the dot colours so the map legend carries over. */
	const BANDS = [
		{ key: 'symptomatic', label: 'Ill', colour: COLOURS.symptomatic },
		{ key: 'silent', label: 'Infected, no symptoms yet', colour: COLOURS.silent },
		{ key: 'recovered', label: 'Recovered', colour: COLOURS.recovered },
		{ key: 'deceased', label: 'Died', colour: COLOURS.deceased }
	] as const;
	/** One dash pattern per city, so the lines differ without relying on colour. */
	const DASHES = [undefined, '6 3', '2 3', '8 3 2 3'];

	const people = (values: Float64Array, perDot: number) => Array.from(values, (v) => v * perDot);

	/**
	 * The stack in people. Deaths are the tally (6.6), not the dead dots, so they grow smoothly;
	 * "Recovered" is everyone who has had it and isn't counted as died, so the stack still adds up.
	 */
	function stack(h: RegionHistory, perDot: number): Band[] {
		const deaths = Array.from(h.series.deaths);
		const values = (key: (typeof BANDS)[number]['key']) => {
			if (key === 'deceased') return deaths;
			if (key === 'recovered')
				return Array.from(h.series.recovered, (v, k) =>
					Math.max(0, (v + h.series.deceased[k]) * perDot - deaths[k])
				);
			return people(h.series[key], perDot);
		};
		return BANDS.map((b) => ({ ...b, values: values(b.key) })) as Band[];
	}

	// Rebuilt only when a new day's history arrives, not on every 10 Hz snapshot: names, dots and
	// people per dot only change on a restart, which also brings new history.
	const perRegion = $derived.by(() => {
		const t = untrack(() => telemetry);
		return history.map((h, r) => ({
			name: t.regions[r]?.name ?? '',
			id: t.regions[r]?.id ?? r,
			days: Array.from(h.days),
			max: (t.regions[r]?.dots ?? 1) * t.peoplePerDot,
			bands: stack(h, t.peoplePerDot)
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
					{
						label: `${threshold}%: ${mortalityBasis === 'era' ? 'under pressure' : 'strain starts'}`,
						value: threshold,
						labelStart: true
					},
					{ label: '100%: full', value: 100 }
				]}
			/>
		{/if}
		{#each telemetry.regions as r (r.id)}
			{#if Math.round(r.deaths) > 0}
				<AgeBarsChart title="{r.name}: who died, by age" values={r.deathsByAge} asShares />
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
