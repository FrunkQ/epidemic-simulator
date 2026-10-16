<script lang="ts">
	import { DISEASES, DISEASE_GROUPS } from '../config/diseases';
	import type { DiseaseId, Speed } from '../sim/types';
	import { onMount, tick } from 'svelte';
	import { BLURB_LINES, fitSentences, sentences } from './blurb';
	import { SPEEDS, speedTitle } from './speeds';

	interface Props {
		diseaseId: DiseaseId;
		speed: Speed;
		day: number;
		ondisease: (id: DiseaseId) => void;
		onspeed: (s: Speed) => void;
		onrestart: () => void;
		onnewmap: () => void;
	}
	let { diseaseId, speed, day, ondisease, onspeed, onrestart, onnewmap }: Props = $props();

	/** The picker's headings, in DISEASE_GROUPS order. */
	const groups = Object.entries(DISEASE_GROUPS);

	// The blurb shows as many whole sentences as fit in BLURB_LINES lines; "more" shows the rest
	// over the map, so opening it never changes the stage (10).
	let blurb = $state<HTMLParagraphElement>();
	let measure: HTMLParagraphElement;
	let moreButton = $state<HTMLButtonElement>();
	let overlay = $state<HTMLDivElement>();
	let full = $derived(DISEASES[diseaseId].blurb);
	let parts = $derived(sentences(full));
	let shown = $state(Infinity);
	/** The first sentence alone is longer than the lines allowed (shown whole anyway). */
	let overlong = $state(false);
	let moreOpen = $state(false);
	let clipped = $derived(shown < parts.length);

	/** Fit the blurb to its width now: called before the paint, whenever its width or text can change. */
	function fit() {
		if (!blurb || !measure) return;
		measure.style.width = `${blurb.clientWidth}px`;
		const [text, more] = measure.children as unknown as [HTMLElement, HTMLElement];
		more.hidden = true;
		text.textContent = 'x';
		const line = measure.offsetHeight;
		const fits = (t: string, withMore: boolean) => {
			text.textContent = t;
			more.hidden = !withMore;
			return measure.offsetHeight <= BLURB_LINES * line + 0.5;
		};
		shown = fitSentences(parts, fits);
		overlong = !fits(parts[0], parts.length > 1);
	}

	$effect(() => {
		void parts;
		moreOpen = false;
		fit();
	});
	// Nothing left to show: no "less" button to close it with.
	$effect(() => {
		if (!clipped) moreOpen = false;
	});

	onMount(() => {
		// A window resize event comes before this frame's resize observers and paint, so the page
		// sees the bar's final height when it frames the map.
		// The overlay is placed when it opens, so a new width closes it rather than leave it astray.
		let width = blurb?.clientWidth ?? 0;
		const refit = () => {
			if (blurb && blurb.clientWidth !== width) {
				width = blurb.clientWidth;
				moreOpen = false;
			}
			fit();
		};
		const onresize = () => {
			moreOpen = false;
			refit();
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
		// Anything else that changes its width (a scrollbar coming or going) is caught a frame late.
		const observer = new ResizeObserver(refit);
		if (blurb) observer.observe(blurb);
		addEventListener('resize', onresize);
		addEventListener('keydown', onkey);
		addEventListener('pointerdown', ondown);
		tick().then(() => {
			width = blurb?.clientWidth ?? 0;
			fit();
		});
		return () => {
			observer.disconnect();
			removeEventListener('resize', onresize);
			removeEventListener('keydown', onkey);
			removeEventListener('pointerdown', ondown);
		};
	});
</script>

<header class="bar">
	<h1>Epidemic simulator</h1>
	<label class="disease">
		<span>Disease</span>
		<select value={diseaseId} onchange={(e) => ondisease(e.currentTarget.value as DiseaseId)}>
			{#each groups as [group, label] (group)}
				<optgroup {label}>
					{#each Object.values(DISEASES).filter((d) => d.group === group) as d (d.id)}
						<option value={d.id}>{d.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</label>
	<p class="blurb" bind:this={blurb} data-overlong={overlong || undefined}>
		{#if clipped}
			<span aria-hidden="true">{parts.slice(0, shown).join(' ')}</span>
			<span class="sr-only">{full}</span>
			<button
				class="more"
				bind:this={moreButton}
				aria-expanded={moreOpen}
				aria-controls={moreOpen ? 'blurb-full' : undefined}
				onclick={() => (moreOpen = !moreOpen)}>{moreOpen ? 'less' : 'more'}</button
			>
		{:else}
			{full}
		{/if}
	</p>
	<p class="blurb measure" bind:this={measure} aria-hidden="true">
		<span></span>
		<button class="more" tabindex="-1">more</button>
	</p>
	{#if moreOpen}
		<div
			class="full"
			id="blurb-full"
			bind:this={overlay}
			style:left="{blurb?.offsetLeft ?? 0}px"
			style:min-width="{blurb?.offsetWidth ?? 0}px"
		>
			{full}
		</div>
	{/if}
	<div class="speed" role="group" aria-label="Speed">
		{#each SPEEDS as s (s.value)}
			<button
				class:active={speed === s.value}
				aria-label={s.value === 0 ? s.label : `${s.label} (${s.short})`}
				aria-pressed={speed === s.value}
				title={speedTitle(s.value, s.label)}
				onclick={() => onspeed(s.value)}>{s.short}</button
			>
		{/each}
	</div>
	<span class="day">Day {day}</span>
	<button onclick={onrestart}>Restart</button>
	<button onclick={onnewmap}>New map</button>
</header>

<style>
	.bar {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		padding: 8px 16px;
		background: #11233a;
		border-bottom: 1px solid #22405f;
		font-size: 13px;
	}
	h1 {
		font-size: 17px;
		margin: 0;
		letter-spacing: 0.02em;
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.blurb {
		margin: 0;
		/* Small enough that the bar stays one row at 1280 px with wider fonts (DejaVu Sans on Linux):
		   a second row takes height from the map and can dock the cards at a target size (10). */
		flex: 1 1 200px;
		color: #9fb3c8;
	}
	/* Laid out like the blurb, off screen, to find how many sentences fit. */
	.measure {
		position: absolute;
		left: -10000px;
		top: 0;
		visibility: hidden;
		flex: none;
	}
	.blurb .more {
		margin-left: 4px;
		padding: 0 2px;
		border: none;
		background: none;
		color: #9cc3ea;
		text-decoration: underline;
	}
	/* The whole blurb, over the map below the bar, so the stage keeps its size. */
	.full {
		position: absolute;
		top: 100%;
		z-index: 20;
		max-width: min(440px, calc(100% - 32px));
		box-sizing: border-box;
		padding: 8px 12px;
		background: #11233a;
		border: 1px solid #22405f;
		border-radius: 0 0 6px 6px;
		color: #c9d6e3;
		box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.speed {
		display: flex;
	}
	.speed button {
		min-width: 32px;
		border-radius: 0;
	}
	.speed button:first-child {
		border-radius: 6px 0 0 6px;
	}
	.speed button:last-child {
		border-radius: 0 6px 6px 0;
	}
	/* The chosen speed stands out at 6.3:1 against the others (WCAG asks 3:1), its text at 9.5:1. */
	.speed .active {
		background: #9cc3ea;
		color: #0b1a2e;
		font-weight: 600;
	}
	.day {
		font-variant-numeric: tabular-nums;
		min-width: 56px;
	}
	button,
	select {
		font: inherit;
		color: #e6edf5;
		background: #1d3a5a;
		border: 1px solid #3a6590;
		border-radius: 6px;
		padding: 3px 8px;
		cursor: pointer;
	}
</style>
