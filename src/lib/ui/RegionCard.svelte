<script lang="ts">
	import { loadDisease } from '../config';
	import { BEHAVIOUR } from '../config/behaviour';
	import { ERA_DEATH_RATE } from '../config/careBasis';
	import { LIVE_POLICY_FIELDS, type LivePolicyKey } from '../config/healthPolicy';
	import { vaccineKey, waningWords } from '../config/vaccines';
	import { overallSevere, unvaccinatedShare, vaccineFor } from '../sim/disease';
	import { COLOURS } from '../sim/render';
	import type { DiseaseConfig, DiseaseId, PressureBand, Region, RegionTelemetry } from '../sim/types';
	import LevelGauge from './charts/LevelGauge.svelte';

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
		/** A different vaccine version was picked (restarts the run). */
		onvaccine: (key: string) => void;
		/** A health policy slider moved; applies live, without a restart. */
		onpolicy: (key: LivePolicyKey, value: number) => void;
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
		onvaccine,
		onpolicy,
		onseed
	}: Props = $props();
	/** Which settings panel is open, if any. */
	let panel: 'vaccination' | 'policy' | null = $state(null);
	let open = $derived(panel !== null);
	const toggle = (p: 'vaccination' | 'policy') => (panel = panel === p ? null : p);
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const people = (dots: number) => Math.round(dots * peoplePerDot).toLocaleString();
	const protects = (efficacy: number) => `protects about ${Math.round(efficacy * 100)} in 100`;
	const pctOf = (v: number) => `${Math.round(v * 100)}%`;
	/** The vaccine given here, as the engine uses it (the same helper, so the card can't disagree). */
	let runtime = $derived(loadDisease(disease.id as DiseaseId));
	let vaccine = $derived(vaccineFor(runtime, region.vaccine));
	/** The same vaccine's config entry, for its half-life and any card note. */
	let vaccineConfig = $derived(disease.vaccines?.find((v) => vaccineKey(v) === vaccine.key));
	/** A disease whose whole silent phase is incubation (6.1): silent dots spread nothing. */
	let incubatingOnly = $derived(runtime.latentTicks >= runtime.silentTicks && runtime.silentTicks > 0);
	/** One-dose vaccines have no "partly vaccinated". */
	let partialEfficacy = $derived(vaccine.hasPartialCourse ? vaccine.partialInfection : undefined);
	const threshold = BEHAVIOUR.strainThreshold.value;
	/** The engine's pressure band in plain words (6.6). */
	const PRESSURE_LABEL: Record<PressureBand, string> = {
		coping: 'Coping',
		'under-pressure': 'Under pressure',
		overwhelmed: 'Overwhelmed'
	};
	/** Pressure is 0 only with hospitals switched off (or no beds): then there is nothing to show. */
	let hospitalsOn = $derived(t !== undefined && t.pressure > 0);
	let unprotected = $derived(unvaccinatedShare(region.vaccinatedFull, region.vaccinatedPartial, vaccine));
	let fullOverall = $derived(overallSevere(vaccine.fullInfection, vaccine.fullSevere));
	let partialOverall = $derived(overallSevere(vaccine.partialInfection, vaccine.partialSevere));
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
		<div class="toggles">
			<button
				class="toggle"
				class:active={panel === 'vaccination'}
				onclick={() => toggle('vaccination')}
				aria-expanded={panel === 'vaccination'}>Vaccination</button
			>
			<button
				class="toggle"
				class:active={panel === 'policy'}
				onclick={() => toggle('policy')}
				aria-expanded={panel === 'policy'}>Health policy</button
			>
		</div>
	</header>
	<p class="summary">
		{#if !vaccine.exists}
			No vaccine
		{:else}
			<i style:background={COLOURS.full}></i>{pct(region.vaccinatedFull)}
			{#if partialEfficacy !== undefined}
				fully · <i style:background={COLOURS.partial}></i>{pct(region.vaccinatedPartial)} partly
			{/if}
			vaccinated
		{/if}
	</p>
	{#if panel === 'policy'}
		<p class="note">Changes apply straight away, without restarting.</p>
		{#each LIVE_POLICY_FIELDS as f (f.key)}
			{@const value = region.policy[f.key].value}
			<label>
				<span>{f.label} <b>{f.format(value)}</b></span>
				<input
					type="range"
					min={f.min}
					max={f.max}
					step={f.step}
					{value}
					onchange={(e) => onpolicy(f.key, Number(e.currentTarget.value))}
				/>
				<small>{f.explain}</small>
			</label>
		{/each}
		{#if t && hospitalsOn}
			<p class="note">
				Spare beds for outbreak patients: about <b>{people(t.capacity)}</b> of {people(t.beds)}.
			</p>
		{/if}
	{/if}
	{#if panel === 'vaccination' && !vaccine.exists}
		<p class="unprotected">No vaccine exists for this disease.</p>
	{:else if panel === 'vaccination'}
		{#if (disease.vaccines?.length ?? 0) > 1}
			<label>
				<span>Vaccine version</span>
				<select value={vaccine.key} onchange={(e) => onvaccine(e.currentTarget.value)}>
					{#each disease.vaccines ?? [] as v (vaccineKey(v))}
						<option value={vaccineKey(v)}>{v.label}</option>
					{/each}
				</select>
				<small>Changing it restarts the run.</small>
			</label>
		{/if}
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
			<small
				>The vaccine {protects(vaccine.fullInfection)} from catching it{waningWords(
					vaccineConfig?.waningDays.value ?? null
				)}. {#if vaccineConfig?.cardNote}{vaccineConfig.cardNote}{/if}
				{#if fullOverall > vaccine.fullInfection}Overall, it keeps about {Math.round(fullOverall * 100)} in 100
					out of serious illness, compared with someone unvaccinated.{/if}</small
			>
		</label>
		{#if partialEfficacy !== undefined}
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
				<small
					>{#if vaccine.partialInfectionSourced}An unfinished course {protects(partialEfficacy)} from catching it.{:else}There
						is no figure for how well an unfinished course stops people catching it, so the sim assumes none.{/if}
					{#if partialOverall > vaccine.partialInfection}Overall, it keeps about {Math.round(
							partialOverall * 100
						)}
						in 100 out of serious illness, compared with someone unvaccinated.{/if}</small
				>
			</label>
		{/if}
		<p class="unprotected">Not vaccinated: {pct(unprotected)}</p>
	{/if}
	{#if t && hospitalsOn}
		<LevelGauge
			title="Hospitals"
			value={t.pressure}
			max={1.2}
			thresholds={[
				{ at: threshold, label: pctOf(threshold) },
				{ at: 1, label: '100%' }
			]}
			reading={PRESSURE_LABEL[t.pressureBand]}
			warn={t.pressureBand !== 'coping'}
			format={pctOf}
			width={180}
		/>
		{#if disease.mortalityBasis === 'era'}
			<p class="note">{ERA_DEATH_RATE}</p>
		{/if}
	{/if}
	{#if t}
		<p class="counts">
			<span
				><i style:background={COLOURS.silent}></i>{people(t.counts.silent)}
				{incubatingOnly ? 'infected, not ill yet' : 'spreading unaware'}</span
			>
			<span><i style:background={COLOURS.symptomatic}></i>{people(t.counts.symptomatic)} ill</span>
			<span><i style:background={COLOURS.deceased}></i>{Math.round(t.deaths).toLocaleString()} died</span>
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
		width: 210px;
	}
	.card.open {
		width: 250px;
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
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 2px 8px;
	}
	h2 {
		font-size: 13px;
		margin: 0 0 4px;
		white-space: nowrap;
	}
	label {
		display: block;
		margin: 4px 0 6px;
	}
	label span {
		display: flex;
		justify-content: space-between;
	}
	input,
	select {
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
	.toggles {
		display: flex;
		gap: 4px;
	}
	.toggle {
		padding: 1px 6px;
		font-size: 11px;
	}
	.toggle.active {
		background: #3a6590;
	}
	.note {
		margin: 2px 0 4px;
		color: #9fb3c8;
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
