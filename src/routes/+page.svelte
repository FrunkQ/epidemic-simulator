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
	import {
		frameTries,
		layoutCards,
		offsetsOf,
		openMaxHeight,
		pickFrame,
		shouldDock,
		type Offset
	} from '../lib/ui/cardLayout';
	import Charts from '../lib/ui/Charts.svelte';
	import Legend from '../lib/ui/Legend.svelte';
	import RegionCard from '../lib/ui/RegionCard.svelte';
	import SimCanvas from '../lib/ui/SimCanvas.svelte';
	import TopBar from '../lib/ui/TopBar.svelte';
	import { DEFAULT_SPEED } from '../lib/ui/speeds';

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
	let speed: Speed = $state(DEFAULT_SPEED);
	const sim = createSimulation(microcosm(0), { seed: 1, diseaseId: 'measles' });
	sim.send({ type: 'speed', value: DEFAULT_SPEED });
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
	// The charts and legend are there from the first paint, so the stage is measured at its real
	// height and a short window docks straight away rather than after a frame of floating cards.
	setTelemetry(sim.snapshot());
	let size = $state({ width: 0, height: 0 });
	/** Bumped whenever the camera moves, so cards follow their cities. */
	let viewVersion = $state(0);
	/**
	 * Cards go in the strip below the map on a narrow screen, or on a stage too small to frame the
	 * cities with floating cards around them, or when no frame keeps them off every city. Docked
	 * that way, they are checked again on the next re-frame for another disease, map or window
	 * size (never for a pan, zoom, open panel or a card growing during a run).
	 */
	let shortDock = $state(false);
	/** When the cards docked: the window, the floating stage's height and the stage's top. */
	let dockedAt = { width: 0, height: 0, stage: 0, top: 0 };
	let stageElement: HTMLElement | undefined = $state();
	let mapCanvas: SimCanvas | undefined = $state();
	/** The docked cards' strip while it is on the page. */
	let stripElement: HTMLElement | undefined = $state();
	/** Set by a disease or map change: the next frame checks again whether the cards still dock. */
	let dockRecheck = false;
	/**
	 * Set by a disease, map or window change: once every card has been measured, the next frame
	 * docks the cards if no frame keeps them off the cities. Never set by a card growing or ⌂.
	 */
	let fallbackPending = false;
	/** True from a disease or map change until the cards are measured again. */
	let sizesStale = false;
	// Before the stage is first measured, go by the window, so a wide window never paints the strip
	// (which would shrink the stage and dock the cards on a screen that has room for them).
	let compact = $derived((size.width || window.innerWidth) < 760 || shortDock);

	/** Set once the user pans or zooms: from then on the map is only re-framed when they ask. */
	let userMoved = false;

	/**
	 * Frame the populations, leaving room around them for their cards. If the closed cards would
	 * cover a city's dots or sit nearer another city, try other side and top margins, largest map
	 * first, until none does (or pick the one that does least), so on a short screen the cards
	 * move beside the cities.
	 */
	/**
	 * Frame again once the page has laid out for a change of layout (the strip coming or going),
	 * still before the next paint, measuring the stage then. Its own resize can't be waited for:
	 * the stage may end the size it was when last observed, which fires none.
	 */
	function frameWhenLaidOut(resized: boolean) {
		tick().then(() => {
			if (!stageElement || compact !== !!stripElement) return;
			// Floating cards just came: measure the closed ones, so the fallback can dock at once
			// rather than after a frame of floating cards.
			if (!compact)
				closedSizes = scenario.regions.map((_, i) => {
					const el = cardElements[i];
					return cardOpen[i] || !el ? closedSizes[i] : { w: el.offsetWidth, h: el.offsetHeight };
				});
			size = { width: stageElement.clientWidth, height: stageElement.clientHeight };
			frame(resized);
			mapCanvas?.redraw();
		});
	}

	/** The box around every city's disc, in world units. */
	function cityBounds() {
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
		return { minX, minY, maxX, maxY };
	}

	function frame(resized = false) {
		userMoved = false;
		const { minX, minY, maxX, maxY } = cityBounds();
		const { width, height } = size;
		if (width <= 0 || height <= 0) return; // not laid out yet: its resize frames it
		// Between layouts: widened past the narrow-screen width with the strip still on the page, or
		// docked (or narrowed) before the strip has come. This stage is the old layout's, so measure
		// it again once the DOM has caught up, before the next paint, and decide then (a stage that
		// ends the same size fires no resize).
		if (compact !== !!stripElement) {
			frameWhenLaidOut(resized);
			return;
		}
		const fit = (mx: number, my: number) => sim.view.fit(minX, minY, maxX, maxY, width, height, mx, my);
		/** How much the closed cards would cover the cities on the best frame of a w × h stage. */
		const coverAt = (w: number, h: number) => {
			const at = { width: w, height: h };
			const cover = (mx: number, my: number) => {
				sim.view.fit(minX, minY, maxX, maxY, w, h, mx, my);
				return layoutCards(discsOnScreen(), layoutSizes(), at);
			};
			const best = pickFrame(frameTries(w, h, maxX - minX, maxY - minY), (t) => cover(t.mx, t.my));
			return cover(best.mx, best.my).cover;
		};
		const top = () => stageElement?.getBoundingClientRect().top ?? 0;
		const dock = () => {
			shortDock = true;
			dockedAt = { width: window.innerWidth, height: window.innerHeight, stage: height, top: top() };
		};
		// Docked for a small stage: after another disease or map, or in a window of another size,
		// work out the stage the cards would float on (the one they docked from, less any growth of
		// the header above it, plus any growth of the window) and float them only if it is big
		// enough, so the map never shows floating cards for a frame before docking again.
		// It waits for a new disease's or map's cards to be measured (a docked card may not be yet:
		// layoutSizes stands in for it); the fallback dock below waits for every card's size.
		if (resized || dockRecheck) fallbackPending = true;
		const measured = !sizesStale && scenario.regions.every((_, i) => closedSizes[i]);
		const windowChanged = window.innerWidth !== dockedAt.width || window.innerHeight !== dockedAt.height;
		if (shortDock && !sizesStale && (dockRecheck || windowChanged)) {
			const floatHeight = dockedAt.stage - (top() - dockedAt.top) + (window.innerHeight - dockedAt.height);
			const span = [maxX - minX, maxY - minY] as const;
			if (!shouldDock(width, floatHeight, ...span) && coverAt(width, floatHeight) === 0) {
				dockRecheck = false;
				shortDock = false;
				frameWhenLaidOut(resized); // the strip goes and the stage grows
				return;
			}
			dockedAt = { width: window.innerWidth, height: window.innerHeight, stage: floatHeight, top: top() };
		}
		if (!sizesStale) dockRecheck = false;
		if (!compact && shouldDock(width, height, maxX - minX, maxY - minY)) {
			dock();
			frameWhenLaidOut(resized); // the strip comes and the stage shrinks
			return;
		}
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
		// A safety net: no frame keeps the cards off the cities.
		if (fallbackPending && measured) {
			fallbackPending = false;
			if (layoutCards(discsOnScreen(), layoutSizes(), size).cover > 0) {
				dock();
				frameWhenLaidOut(resized);
				return;
			}
		}
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
		dockRecheck = true;
		frame();
	}

	/** Until a card has been measured. */
	const CARD_W = 210;
	const CARD_H = 120;
	/** Each card's measured width, for an open card kept on the stage. */
	let cardWidths: number[] = $state([]);
	/** Which cards have a settings panel open. */
	let cardOpen: boolean[] = $state([]);
	/** Each card's size as measured with its panel shut (RegionCard closedSize). */
	let cardClosed: ({ w: number; h: number } | undefined)[] = $state([]);
	/**
	 * Each card's tallest size while closed, for this disease and map. Layout and framing use only
	 * these, so opening a panel moves nothing (the open card grows on top) and a card that grows
	 * during a run doesn't shuffle the others. Measured only while the card's panel is shut, by
	 * the card itself (an open card is the same 210px wide, but taller).
	 */
	let closedSizes: ({ w: number; h: number } | undefined)[] = $state([]);
	const GROW_SLACK = 3;
	$effect(() => {
		scenario.regions.forEach((_, i) => {
			const closed = cardClosed[i];
			if (!closed) return;
			const { w, h } = closed;
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
		sizesStale = true;
		userMoved = false;
		lastPositions = undefined;
		await tick();
		// Wait for the next paint too: some of a card's lines follow the new run's first telemetry.
		await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
		const old = closedSizes;
		sizesStale = false;
		closedSizes = scenario.regions.map((_, i) => {
			const el = cardElements[i];
			// An open card can't be measured closed: keep its last closed size until it closes.
			if (cardOpen[i]) return old[i];
			if (!el) return undefined;
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

	// A read-only view of the layout for the browser checks (tests/browser), built in only when
	// VITE_LAYOUT_PROBE=1: the deployed build never has it (CI checks its output). Each map drawn
	// logs its scale and whether the strip was on the page then, for the first-frame check.
	if (import.meta.env.VITE_LAYOUT_PROBE === '1') {
		const probe = window as unknown as {
			__layoutProbe: () => unknown;
			__layoutLog: { scale: number; docked: boolean; frame: number }[];
		};
		probe.__layoutProbe = () => ({
			stage: { ...size },
			discs: discsOnScreen(),
			scale: sim.view.scale,
			docked: !!stripElement,
			// The shortest stage, at this width, on which the cards float rather than dock (shouldDock).
			dockLine: (() => {
				const b = cityBounds();
				let lo = 0;
				let hi = 4 * Math.max(size.height, 1);
				while (hi - lo > 0.5) {
					const mid = (lo + hi) / 2;
					if (shouldDock(size.width, mid, b.maxX - b.minX, b.maxY - b.minY)) lo = mid;
					else hi = mid;
				}
				return Math.ceil(hi);
			})()
		});
		probe.__layoutLog = [];
		const render = sim.render.bind(sim);
		sim.render = (...args) => {
			// Every map drawn in one frame has the same timeline time; the last one is painted.
			const frame = Number(document.timeline.currentTime ?? 0);
			probe.__layoutLog.push({ scale: sim.view.scale, docked: !!stripElement, frame });
			render(...args);
		};
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
			const x = Math.max(8, Math.min(p.x, size.width - w - 8));
			// Stop above any city below it, so the city stays in view while its settings change.
			// ...and above any card below it, so that card's buttons stay in reach.
			const others = placed.flatMap((q, j) => (j === i ? [] : [{ x: q.x, y: q.y, w: sizes[j].w }]));
			return {
				x,
				y: p.y,
				maxHeight: openMaxHeight({ x, y: p.y, w }, sizes[i].h, discs, size.height, others)
			};
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

<main class:docked={compact}>
	<TopBar
		{diseaseId}
		{speed}
		day={telemetry?.day ?? 0}
		ondisease={(id) => {
			diseaseId = id;
			dockRecheck = true;
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

	<div class="stage" bind:this={stageElement}>
		<SimCanvas
			bind:this={mapCanvas}
			{sim}
			ontelemetry={setTelemetry}
			onresize={(w, h) => {
				size = { width: w, height: h };
				frame(true);
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
					bind:open={cardOpen[i]}
					bind:closedSize={cardClosed[i]}
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
			<button aria-label="Back to the start view" onclick={() => frame()}>⌂</button>
		</div>
	</div>

	{#if compact}
		<div class="strip" bind:this={stripElement}>
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
	/* Docked, the strip's row never shrinks below its cards (it scrolls sideways): the page scrolls
	   instead when the window is too short for all of it. */
	main.docked {
		grid-template-rows: auto 1fr max-content auto;
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
		align-items: flex-start;
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
