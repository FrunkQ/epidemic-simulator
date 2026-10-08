<script lang="ts">
	import { COLOURS } from '../sim/render';

	interface Props {
		peoplePerDot: number;
		/** Diseases whose vaccine is one dose have no "partly vaccinated". */
		hasPartialCourse: boolean;
	}
	let { peoplePerDot, hasPartialCourse }: Props = $props();

	const allItems = [
		{ colour: COLOURS.unprotected, label: 'Not protected' },
		{ colour: COLOURS.full, label: 'Fully vaccinated' },
		{ colour: COLOURS.partial, label: 'Partly vaccinated' },
		{ colour: COLOURS.silent, label: 'Infected, no symptoms yet' },
		{ colour: COLOURS.symptomatic, label: 'Ill' },
		{ colour: COLOURS.recovered, label: 'Recovered' },
		{ colour: COLOURS.deceased, label: 'Died' }
	];
	let items = $derived(
		hasPartialCourse ? allItems : allItems.filter((item) => item.colour !== COLOURS.partial)
	);
</script>

<div class="legend" role="list" aria-label="What the colours mean">
	{#each items as item (item.label)}
		<span role="listitem"><i style:background={item.colour}></i>{item.label}</span>
	{/each}
	<span class="scale">Each dot is about {peoplePerDot.toLocaleString()} people.</span>
	<span class="routes"><b class="road"></b>Road <b class="ferry"></b>Ferry <b class="air"></b>Flight</span>
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 12px;
		color: #c7d4e2;
	}
	i {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: 6px;
	}
	.scale {
		color: #9fb3c8;
	}
	.routes b {
		display: inline-block;
		width: 18px;
		height: 0;
		margin: 0 4px 3px 6px;
		vertical-align: middle;
	}
	.road {
		border-top: 2.5px solid rgba(214, 190, 140, 0.9);
	}
	.ferry {
		border-top: 2px dashed rgba(110, 200, 220, 0.9);
	}
	.air {
		border-top: 1.5px dashed rgba(170, 200, 255, 0.8);
	}
</style>
