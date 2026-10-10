<script lang="ts">
	import { untrack } from 'svelte';
	import { DISEASES } from '../lib/config/diseases';
	import { withValue, type LivePolicyKey } from '../lib/config/healthPolicy';
	import { microcosm } from '../lib/config/scenarios';
	import { START_MAPS } from '../lib/config/startMaps.generated';
	import { loadDisease } from '../lib/config';
	import { vaccineFor } from '../lib/sim/disease';
	import { createSimulation } from '../lib/sim/engine';
	import type { DiseaseId, Scenario, RegionHistory, Speed, Telemetry } from '../lib/sim/types';
	import { layoutCards } from '../lib/ui/cardLayout';
	import Charts from '../lib/ui/Charts.svelte';
	import Legend from '../lib/ui/Legend.svelte';
	import RegionCard from '../lib/ui/RegionCard.svelte';
	import SimCanvas from '../lib/ui/SimCanvas.svelte';
	import TopBar from '../lib/ui/TopBar.svelte';

	let mapIndex = $state(0);
	let diseaseId: DiseaseId = $state('measles');
	let scenario: Scenario = $state(microcosm(0));
	/** One-dose vaccines have no "partly vaccinated"; the legend shows it if any population has one. */
	const hasPartialCourse = $derived.by(() => {
		const disease = loadDisease(diseaseId);
		return scenario.regions.some((r) => vaccineFor(disease, r.vaccine).hasPartialCourse);
	});
	/** A disease with no vaccine has nobody vaccinated, so the legend leaves vaccination out. */
	const hasVaccine = $derived(loadDisease(diseaseId).vaccines[0].exists);
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

	/** The usual margin around the cities: framing never zooms in closer than this. */
	const FRAME_MARGIN = 150;
	/** Margins tried when the usual one leaves a card over a city, in steps of this many pixels. */
	const FRAME_STEP = 20;

	/**
	 * Frame the populations, leaving room around them for their cards. If the closed cards would
	 * cover a city's dots, try other side and top margins, largest map first, until none does
	 * (or pick the one that covers least), so on a short screen the cards move beside the cities.
	 */
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
		const { width, height } = size;
		const fit = (mx: number, my: number) => sim.view.fit(minX, minY, maxX, maxY, width, height, mx, my);
		if (compact) {
			fit(40, 40);
			viewVersion++;
			return;
		}
		const scaleOf = (mx: number, my: number) =>
			Math.min((width - 2 * mx) / Math.max(1, maxX - minX), (height - 2 * my) / Math.max(1, maxY - minY));
		const usual = scaleOf(FRAME_MARGIN, FRAME_MARGIN);
		const tries: { mx: number; my: number; scale: number }[] = [
			{ mx: FRAME_MARGIN, my: FRAME_MARGIN, scale: usual }
		];
		for (let mx = FRAME_STEP; 2 * mx < width - FRAME_STEP; mx += FRAME_STEP)
			for (let my = FRAME_STEP; 2 * my < height - FRAME_STEP; my += FRAME_STEP) {
				const scale = scaleOf(mx, my);
				if (scale > 0 && scale <= usual) tries.push({ mx, my, scale });
			}
		// The usual frame first, then the biggest map.
		tries.sort((a, b) => (a === tries[0] ? -1 : b === tries[0] ? 1 : b.scale - a.scale));
		const sizes = scenario.regions.map((_, i) => closedSizes[i] ?? { w: CARD_W, h: CARD_H });
		// The first frame (largest map) with nothing covered and every card by its own city; else
		// the first with nothing covered; else the one covering least.
		let best = tries[0];
		let bestCover = Infinity;
		for (const t of tries) {
			fit(t.mx, t.my);
			const { cover, misplaced } = layoutCards(discsOnScreen(), sizes, size);
			if (cover === 0 && misplaced === 0) {
				best = t;
				break;
			}
			if (cover < bestCover) {
				best = t;
				bestCover = cover;
			}
		}
		fit(best.mx, best.my);
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

	function setVaccine(region: number, key: string) {
		scenario.regions[region].vaccine = key;
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
			r.vaccine = kept[i].vaccine;
			r.policy = kept[i].policy;
		});
		restart();
		frame();
	}

	/** Until a card has been measured. */
	const CARD_W = 210;
	const CARD_H = 120;
	/** Each card's measured size, so the layout keeps the whole card on the stage. */
	let cardWidths: number[] = $state([]);
	let cardHeights: number[] = $state([]);
	/** Which cards have a settings panel open. */
	let cardOpen: boolean[] = $state([]);
	/**
	 * Each card's size when closed: framing uses these, so opening a panel doesn't zoom the map
	 * (an open card sits on top instead).
	 */
	let closedSizes: { w: number; h: number }[] = $state([]);
	$effect(() => {
		scenario.regions.forEach((_, i) => {
			if (cardOpen[i]) return;
			const w = cardWidths[i] || CARD_W;
			const h = cardHeights[i] || CARD_H;
			const old = untrack(() => closedSizes[i]);
			if (!old || old.w !== w || old.h !== h) closedSizes[i] = { w, h };
		});
	});
	/** Re-frame when a closed card changes size (another disease, say), so it still fits. */
	$effect(() => {
		void closedSizes.map((c) => c.h + c.w);
		untrack(() => {
			if (size.width > 0) frame();
		});
	});

	function discsOnScreen() {
		return scenario.regions.map((r, i) => {
			const p = sim.view.worldToScreen(r.cx, r.cy);
			return { x: p.x, y: p.y, r: sim.radiusOf(i) * sim.view.scale };
		});
	}

	/** Card positions, kept off every city's dots and off each other (see layoutCards). */
	let cardPositions = $derived.by(() => {
		void viewVersion;
		const sizes = scenario.regions.map((_, i) => ({
			w: cardWidths[i] || CARD_W,
			h: cardHeights[i] || CARD_H
		}));
		return layoutCards(discsOnScreen(), sizes, size).positions;
	});
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
				{@const pos = cardPositions[i]}
				<RegionCard
					{region}
					telemetry={telemetry?.regions[i]}
					disease={DISEASES[diseaseId]}
					peoplePerDot={telemetry?.peoplePerDot ?? 100}
					x={pos.x}
					y={pos.y}
					bind:width={cardWidths[i]}
					bind:height={cardHeights[i]}
					bind:open={cardOpen[i]}
					onvaccination={(full, partial) => setVaccination(i, full, partial)}
					onvaccine={(key) => setVaccine(i, key)}
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
					onvaccine={(key) => setVaccine(i, key)}
					onpolicy={(key, value) => setPolicy(i, key, value)}
					onseed={() => sim.send({ type: 'seed', region: i, count: 1 })}
				/>
			{/each}
		</div>
	{/if}

	<footer>
		{#if telemetry}
			<Charts {telemetry} history={histories} mortalityBasis={DISEASES[diseaseId].mortalityBasis} />
			<Legend peoplePerDot={telemetry.peoplePerDot} {hasVaccine} {hasPartialCourse} />
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
