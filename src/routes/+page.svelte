<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { DISEASES } from '../lib/config/diseases';
	import { withValue, type LivePolicyKey } from '../lib/config/healthPolicy';
	import { microcosm } from '../lib/config/scenarios';
	import { START_MAPS } from '../lib/config/startMaps.generated';
	import { loadDisease } from '../lib/config';
	import { vaccineFor } from '../lib/sim/disease';
	import { DEFAULT_PEOPLE_PER_DOT } from '../lib/sim/constants';
	import { createSimulation } from '../lib/sim/engine';
	import type { DiseaseId, Scenario, RegionHistory, Speed, Telemetry } from '../lib/sim/types';
	import { frameTries, layoutCards, offsetsOf, pickFrame, type Offset } from '../lib/ui/cardLayout';
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

	/** Set once the user pans or zooms: from then on the map is only re-framed when they ask. */
	let userMoved = false;

	/**
	 * Frame the populations, leaving room around them for their cards. If the closed cards would
	 * cover a city's dots or sit nearer another city, try other side and top margins, largest map
	 * first, until none does (or pick the one that does least), so on a short screen the cards
	 * move beside the cities.
	 */
	function frame() {
		userMoved = false;
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
		const tries = frameTries(width, height, maxX - minX, maxY - minY);
		// The first (biggest) frame with nothing covered and every card by its own city; else the
		// first with nothing covered, accepting a card nearer another city; else the one covering
		// least, then with fewest cards nearer another city.
		const best = pickFrame(tries, (t) => {
			fit(t.mx, t.my);
			return layoutCards(discsOnScreen(), layoutSizes(), size);
		});
		fit(best.mx, best.my);
		lastPositions = undefined;
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
		forgetCardSizes();
		restart();
		frame();
	}

	/** Until a card has been measured. */
	const CARD_W = 210;
	const CARD_H = 120;
	/** Each card's measured size (bigger while a panel is open). */
	let cardWidths: number[] = $state([]);
	let cardHeights: number[] = $state([]);
	/** Which cards have a settings panel open. */
	let cardOpen: boolean[] = $state([]);
	/**
	 * Each card's tallest size while closed, for this disease and map. Layout and framing use only
	 * these, so opening a panel moves nothing (the open card grows on top) and a card that grows
	 * during a run doesn't shuffle the others. Measured only while the card is closed: an open
	 * card is wider than CARD_W, so a reading at that width is a closed one.
	 */
	let closedSizes: ({ w: number; h: number } | undefined)[] = $state([]);
	const GROW_SLACK = 3;
	$effect(() => {
		scenario.regions.forEach((_, i) => {
			const w = cardWidths[i];
			const h = cardHeights[i];
			if (cardOpen[i] || !w || !h || w > CARD_W) return;
			const old = untrack(() => closedSizes[i]);
			// A pixel or two is font rounding (the warning sign's glyph), not a new line.
			if (!old || h > old.h + GROW_SLACK) closedSizes[i] = { w, h };
		});
	});
	/** Each floating card's element, to measure it straight after a disease or map change. */
	let cardElements: (HTMLElement | undefined)[] = $state([]);
	/**
	 * Another disease or map: once the cards show it, measure them afresh (a card the same height
	 * as before fires no resize, and a stale bound height would be kept as the tallest) and frame
	 * the map for them.
	 */
	async function forgetCardSizes() {
		userMoved = false;
		lastPositions = undefined;
		await tick();
		// Wait for the next paint too: some of a card's lines follow the new run's first telemetry.
		await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
		closedSizes = scenario.regions.map((_, i) => {
			const el = cardElements[i];
			if (!el || cardOpen[i] || el.offsetWidth > CARD_W) return undefined;
			return { w: el.offsetWidth, h: el.offsetHeight };
		});
	}
	/** Frame again when a card first measures taller than before, unless the user has moved the map. */
	$effect(() => {
		void closedSizes.map((c) => c?.h);
		untrack(() => {
			if (size.width > 0 && !userMoved) frame();
		});
	});

	function layoutSizes() {
		return scenario.regions.map((_, i) => closedSizes[i] ?? { w: CARD_W, h: CARD_H });
	}

	function discsOnScreen() {
		return scenario.regions.map((r, i) => {
			const p = sim.view.worldToScreen(r.cx, r.cy);
			return { x: p.x, y: p.y, r: sim.radiusOf(i) * sim.view.scale };
		});
	}

	/** The last layout, as offsets from each city, kept while it is still clear so cards don't move without need. */
	let lastPositions: Offset[] | undefined;
	/** Card positions, kept off every city's dots and off each other (see layoutCards). */
	let cardPositions = $derived.by(() => {
		void viewVersion;
		const sizes = layoutSizes();
		const discs = discsOnScreen();
		const layout = layoutCards(discs, sizes, size, lastPositions);
		lastPositions = offsetsOf(layout, discs);
		const placed = layout.positions;
		// An open card stays where it was and grows on top (scrolling inside if it would run past the
		// stage), so its buttons stay under the pointer; pulled left only if it would leave the stage.
		return placed.map((p, i) => {
			if (!cardOpen[i]) return { ...p, maxHeight: undefined };
			const w = cardWidths[i] || sizes[i].w;
			return { x: Math.max(8, Math.min(p.x, size.width - w - 8)), y: p.y, maxHeight: size.height - p.y - 8 };
		});
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
			forgetCardSizes();
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
			onview={() => {
				userMoved = true;
				viewVersion++;
			}}
		/>
		{#if !compact}
			{#each scenario.regions as region, i (region.id)}
				{@const pos = cardPositions[i]}
				<RegionCard
					{region}
					telemetry={telemetry?.regions[i]}
					disease={DISEASES[diseaseId]}
					peoplePerDot={telemetry?.peoplePerDot ?? DEFAULT_PEOPLE_PER_DOT}
					x={pos.x}
					y={pos.y}
					maxHeight={pos.maxHeight}
					bind:element={cardElements[i]}
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
					userMoved = true;
					viewVersion++;
				}}>+</button
			>
			<button
				aria-label="Zoom out"
				onclick={() => {
					sim.view.zoomAt(0.8, size.width / 2, size.height / 2);
					userMoved = true;
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
					peoplePerDot={telemetry?.peoplePerDot ?? DEFAULT_PEOPLE_PER_DOT}
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
