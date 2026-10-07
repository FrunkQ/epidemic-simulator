<script lang="ts">
	import { loadDisease } from '../lib/config/index';
	import { DISEASES } from '../lib/config/diseases';
	import { threeCities } from '../lib/config/scenarios';
	import { createSimulation } from '../lib/sim/engine';
	import { COLOURS } from '../lib/sim/render';
	import type { DiseaseId, Scenario, Speed, Telemetry } from '../lib/sim/types';
	import SimCanvas from '../lib/ui/SimCanvas.svelte';

	// Step 1 test bench: three cities with no travel yet, to watch the engine run.
	let diseaseId: DiseaseId = $state('measles');
	let scenario: Scenario = $state(threeCities());
	let seed = $state(1);
	const sim = createSimulation(threeCities(), { seed: 1, disease: loadDisease('measles') });
	let telemetry: Telemetry | null = $state.raw(null);
	let speed: Speed = $state(1);
	let size = { width: 0, height: 0 };

	function frame() {
		const regions = sim.regions;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		regions.forEach((r, i) => {
			const rad = sim.radiusOf(i);
			minX = Math.min(minX, r.cx - rad);
			minY = Math.min(minY, r.cy - rad);
			maxX = Math.max(maxX, r.cx + rad);
			maxY = Math.max(maxY, r.cy + rad);
		});
		// Leave room on the left for the population cards on wide screens.
		const cards = size.width > 640 ? 320 : 0;
		sim.view.fit(minX, minY, maxX, maxY, size.width - cards, size.height, 40);
		sim.view.x -= cards / sim.view.scale;
	}

	function restart() {
		sim.setup($state.snapshot(scenario), loadDisease(diseaseId), seed);
		frame();
	}

	function setVaccination(region: number, key: 'vaccinatedFull' | 'vaccinatedPartial', value: number) {
		scenario.regions[region][key] = value;
		const r = scenario.regions[region];
		if (r.vaccinatedFull + r.vaccinatedPartial > 1) {
			if (key === 'vaccinatedFull') r.vaccinatedPartial = 1 - value;
			else r.vaccinatedFull = 1 - value;
		}
		restart();
	}

	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<svelte:head>
	<title>Epidemic simulator</title>
</svelte:head>

<main>
	<header>
		<h1>Epidemic simulator <small>engine test bench</small></h1>
		<label>
			Disease
			<select bind:value={diseaseId} onchange={restart}>
				{#each Object.values(DISEASES) as d (d.id)}
					<option value={d.id}>{d.name}</option>
				{/each}
			</select>
		</label>
		<span class="blurb">{DISEASES[diseaseId].blurb}</span>
		<label>
			Speed
			<select bind:value={speed} onchange={() => sim.send({ type: 'speed', value: speed })}>
				<option value={0}>Paused</option>
				<option value={0.5}>Slow</option>
				<option value={1}>Normal</option>
				<option value={2}>Fast</option>
				<option value={4}>Very fast</option>
			</select>
		</label>
		<button
			onclick={() => {
				seed++;
				restart();
			}}>Restart</button
		>
		{#if telemetry}<span class="day">Day {telemetry.day}</span>{/if}
	</header>

	<div class="stage">
		<SimCanvas
			{sim}
			ontelemetry={(t) => (telemetry = t)}
			onresize={(w, h) => {
				size = { width: w, height: h };
				frame();
			}}
		/>
		<div class="cards">
			{#each scenario.regions as region, i (region.id)}
				{@const t = telemetry?.regions[i]}
				<section class="card">
					<h2>{region.name}</h2>
					<label>
						Fully vaccinated: {pct(region.vaccinatedFull)}
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={region.vaccinatedFull}
							onchange={(e) => setVaccination(i, 'vaccinatedFull', Number(e.currentTarget.value))}
						/>
					</label>
					<label>
						Partly vaccinated: {pct(region.vaccinatedPartial)}
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={region.vaccinatedPartial}
							onchange={(e) => setVaccination(i, 'vaccinatedPartial', Number(e.currentTarget.value))}
						/>
					</label>
					<button onclick={() => sim.send({ type: 'seed', region: i, count: 1 })}
						>Bring in one infected person</button
					>
					{#if t}
						<p class="counts">
							<span style:color={COLOURS.silent}>{t.counts.silent} spreading unaware</span> ·
							<span style:color={COLOURS.symptomatic}>{t.counts.symptomatic} ill</span> ·
							<span style:color={COLOURS.recovered}>{t.counts.recovered} recovered</span> ·
							<span style:color={COLOURS.deceased}>{t.counts.deceased} died</span>
						</p>
					{/if}
				</section>
			{/each}
		</div>
	</div>

	<footer>
		{#if telemetry}Each dot is about {telemetry.peoplePerDot} people.{/if}
		<span style:color={COLOURS.unprotected}>● not protected</span>
		<span style:color={COLOURS.full}>● fully vaccinated</span>
		<span style:color={COLOURS.partial}>● partly vaccinated</span>
		<span style:color={COLOURS.silent}>● infected, no symptoms yet</span>
		<span style:color={COLOURS.symptomatic}>● ill</span>
		<span style:color={COLOURS.recovered}>● recovered</span>
		<span style:color={COLOURS.deceased}>● died</span>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0d1b2a;
		color: #e6edf5;
		font-family: system-ui, sans-serif;
	}
	main {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100vh;
	}
	header,
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		align-items: center;
		padding: 10px 16px;
		background: #13263a;
		font-size: 14px;
	}
	h1 {
		font-size: 18px;
		margin: 0;
	}
	h1 small {
		font-weight: normal;
		opacity: 0.6;
	}
	.blurb {
		opacity: 0.8;
		flex: 1 1 260px;
	}
	.day {
		font-variant-numeric: tabular-nums;
	}
	.stage {
		position: relative;
		min-height: 0;
	}
	.cards {
		position: absolute;
		top: 12px;
		left: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 300px;
	}
	.card {
		background: rgba(19, 38, 58, 0.92);
		border: 1px solid #2a4562;
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 13px;
	}
	.card h2 {
		font-size: 14px;
		margin: 0 0 6px;
	}
	.card label {
		display: block;
		margin-bottom: 6px;
	}
	.card input {
		width: 100%;
	}
	.counts {
		margin: 6px 0 0;
	}
	@media (max-width: 640px) {
		.cards {
			position: static;
			max-width: none;
			padding: 8px 16px;
		}
	}
</style>
