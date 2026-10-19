<script lang="ts">
	import { DOT_COUNTS } from '../config/dotCounts';
	import { COLOURS, DIMMED_COLOURS } from '../sim/render';
	import { MAP_LOOKS, type MapLook } from '../sim/specks';

	interface Props {
		peoplePerDot: number;
		/** A disease with no vaccine has nobody vaccinated. */
		hasVaccine: boolean;
		/** Diseases whose vaccine is one dose have no "partly vaccinated". */
		hasPartialCourse: boolean;
		/** The map view (specks.ts); the switch here sets it. */
		look: MapLook;
	}
	let { peoplePerDot, hasVaccine, hasPartialCourse, look = $bindable() }: Props = $props();

	const LOOK_LABELS: Record<MapLook, string> = { specks: 'Specks', shading: 'Shading' };

	// Each swatch as the map draws it in each view: a round dot, or a small square speck.
	const items = $derived(
		[
			{ key: 'unprotected', label: 'Not protected', colour: DIMMED_COLOURS.unprotected, speck: false },
			{ key: 'full', label: 'Fully vaccinated', colour: DIMMED_COLOURS.full, speck: false },
			{ key: 'partial', label: 'Partly vaccinated', colour: DIMMED_COLOURS.partial, speck: false },
			{ key: 'silent', label: 'Infected, no symptoms yet', colour: COLOURS.silent, speck: look === 'specks' },
			{ key: 'symptomatic', label: 'Ill', colour: COLOURS.symptomatic, speck: look === 'specks' },
			{ key: 'recovered', label: 'Recovered', colour: DIMMED_COLOURS.recovered, speck: false },
			{ key: 'deceased', label: 'Died', colour: DIMMED_COLOURS.deceased, speck: look === 'specks' }
		].filter(
			(item) =>
				(hasVaccine || item.key !== 'full') &&
				(hasVaccine && hasPartialCourse ? true : item.key !== 'partial')
		)
	);
</script>

<div class="legend">
	<span class="switch" role="group" aria-label="Map view">
		<span class="name" aria-hidden="true">Map view</span>
		{#each MAP_LOOKS as v (v)}
			<button type="button" aria-pressed={look === v} onclick={() => (look = v)}>{LOOK_LABELS[v]}</button>
		{/each}
	</span>
	<span class="items" role="list" aria-label="What the colours mean">
		{#each items as item (item.key)}
			<span role="listitem"><i class:speck={item.speck} style:background={item.colour}></i>{item.label}</span>
		{/each}
	</span>
	<!-- Both views' lines sit in one cell, the other hidden, so switching never changes the legend's
	height and moves the map. -->
	<span class="scale">
		{#each MAP_LOOKS as v (v)}
			<span class:off={v !== look} aria-hidden={v !== look}
				>Each dot stands for {peoplePerDot.toLocaleString()}
				{peoplePerDot === 1
					? 'person'
					: 'people'}.{#if peoplePerDot > 1}{` ${DOT_COUNTS[v]} Every count is real people.`}{/if}</span
			>
		{/each}
	</span>
	<span class="routes"><b class="road"></b>Road <b class="ferry"></b>Ferry <b class="air"></b>Flight</span>
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
		font-size: 12px;
		color: #c7d4e2;
	}
	.items {
		display: contents;
	}
	i {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: 6px;
	}
	/* A speck, as the map draws one person: a small bright square. */
	i.speck {
		width: 5px;
		height: 5px;
		border-radius: 0;
		margin: 0 8px 1px 2px;
		vertical-align: middle;
	}
	.switch {
		display: inline-flex;
		align-items: center;
	}
	.switch .name {
		margin-right: 6px;
		color: #9fb3c8;
	}
	.switch button {
		font: inherit;
		color: #c7d4e2;
		background: transparent;
		border: 1px solid #3c5878;
		padding: 2px 8px;
		min-height: 24px;
		cursor: pointer;
	}
	.switch button:first-of-type {
		border-radius: 4px 0 0 4px;
	}
	.switch button:last-of-type {
		border-left: none;
		border-radius: 0 4px 4px 0;
	}
	.switch button[aria-pressed='true'] {
		background: #2a4562;
		color: #e6edf5;
	}
	.switch button:focus-visible {
		outline: 2px solid #8fb8ff;
		outline-offset: 1px;
	}
	.scale {
		display: grid;
		color: #9fb3c8;
	}
	.scale > span {
		grid-area: 1 / 1;
	}
	.scale .off {
		visibility: hidden;
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
