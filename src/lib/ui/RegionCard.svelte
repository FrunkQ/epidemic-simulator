<script lang="ts">
	import { COLOURS } from '../sim/render';
	import type { DiseaseConfig, Region, RegionTelemetry } from '../sim/types';

	interface Props {
		region: Region;
		telemetry: RegionTelemetry | undefined;
		disease: DiseaseConfig;
		peoplePerDot: number;
		/** Screen position of the card's top-left corner. */
		x: number;
		y: number;
		/** Lay the card out in a strip (small screens) instead of floating it on the map. */
		docked?: boolean;
		onvaccination: (full: number, partial: number) => void;
		onseed: () => void;
	}

	let {
		region,
		telemetry: t,
		disease,
		peoplePerDot,
		x,
		y,
		docked = false,
		onvaccination,
		onseed
	}: Props = $props();
	let open = $state(false);
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const people = (dots: number) => (dots * peoplePerDot).toLocaleString();
	const protects = (efficacy: number) => `protects about ${Math.round(efficacy * 100)} in 100`;
	let unprotected = $derived(Math.max(0, 1 - region.vaccinatedFull - region.vaccinatedPartial));
</script>

<section
	class="card"
	class:open
	class:docked
	style:left={docked ? null : `${x}px`}
	style:top={docked ? null : `${y}px`}
>
	<header>
		<h2>{region.name}</h2>
		<button class="toggle" onclick={() => (open = !open)} aria-expanded={open}>
			{open ? 'Done' : 'Vaccination'}
		</button>
	</header>
	<p class="summary">
		<i style:background={COLOURS.full}></i>{pct(region.vaccinatedFull)} fully ·
		<i style:background={COLOURS.partial}></i>{pct(region.vaccinatedPartial)} partly vaccinated
	</p>
	{#if open}
		<label>
			<span>Fully vaccinated <b>{pct(region.vaccinatedFull)}</b></span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={region.vaccinatedFull}
				onchange={(e) => onvaccination(Number(e.currentTarget.value), region.vaccinatedPartial)}
			/>
			<small>The vaccine {protects(disease.fullEfficacy.value)}.</small>
		</label>
		<label>
			<span>Partly vaccinated <b>{pct(region.vaccinatedPartial)}</b></span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={region.vaccinatedPartial}
				onchange={(e) => onvaccination(region.vaccinatedFull, Number(e.currentTarget.value))}
			/>
			<small>An unfinished course {protects(disease.partialEfficacy.value)}.</small>
		</label>
		<p class="unprotected">Not vaccinated: {pct(unprotected)}</p>
	{/if}
	{#if t}
		<p class="counts">
			<span><i style:background={COLOURS.silent}></i>{people(t.counts.silent)} spreading unaware</span>
			<span><i style:background={COLOURS.symptomatic}></i>{people(t.counts.symptomatic)} ill</span>
			<span><i style:background={COLOURS.deceased}></i>{people(t.counts.deceased)} died</span>
		</p>
	{/if}
	<button class="seed" onclick={onseed}>Bring in one infected person</button>
</section>

<style>
	.card {
		position: absolute;
		width: 230px;
		box-sizing: border-box;
		background: rgba(17, 33, 52, 0.94);
		border: 1px solid #2a4562;
		border-radius: 8px;
		padding: 8px 10px;
		font-size: 12px;
		color: #e6edf5;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}
	.card {
		width: 200px;
	}
	.card.open {
		width: 230px;
		z-index: 2;
	}
	.card.docked {
		position: static;
		flex: 0 0 200px;
		box-shadow: none;
	}
	.summary {
		margin: 0 0 4px;
		color: #c7d4e2;
	}
	.summary i {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin: 0 4px 0 2px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	h2 {
		font-size: 13px;
		margin: 0 0 4px;
	}
	label {
		display: block;
		margin: 4px 0 6px;
	}
	label span {
		display: flex;
		justify-content: space-between;
	}
	input {
		width: 100%;
		margin: 2px 0 0;
	}
	small {
		color: #9fb3c8;
	}
	.unprotected {
		margin: 0 0 6px;
		color: #9fb3c8;
	}
	button {
		font: inherit;
		color: #e6edf5;
		background: #24486e;
		border: 1px solid #3a6590;
		border-radius: 6px;
		padding: 3px 8px;
		cursor: pointer;
	}
	.seed {
		width: 100%;
		margin-top: 6px;
	}
	.toggle {
		padding: 1px 6px;
		font-size: 11px;
	}
	.counts {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin: 6px 0 0;
		color: #c7d4e2;
	}
	.counts i {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 6px;
	}
</style>
