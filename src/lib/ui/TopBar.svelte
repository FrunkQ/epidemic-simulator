<script lang="ts">
	import { DISEASES } from '../config/diseases';
	import type { DiseaseId, Speed } from '../sim/types';

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

	const speeds: { value: Speed; label: string }[] = [
		{ value: 0, label: 'Paused' },
		{ value: 0.5, label: 'Slow' },
		{ value: 1, label: 'Normal' },
		{ value: 2, label: 'Fast' },
		{ value: 4, label: 'Very fast' }
	];
</script>

<header class="bar">
	<h1>Epidemic simulator</h1>
	<label class="disease">
		<span>Disease</span>
		<select value={diseaseId} onchange={(e) => ondisease(e.currentTarget.value as DiseaseId)}>
			{#each Object.values(DISEASES) as d (d.id)}
				<option value={d.id}>{d.name}</option>
			{/each}
		</select>
	</label>
	<p class="blurb">{DISEASES[diseaseId].blurb}</p>
	<div class="speed" role="group" aria-label="Speed">
		{#each speeds as s (s.value)}
			<button class:active={speed === s.value} onclick={() => onspeed(s.value)}>{s.label}</button>
		{/each}
	</div>
	<span class="day">Day {day}</span>
	<button onclick={onrestart}>Restart</button>
	<button onclick={onnewmap}>New map</button>
</header>

<style>
	.bar {
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
		flex: 1 1 240px;
		color: #9fb3c8;
	}
	.speed {
		display: flex;
	}
	.speed button {
		border-radius: 0;
	}
	.speed button:first-child {
		border-radius: 6px 0 0 6px;
	}
	.speed button:last-child {
		border-radius: 0 6px 6px 0;
	}
	.speed .active {
		background: #3a6590;
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
