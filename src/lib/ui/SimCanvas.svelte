<script lang="ts">
	import { onMount } from 'svelte';
	import { MAX_TICKS_PER_FRAME, TICKS_PER_SECOND } from '../sim/constants';
	import type { Simulation } from '../sim/engine';
	import type { Telemetry } from '../sim/types';

	interface Props {
		sim: Simulation;
		/** Called about 10 times a second with a fresh snapshot. */
		ontelemetry: (t: Telemetry) => void;
		/** Called when the canvas is resized, so the parent can frame the camera. */
		onresize?: (width: number, height: number) => void;
	}

	let { sim, ontelemetry, onresize }: Props = $props();
	let canvas: HTMLCanvasElement;
	let host: HTMLDivElement;

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		let width = 0;
		let height = 0;
		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			width = host.clientWidth;
			height = host.clientHeight;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			onresize?.(width, height);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();

		let last = performance.now();
		let lastPublish = 0;
		let carry = 0;
		let frame = 0;
		const loop = (now: number) => {
			const dt = Math.min(250, now - last);
			last = now;
			// Fixed timestep: turn elapsed time into whole ticks, capped per frame.
			carry += (dt / 1000) * TICKS_PER_SECOND * sim.speed;
			let due = Math.floor(carry);
			carry -= due;
			if (due > MAX_TICKS_PER_FRAME) due = MAX_TICKS_PER_FRAME;
			if (due > 0) sim.step(due);
			sim.render(ctx, { width, height });
			if (now - lastPublish >= 100) {
				lastPublish = now;
				ontelemetry(sim.snapshot());
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
</script>

<div class="host" bind:this={host}>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.host {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
