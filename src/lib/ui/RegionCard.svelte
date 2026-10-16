<script module lang="ts">
	/**
	 * Docking swaps the floating cards for the strip's, so each card is built again. A card's open
	 * details, or focus on one of its lines, is carried across to its new copy.
	 */
	let carried: { region: Region['id']; which: 'harm' | 'babies'; open: boolean } | null = null;
</script>

<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { loadDisease } from '../config';
	import { BEHAVIOUR } from '../config/behaviour';
	import { ERA_DEATH_RATE, ERA_DEATH_RATE_SHORT } from '../config/careBasis';
	import { LIVE_POLICY_FIELDS, type LivePolicyKey } from '../config/healthPolicy';
	import { vaccineKey } from '../config/vaccines';
	import { waningWords } from '../config/waning';
	import { overallSevere, unvaccinatedShare, vaccineFor } from '../sim/disease';
	import { COLOURS } from '../sim/render';
	import type { DiseaseConfig, DiseaseId, PressureBand, Region, RegionTelemetry } from '../sim/types';
	import LevelGauge from './charts/LevelGauge.svelte';
	import { harmText } from './harmText';

	interface Props {
		region: Region;
		telemetry: RegionTelemetry | undefined;
		disease: DiseaseConfig;
		peoplePerDot: number;
		/** Screen position of the card's top-left corner. */
		x: number;
		y: number;
		/** Tallest the card may be before it scrolls inside (an open card near the stage bottom). */
		maxHeight?: number;
		/** Lay the card out in a strip (small screens) instead of floating it on the map. */
		docked?: boolean;
		/** The card's rendered size, so the page can keep the whole card on screen. */
		width?: number;
		height?: number;
		/** The card's element, so the page can measure it at once. */
		element?: HTMLElement;
		/** Whether a settings panel is open (the card is then taller and sits on top). */
		open?: boolean;
		/**
		 * The card's size as last measured with no panel open. Taken from resizes seen while the panel
		 * is shut, so closing a panel never reports the open height as the closed one.
		 */
		closedSize?: { w: number; h: number };
		onvaccination: (full: number, partial: number) => void;
		/** A different vaccine version was picked (restarts the run). */
		onvaccine: (key: string) => void;
		/** A health policy slider moved; applies live, without a restart. */
		onpolicy: (key: LivePolicyKey, value: number) => void;
		onseed: () => void;
		/** The cities' discs in window coordinates, which the harm details must not cover. */
		discs?: () => { x: number; y: number; r: number }[];
	}

	let {
		region,
		telemetry: t,
		disease,
		peoplePerDot,
		x,
		y,
		maxHeight,
		docked = false,
		element = $bindable(),
		width = $bindable(),
		height = $bindable(),
		open = $bindable(),
		// Bound by the page; written from the ResizeObserver below, which the linter can't follow.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-useless-assignment
		closedSize = $bindable(),
		onvaccination,
		onvaccine,
		onpolicy,
		onseed,
		discs = () => []
	}: Props = $props();
	/** Which settings panel is open, if any. */
	let panel: 'vaccination' | 'policy' | null = $state(null);
	$effect(() => {
		open = panel !== null;
	});
	const toggle = (p: 'vaccination' | 'policy') => (panel = panel === p ? null : p);
	// A ResizeObserver reports the card after layout, so when a panel closes it reports the closed
	// height; a bound offsetHeight read in an effect could still hold the open one.
	$effect(() => {
		const el = element;
		if (!el) return;
		const observer = new ResizeObserver(() => {
			if (panel === null && el.offsetHeight > 0) closedSize = { w: el.offsetWidth, h: el.offsetHeight };
		});
		observer.observe(el);
		return () => observer.disconnect();
	});
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	/** The seed button brings in one infected person (6.9). */
	const seedLabel = 'Bring in 1 infected person';
	const seedHover =
		'A single case can die out by chance, and often does when a disease spreads slowly. Press again to bring in another.';
	/** The population when the run starts, in people, to two significant figures so it reads easily. */
	let startingPeople = $derived(region.population.toLocaleString('en-GB', { maximumSignificantDigits: 2 }));
	const people = (n: number) => Math.round(n).toLocaleString();
	const protects = (efficacy: number) => `protects about ${Math.round(efficacy * 100)} in 100`;
	const pctOf = (v: number) => `${Math.round(v * 100)}%`;
	/** The vaccine given here, as the engine uses it (the same helper, so the card can't disagree). */
	let runtime = $derived(loadDisease(disease.id as DiseaseId));
	let vaccine = $derived(vaccineFor(runtime, region.vaccine));
	/** The same vaccine's config entry, for its half-life and any card note. */
	let vaccineConfig = $derived(disease.vaccines?.find((v) => vaccineKey(v) === vaccine.key));
	/**
	 * A disease whose whole silent phase is incubation (6.1) and where everyone falls ill: silent
	 * dots spread nothing. A symptom-free case would spread once its latent days end.
	 */
	let incubatingOnly = $derived(
		runtime.latentTicks >= runtime.silentTicks &&
			runtime.silentTicks > 0 &&
			runtime.asymptomaticFraction === 0
	);
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
	/**
	 * Lasting harm and babies (6.17). Hidden at one person per dot (the guided village) until a
	 * chapter narrates it.
	 */
	let harm = $derived(
		t && peoplePerDot > 1 ? harmText(disease, t.harmed, t.babies, runtime.waningMeanTicks === 0) : null
	);

	/**
	 * The details behind the harm and babies lines: each line is a button that opens them over the
	 * map, so keyboard, touch and screen readers reach them and the card never changes size. They
	 * close on Escape (focus goes back to the line), a click elsewhere, a new window width, a scroll,
	 * a new disease, or another card's details opening, and follow their line when the card moves.
	 */
	let detail: 'harm' | 'babies' | null = $state(null);
	let detailFrom: HTMLButtonElement | undefined;
	let detailBox = $state<HTMLDivElement>();
	let detailAt = $state({ left: 0, top: 0 });
	const detailText = $derived(detail === 'harm' ? harm?.hover : detail === 'babies' ? harm?.babiesHover : '');
	const detailId = $derived(`harm-detail-${region.id}`);
	/** Room kept between the details and the window's edge. */
	const EDGE = 8;
	/** The least height of card body the details may lie over: about two lines of their text. */
	const MIN_INSET = 40;
	/** Where the line was when the details were last placed, so a scroll that leaves it put is ignored. */
	let lineAt = { left: 0, top: 0 };
	/** Whether the details scroll inside: they then take keyboard focus, so arrow keys reach the rest. */
	let detailScrolls = $state(false);
	/** Sent on the window when a card opens its details, so the others close theirs. */
	const DETAIL_OPENED = 'harm-detail-opened';
	function toggleDetail(which: 'harm' | 'babies', e: MouseEvent) {
		if (detail === which) return closeDetail(false);
		detailFrom = e.currentTarget as HTMLButtonElement;
		const r = detailFrom.getBoundingClientRect();
		detailAt = { left: r.left, top: r.bottom + 4 };
		detail = which;
		dispatchEvent(new CustomEvent(DETAIL_OPENED, { detail: region.id }));
	}
	function closeDetail(refocus: boolean) {
		detail = null;
		if (refocus) detailFrom?.focus();
	}
	/**
	 * Where the details go: below their line, else above it, else beside the card, whichever first
	 * stays inside the window and clear of every card's header and city disc, as cards are (6.17).
	 * Covering another card's body is allowed. With none clear they lie over their own card's body,
	 * below its header and as wide as the card, scrolling inside it, which no other header or disc
	 * can reach. Only when even that is off the window or too short do they close, focus on the line.
	 */
	function placeDetail() {
		if (!detailBox || !detailFrom || !element) return;
		// Measured at their own size, not the size the inset spot last gave them.
		detailBox.style.width = '';
		detailBox.style.maxHeight = '';
		const box = detailBox.getBoundingClientRect();
		const line = detailFrom.getBoundingClientRect();
		const card = element.getBoundingClientRect();
		const { width: w, height: h } = box;
		const clampX = (l: number) => Math.max(EDGE, Math.min(l, innerWidth - EDGE - w));
		const clampY = (t: number) => Math.max(EDGE, Math.min(t, innerHeight - EDGE - h));
		const tries = [
			{ left: clampX(line.left), top: line.bottom + 4 },
			{ left: clampX(line.left), top: line.top - 4 - h },
			{ left: card.right + 4, top: clampY(line.top) },
			{ left: card.left - 4 - w, top: clampY(line.top) }
		];
		const ownHead = element.querySelector(':scope > header');
		const headEls = [...document.querySelectorAll('section.card > header')];
		const headers = headEls.map((el) => el.getBoundingClientRect());
		const others = headEls.filter((el) => el !== ownHead).map((el) => el.getBoundingClientRect());
		const cities = discs();
		const clear = (l: number, t: number) =>
			l >= EDGE - 0.5 &&
			t >= EDGE - 0.5 &&
			l + w <= innerWidth - EDGE + 0.5 &&
			t + h <= innerHeight - EDGE + 0.5 &&
			headers.every((r) => l >= r.right || l + w <= r.left || t >= r.bottom || t + h <= r.top) &&
			cities.every((c) => {
				const dx = c.x - Math.max(l, Math.min(c.x, l + w));
				const dy = c.y - Math.max(t, Math.min(c.y, t + h));
				return dx * dx + dy * dy >= c.r * c.r;
			});
		let spot = tries.find((p) => clear(p.left, p.top));
		if (!spot) {
			// Inside the card's body, keeping the line in sight: below it, else between the header and
			// it, else (too little room either side) over the whole body.
			const head = Math.max(ownHead?.getBoundingClientRect().bottom ?? card.top, 0);
			const foot = Math.min(card.bottom, innerHeight);
			const free = (top: number, bottom: number) =>
				others.every(
					(r) => card.left >= r.right || card.right <= r.left || top >= r.bottom || bottom <= r.top
				) &&
				cities.every((c) => {
					const dx = c.x - Math.max(card.left, Math.min(c.x, card.right));
					const dy = c.y - Math.max(top, Math.min(c.y, bottom));
					return dx * dx + dy * dy >= c.r * c.r;
				});
			const inset = [
				{ top: Math.max(line.bottom + 4, head), bottom: foot },
				{ top: head, bottom: Math.min(line.top - 4, foot) },
				{ top: head, bottom: foot }
			].find((r) => r.bottom - r.top >= MIN_INSET && free(r.top, r.bottom));
			if (card.left < 0 || card.right > innerWidth || !inset) return closeDetail(true);
			detailBox.style.width = `${card.width}px`;
			detailBox.style.maxHeight = `${inset.bottom - inset.top}px`;
			spot = { left: card.left, top: inset.top };
		}
		lineAt = { left: line.left, top: line.top };
		detailScrolls = detailBox.scrollHeight > detailBox.clientHeight + 1;
		if (spot.left !== detailAt.left || spot.top !== detailAt.top) detailAt = spot;
	}
	// Placed once the box is drawn (its size depends on its text).
	$effect(() => {
		if (detailBox) untrack(placeDetail);
	});
	$effect(() => {
		void disease.id;
		detail = null;
	});
	// The details are fixed to the window, so when the card moves (a zoom, a new map, a new window
	// height) they move with their line rather than being left behind over another card.
	$effect(() => {
		void x;
		void y;
		void docked;
		if (!untrack(() => detail) || !detailFrom) return;
		tick().then(placeDetail);
	});
	let harmLine = $state<HTMLButtonElement>();
	let babiesLine = $state<HTMLButtonElement>();
	/**
	 * The line that has focus. A focused element taken out of the page may lose focus before this card
	 * is destroyed, so it is tracked here, and cleared only when focus leaves a line still on the page.
	 */
	let focusedLine: 'harm' | 'babies' | null = null;
	function lineBlurred(which: 'harm' | 'babies', e: FocusEvent) {
		const el = e.currentTarget as HTMLElement;
		// Focus moving to the other line has named it by now, so only this line's name is cleared.
		setTimeout(() => {
			if (focusedLine === which && el.isConnected && document.activeElement !== el) focusedLine = null;
		});
	}
	onDestroy(() => {
		const which = detail ?? focusedLine;
		if (which) carried = { region: region.id, which, open: detail !== null };
	});
	// The new copy can mount before the old one is destroyed, so it looks once both have run.
	onMount(() => {
		tick().then(() => {
			if (carried?.region !== region.id) return;
			const { which, open: wasOpen } = carried;
			carried = null;
			const line = which === 'harm' ? harmLine : babiesLine;
			if (!line) return;
			line.focus();
			// Opened once the page has framed the cards anew, so they are placed beside the line's
			// final spot rather than where the card first lands.
			if (wasOpen)
				requestAnimationFrame(() => {
					if (!line.isConnected) return;
					detailFrom = line;
					detail = which;
				});
		});
	});
	$effect(() => {
		if (!detail) return;
		const onkey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeDetail(true);
		};
		const ondown = (e: PointerEvent) => {
			const n = e.target as Node;
			if (!detailBox?.contains(n) && !detailFrom?.contains(n)) closeDetail(false);
		};
		// Only a new window width closes them, as for the blurb's "more": a phone's address bar showing
		// or hiding changes only the height.
		const windowWidth = innerWidth;
		const onresize = () => {
			if (innerWidth !== windowWidth) closeDetail(false);
		};
		const onopened = (e: Event) => {
			if ((e as CustomEvent<number | string>).detail !== region.id) closeDetail(false);
		};
		// A scroll inside the details themselves (a long text) keeps them open, as does one that leaves
		// their line where it was (the page settling back to the top as the cards float again).
		const onscroll = (e: Event) => {
			if (e.target instanceof Node && detailBox?.contains(e.target)) return;
			const r = detailFrom?.getBoundingClientRect();
			if (r && Math.abs(r.left - lineAt.left) < 0.5 && Math.abs(r.top - lineAt.top) < 0.5) return;
			closeDetail(false);
		};
		addEventListener('keydown', onkey);
		addEventListener('pointerdown', ondown);
		addEventListener('resize', onresize);
		addEventListener('scroll', onscroll, true);
		addEventListener(DETAIL_OPENED, onopened);
		return () => {
			removeEventListener(DETAIL_OPENED, onopened);
			removeEventListener('keydown', onkey);
			removeEventListener('pointerdown', ondown);
			removeEventListener('resize', onresize);
			removeEventListener('scroll', onscroll, true);
		};
	});
</script>

<section
	bind:this={element}
	bind:offsetWidth={width}
	bind:offsetHeight={height}
	class="card"
	class:open
	class:docked
	style:left={docked ? null : `${x}px`}
	style:top={docked ? null : `${y}px`}
	style:max-height={docked || maxHeight === undefined ? null : `${maxHeight}px`}
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
	<p
		class="population"
		title={`Each dot stands for ${peoplePerDot.toLocaleString('en-GB')} ${peoplePerDot === 1 ? 'person' : 'people'}.`}
	>
		{startingPeople} people at the start
	</p>
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
			lines={2}
		/>
		{#if disease.mortalityBasis === 'era'}
			<p class="note" title={ERA_DEATH_RATE}>{ERA_DEATH_RATE_SHORT}</p>
		{/if}
	{/if}
	{#if t}
		<p class="counts">
			<span
				><i style:background={COLOURS.silent}></i>{people(t.counts.silent)}
				{incubatingOnly ? 'infected, not ill yet' : 'spreading unaware'}</span
			>
			<span><i style:background={COLOURS.symptomatic}></i>{people(t.counts.symptomatic)} ill</span>
			<span><i style:background={COLOURS.recovered}></i>{people(t.counts.recovered)} recovered</span>
			{#if harm?.line}
				<button
					class="harm"
					bind:this={harmLine}
					onfocus={() => (focusedLine = 'harm')}
					onblur={(e) => lineBlurred('harm', e)}
					aria-expanded={detail === 'harm'}
					aria-controls={detail === 'harm' ? detailId : undefined}
					onclick={(e) => toggleDetail('harm', e)}>{harm.line}</button
				>
			{/if}
			<span><i style:background={COLOURS.deceased}></i>{t.deaths.toLocaleString()} died</span>
			{#if harm?.babies}
				<button
					class="harm"
					bind:this={babiesLine}
					onfocus={() => (focusedLine = 'babies')}
					onblur={(e) => lineBlurred('babies', e)}
					aria-expanded={detail === 'babies'}
					aria-controls={detail === 'babies' ? detailId : undefined}
					onclick={(e) => toggleDetail('babies', e)}>{harm.babies}</button
				>
			{/if}
		</p>
	{/if}
	{#if detail && detailText}
		<!-- A region that scrolls must take focus so keyboard users can scroll it (WCAG 2.1.1). -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="detail"
			id={detailId}
			role="region"
			aria-label="{region.name}: {detail === 'harm'
				? 'lasting harm'
				: 'babies harmed or pregnancies lost'}, what is counted"
			bind:this={detailBox}
			tabindex={detailScrolls ? 0 : undefined}
			style:left="{detailAt.left}px"
			style:top="{detailAt.top}px"
		>
			{#each detailText.split('\n') as line, k (k)}
				<p>{line}</p>
			{/each}
		</div>
	{/if}
	<button class="seed" onclick={onseed} title={seedHover}>{seedLabel}</button>
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
		z-index: 2;
		overflow-y: auto;
	}
	.card.docked {
		position: static;
		flex: 0 0 200px;
		box-shadow: none;
	}
	.population {
		margin: 0 0 2px;
		color: #9fb3c8;
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
	/* An open card scrolls inside: its name and toggles stay in view so it can be closed. */
	.card.open header {
		position: sticky;
		top: -8px;
		z-index: 1;
		margin-top: -8px;
		padding: 8px 0 4px;
		background: rgb(17, 33, 52);
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
	/* A line that opens its details: reads as text, with a dotted underline to show it opens. */
	.counts .harm {
		align-self: flex-start;
		/* Taller to tap, with the same line spacing; above the next row, which would cover its lower part. */
		position: relative;
		padding: 5px 0 5px 14px;
		margin: -5px 0;
		border: none;
		background: none;
		font: inherit;
		text-align: left;
		color: #9fb3c8;
		text-decoration: underline dotted rgba(159, 179, 200, 0.6);
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.counts .harm[aria-expanded='true'] {
		color: #e6edf5;
	}
	.counts .harm:focus-visible {
		outline: 2px solid #8fb8ff;
		outline-offset: 1px;
	}
	/* Over the map, fixed to the window, so it never changes the card's size or scrolls with it. */
	.detail {
		position: fixed;
		z-index: 30;
		width: max-content;
		max-width: min(300px, calc(100vw - 16px));
		max-height: calc(100vh - 16px);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 8px 10px;
		background: #11233a;
		border: 1px solid #2a4562;
		border-radius: 6px;
		color: #c9d6e3;
		font-size: 12px;
		box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
	}
	.detail p {
		margin: 0 0 4px;
	}
	.detail p:last-child {
		margin-bottom: 0;
	}
	.counts i {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 6px;
	}
</style>
