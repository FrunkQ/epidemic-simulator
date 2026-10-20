<script lang="ts">
	import { onMount } from 'svelte';
	import { DOT_COUNTS, DOT_SHORT } from '../config/dotCounts';
	import { DIMMED_COLOURS, LIFTED_COLOURS } from '../sim/render';
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

	// One short line for the view in use; "more" opens the whole text over the map above, as the
	// header's blurb does, so the legend keeps the map's height (§3).
	let moreOpen = $state(false);
	let moreButton = $state<HTMLButtonElement>();
	let overlay = $state<HTMLDivElement>();
	const full = $derived(
		`Each dot stands for ${peoplePerDot.toLocaleString()} ${peoplePerDot === 1 ? 'person' : 'people'}.` +
			(peoplePerDot > 1 ? ` ${DOT_COUNTS[look]} Every count is real people.` : '')
	);
	onMount(() => {
		// Only a new window width closes it, as for the header's blurb.
		let windowWidth = innerWidth;
		const onresize = () => {
			if (innerWidth !== windowWidth) {
				windowWidth = innerWidth;
				moreOpen = false;
			}
		};
		const onkey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && moreOpen) {
				moreOpen = false;
				moreButton?.focus();
			}
		};
		const ondown = (e: PointerEvent) => {
			const t = e.target as Node;
			if (moreOpen && !overlay?.contains(t) && !moreButton?.contains(t)) moreOpen = false;
		};
		addEventListener('resize', onresize);
		addEventListener('keydown', onkey);
		addEventListener('pointerdown', ondown);
		return () => {
			removeEventListener('resize', onresize);
			removeEventListener('keydown', onkey);
			removeEventListener('pointerdown', ondown);
		};
	});

	// A dimmed dot is drawn close to the footer's colour, so its swatch gets an edge at 5.2:1 against
	// the footer (WCAG asks 3:1 for a graphic).
	const SWATCH_EDGE = '#7f97b0';

	// Each swatch as the map draws it in each view: a round dot, or a small square speck. In Shading
	// an infected dot is tinted toward the same colours.
	const items = $derived(
		[
			{ key: 'unprotected', label: 'Not protected', colour: DIMMED_COLOURS.unprotected, speck: false },
			{ key: 'full', label: 'Fully vaccinated', colour: DIMMED_COLOURS.full, speck: false },
			{ key: 'partial', label: 'Partly vaccinated', colour: DIMMED_COLOURS.partial, speck: false },
			{
				key: 'silent',
				label: 'Infected, no symptoms yet',
				colour: LIFTED_COLOURS.silent,
				speck: look === 'specks'
			},
			{
				key: 'symptomatic',
				label: 'Ill',
				colour: LIFTED_COLOURS.symptomatic,
				speck: look === 'specks'
			},
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
			<span role="listitem"
				><i
					class:speck={item.speck}
					style:background={item.colour}
					style:box-shadow={item.speck ? null : `0 0 0 1px ${SWATCH_EDGE}`}
				></i>{item.label}</span
			>
		{/each}
	</span>
	<span class="routes"><b class="road"></b>Road <b class="ferry"></b>Ferry <b class="air"></b>Flight</span>
	<span class="scale">
		<span aria-hidden="true"
			>Each dot stands for {peoplePerDot.toLocaleString()}
			{peoplePerDot === 1 ? 'person' : 'people'}.{#if peoplePerDot > 1}{` ${DOT_SHORT[look]}`}{/if}</span
		>
		{#if peoplePerDot > 1}
			<span class="sr-only">{full}</span>
			<button
				type="button"
				class="more"
				bind:this={moreButton}
				aria-expanded={moreOpen}
				aria-controls={moreOpen ? 'legend-full' : undefined}
				onclick={() => (moreOpen = !moreOpen)}>{moreOpen ? 'less' : 'more'}</button
			>
		{/if}
	</span>
	{#if moreOpen}
		<div class="full" id="legend-full" bind:this={overlay}>{full}</div>
	{/if}
</div>

<style>
	.legend {
		position: relative;
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
	/* The view in use stands out as the chosen speed does (TopBar.svelte). */
	.switch button[aria-pressed='true'] {
		background: #9cc3ea;
		color: #0b1a2e;
		font-weight: 600;
	}
	.switch button:focus-visible {
		outline: 2px solid #8fb8ff;
		outline-offset: 1px;
	}
	.scale {
		flex-basis: 100%;
		color: #9fb3c8;
	}
	.more {
		font: inherit;
		margin-left: 4px;
		padding: 0 2px;
		border: none;
		background: none;
		color: #9cc3ea;
		text-decoration: underline;
		cursor: pointer;
	}
	.more:focus-visible {
		outline: 2px solid #8fb8ff;
		outline-offset: 1px;
	}
	/* The whole text, over the charts above, so the map keeps its size. */
	.full {
		position: absolute;
		bottom: 100%;
		left: 0;
		z-index: 20;
		max-width: min(520px, calc(100% - 32px));
		box-sizing: border-box;
		padding: 8px 12px;
		background: #11233a;
		border: 1px solid #22405f;
		border-radius: 6px 6px 0 0;
		color: #c9d6e3;
		box-shadow: 0 -6px 16px rgb(0 0 0 / 0.4);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
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
