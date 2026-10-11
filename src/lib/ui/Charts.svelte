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

	/** The stack, in people. */
	function stack(h: RegionHistory): Band[] {
		return BANDS.map((b) => ({ ...b, values: Array.from(h.series[b.key]) })) as Band[];
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
			bands: stack(h)
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

	/** Charts' usual widths, and the gap between them. */
	const WIDE = 240;
	const NARROW = 170;
	/** Below this an age chart's band names ("15-64") run into each other. */
	const MIN_NARROW = 140;
	const GAP = 14;
	let rowWidth = $state(0);
	/**
	 * Every chart the row can hold this run, including a death-by-age chart per city before anyone
	 * has died (held hidden), so the charts keep one size all run and the map never moves.
	 */
	const wideCount = $derived(perRegion.length + (perRegion.length > 1 ? 1 : 0) + (hospitalsOn ? 1 : 0));
	const narrowCount = $derived(telemetry.regions.length);
	/** On a narrow row every chart shrinks alike, the age charts no further than MIN_NARROW. */
	const fit = $derived.by(() => {
		const room = rowWidth - GAP * (wideCount + narrowCount - 1);
		const total = WIDE * wideCount + NARROW * narrowCount;
		if (rowWidth <= 0 || room >= total) return { wide: WIDE, narrow: NARROW };
		const narrow = Math.max(MIN_NARROW, Math.floor((NARROW * room) / total));
		return { wide: Math.floor((room - narrow * narrowCount) / Math.max(1, wideCount)), narrow };
	});
	const wide = $derived(fit.wide);
	/** Charts narrower than usual get shorter one-line captions (the full title shows on hover). */
	const narrowRow = $derived(fit.wide < WIDE);
	const narrow = $derived(fit.narrow);
</script>

<div class="charts">
	<div class="row" bind:clientWidth={rowWidth} style:gap="10px {GAP}px">
		{#each perRegion as p (p.id)}
			<StackedAreaChart
				title="{p.name}: who has caught it so far"
				caption={narrowRow ? `${p.name}: caught it` : undefined}
				days={p.days}
				bands={p.bands}
				max={p.max}
				width={wide}
			/>
		{/each}
		{#if perRegion.length > 1}
			<LineChart
				title="Ill right now, in each city"
				caption={narrowRow ? 'Ill now, each city' : undefined}
				days={perRegion[0].days}
				lines={illLines}
				width={wide}
			/>
		{/if}
		{#if hospitalsOn && perRegion.length > 0}
			<LineChart
				title="Hospital beds in use, in each city"
				caption={narrowRow ? 'Beds in use, each city' : undefined}
				days={perRegion[0].days}
				lines={pressureLines}
				yLabel="% of beds"
				unit="%"
				width={wide}
				references={[
					{
						label: `${threshold}%: ${mortalityBasis === 'era' ? 'under pressure' : 'strain starts'}`,
						value: threshold,
						labelStart: true
					},
					{ label: '100%: full', value: 100 }
				]}
				combinedLabel="{threshold}% {mortalityBasis === 'era' ? 'under pressure' : 'strain'} · 100% full"
				shortLabel="{threshold}% {mortalityBasis === 'era' ? 'pressure' : 'strain'} · 100% full"
			/>
		{/if}
		<!-- Held in place, hidden, until someone dies, so the row's height never changes mid-run. -->
		{#each telemetry.regions as r (r.id)}
			{@const shown = r.deaths > 0}
			<div class="slot" class:waiting={!shown} aria-hidden={!shown}>
				<AgeBarsChart
					title="{r.name}: who died, by age"
					caption="{r.name}: who died"
					values={r.deathsByAge}
					asShares
					width={narrow}
				/>
			</div>
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
		overflow-x: auto;
		padding-top: 2px;
	}
	.waiting {
		visibility: hidden;
	}
</style>
