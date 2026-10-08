<script lang="ts">
	import { DISEASES } from '../lib/config/diseases';
	import { withValue, type LivePolicyKey } from '../lib/config/healthPolicy';
	import { microcosm } from '../lib/config/scenarios';
	import { START_MAPS } from '../lib/config/startMaps.generated';
	import { createSimulation } from '../lib/sim/engine';
	import type { DiseaseId, Scenario, RegionHistory, Speed, Telemetry } from '../lib/sim/types';
	import Charts from '../lib/ui/Charts.svelte';
	import Legend from '../lib/ui/Legend.svelte';
	import RegionCard from '../lib/ui/RegionCard.svelte';
	import SimCanvas from '../lib/ui/SimCanvas.svelte';
	import TopBar from '../lib/ui/TopBar.svelte';

	let mapIndex = $state(0);
	let diseaseId: DiseaseId = $state('measles');
	/** Diseases whose vaccine is one dose have no "partly vaccinated" (partialEfficacy left out). */
	const hasPartialCourse = $derived(DISEASES[diseaseId].partialEfficacy !== undefined);
	let scenario: Scenario = $state(microcosm(0));
	let seed = $state(1);
	let speed: Speed = $state(1);
	const sim = createSimulation(microcosm(0), { seed: 1, diseaseId: 'measles' });
	let telemetry: Telemetry | null = $state.raw(null);
	let histories: RegionHistory[] = $state.raw([]);
	let historyVersion = -1;

	/** Store a snapshot, and re-read the daily history only when a new day was sampled. */
	function setTelemetry(t: Telemetry) {
		telemetry = t;
		if (t.historyVersion === historyVersion) return;
		historyVersion = t.historyVersion;
		histories = t.regions.map((_, r) => sim.history(r));
	}
	let size = $state({ width: 0, height: 0 });
	/** Bumped whenever the camera moves, so cards follow their cities. */
	let viewVersion = $state(0);
	let compact = $derived(size.width < 760);

	/** Frame the populations, leaving room around them for their cards. */
	function frame() {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		sim.regions.forEach((r, i) => {
			const rad = sim.radiusOf(i);
			minX = Math.min(minX, r.cx - rad);
			minY = Math.min(minY, r.cy - rad);
			maxX = Math.max(maxX, r.cx + rad);
			maxY = Math.max(maxY, r.cy + rad);
		});
		const margin = compact ? 40 : 150;
		sim.view.fit(minX, minY, maxX, maxY, size.width, size.height, margin);
		viewVersion++;
	}

	function restart() {
		sim.setup($state.snapshot(scenario), diseaseId, seed);
		historyVersion = -1;
		setTelemetry(sim.snapshot());
	}

	function setVaccination(region: number, full: number, partial: number) {
		const r = scenario.regions[region];
		if (full !== r.vaccinatedFull) partial = Math.min(partial, 1 - full);
		else full = Math.min(full, 1 - partial);
		r.vaccinatedFull = full;
		r.vaccinatedPartial = partial;
		restart();
	}

	/** A live policy change: kept for the next restart, and sent to the running sim as a command. */
	function setPolicy(region: number, key: LivePolicyKey, value: number) {
		const r = scenario.regions[region];
		r.policy = withValue($state.snapshot(r.policy), key, value);
		sim.send({ type: 'policy', region, policy: $state.snapshot(r.policy) });
	}

	function newMap() {
		mapIndex = (mapIndex + 1) % START_MAPS.length;
		const kept = $state.snapshot(scenario.regions);
		scenario = microcosm(mapIndex);
		scenario.regions.forEach((r, i) => {
			r.vaccinatedFull = kept[i].vaccinatedFull;
			r.vaccinatedPartial = kept[i].vaccinatedPartial;
			r.policy = kept[i].policy;
		});
		restart();
		frame();
	}

	const CARD_W = 200;
	const CARD_H = 120;

	/**
	 * Cards sit just outside their city's disc, on the side facing away from the other cities,
	 * so they don't cover the dots or each other.
	 */
	function cardPosition(region: number): { x: number; y: number } {
		void viewVersion;
		const regions = scenario.regions;
		const cx = regions.reduce((a, r) => a + r.cx, 0) / regions.length;
		const cy = regions.reduce((a, r) => a + r.cy, 0) / regions.length;
		const r = regions[region];
		const p = sim.view.worldToScreen(r.cx, r.cy);
		const c = sim.view.worldToScreen(cx, cy);
		let dx = p.x - c.x;
		let dy = p.y - c.y;
		const d = Math.hypot(dx, dy);
		if (d < 1) {
			dx = 0;
			dy = -1;
		} else {
			dx /= d;
			dy /= d;
		}
		const reach = sim.radiusOf(region) * sim.view.scale + 14;
		const w = CARD_W;
		const h = CARD_H;
		// Distance from the card's centre to its edge in direction (dx, dy).
		const edge = Math.min(w / 2 / Math.max(Math.abs(dx), 1e-6), h / 2 / Math.max(Math.abs(dy), 1e-6));
		const x = p.x + dx * (reach + edge) - w / 2;
		const y = p.y + dy * (reach + edge) - h / 2;
		return {
			x: Math.min(Math.max(x, 8), size.width - w - 8),
			y: Math.min(Math.max(y, 8), size.height - h - 8)
		};
	}
</script>

<svelte:head>
	<title>Epidemic simulator</title>
	<meta
		name="description"
		content="A simple what-if tool: watch a disease spread between cities and see what vaccines, lockdowns and travel bans do."
	/>
</svelte:head>

<main>
	<TopBar
		{diseaseId}
		{speed}
		day={telemetry?.day ?? 0}
		ondisease={(id) => {
			diseaseId = id;
			restart();
		}}
		onspeed={(s) => {
			speed = s;
			sim.send({ type: 'speed', value: s });
		}}
		onrestart={() => {
			seed++;
			restart();
		}}
		onnewmap={newMap}
	/>

	<div class="stage">
		<SimCanvas
			{sim}
			ontelemetry={setTelemetry}
			onresize={(w, h) => {
				size = { width: w, height: h };
				frame();
			}}
			onview={() => viewVersion++}
		/>
		{#if !compact}
			{#each scenario.regions as region, i (region.id)}
				{@const pos = cardPosition(i)}
				<RegionCard
					{region}
					telemetry={telemetry?.regions[i]}
					disease={DISEASES[diseaseId]}
					peoplePerDot={telemetry?.peoplePerDot ?? 100}
					x={pos.x}
					y={pos.y}
					onvaccination={(full, partial) => setVaccination(i, full, partial)}
					onpolicy={(key, value) => setPolicy(i, key, value)}
					onseed={() => sim.send({ type: 'seed', region: i, count: 1 })}
				/>
			{/each}
		{/if}
		<div class="zoom">
			<button
				aria-label="Zoom in"
				onclick={() => {
					sim.view.zoomAt(1.25, size.width / 2, size.height / 2);
					viewVersion++;
				}}>+</button
			>
			<button
				aria-label="Zoom out"
				onclick={() => {
					sim.view.zoomAt(0.8, size.width / 2, size.height / 2);
					viewVersion++;
				}}>−</button
			>
			<button aria-label="Back to the start view" onclick={frame}>⌂</button>
		</div>
	</div>

	{#if compact}
		<div class="strip">
			{#each scenario.regions as region, i (region.id)}
				<RegionCard
					{region}
					telemetry={telemetry?.regions[i]}
					disease={DISEASES[diseaseId]}
					peoplePerDot={telemetry?.peoplePerDot ?? 100}
					x={0}
					y={0}
					docked
					onvaccination={(full, partial) => setVaccination(i, full, partial)}
					onpolicy={(key, value) => setPolicy(i, key, value)}
					onseed={() => sim.send({ type: 'seed', region: i, count: 1 })}
				/>
			{/each}
		</div>
	{/if}

	<footer>
		{#if telemetry}
			<Charts {telemetry} history={histories} />
			<Legend peoplePerDot={telemetry.peoplePerDot} {hasPartialCourse} />
		{/if}
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0b1a2e;
		color: #e6edf5;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	main {
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		grid-template-columns: minmax(0, 1fr);
		height: 100dvh;
	}
	.stage {
		position: relative;
		min-height: 280px;
		overflow: hidden;
	}
	.zoom {
		position: absolute;
		right: 12px;
		bottom: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.zoom button {
		width: 32px;
		height: 32px;
		font-size: 18px;
		color: #e6edf5;
		background: rgba(29, 58, 90, 0.92);
		border: 1px solid #3a6590;
		border-radius: 6px;
		cursor: pointer;
	}
	.strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 8px 16px;
		background: #0e1f33;
	}
	footer {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 16px 10px;
		background: #11233a;
		border-top: 1px solid #22405f;
	}
</style>
