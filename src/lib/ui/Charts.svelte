<script lang="ts">
	import { COLOURS } from '../sim/render';
	import type { RegionHistory, Telemetry } from '../sim/types';
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

	const people = (values: Int32Array) => Array.from(values, (v) => v * telemetry.peoplePerDot);

	const perRegion = $derived(
		history.map((h, r) => ({
			name: telemetry.regions[r]?.name ?? '',
			id: telemetry.regions[r]?.id ?? r,
			days: Array.from(h.days),
			max: (telemetry.regions[r]?.dots ?? 1) * telemetry.peoplePerDot,
			bands: BANDS.map((b) => ({ ...b, values: people(h.series[b.key]) })) as Band[]
		}))
	);

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
