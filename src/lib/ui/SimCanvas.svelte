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
		/** Called after the user pans or zooms. */
		onview?: () => void;
	}

	let { sim, ontelemetry, onresize, onview }: Props = $props();
	let canvas: HTMLCanvasElement;
	let host: HTMLDivElement;

	// Pan with one pointer, pinch-zoom with two, wheel to zoom at the cursor.
	// Not reactive on purpose: only the event handlers read it.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pointers = new Map<number, { x: number; y: number }>();
	let pinchDistance = 0;

	function local(e: PointerEvent | WheelEvent) {
		const r = canvas.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function onpointerdown(e: PointerEvent) {
		canvas.setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, local(e));
		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
		}
	}

	function onpointermove(e: PointerEvent) {
		const prev = pointers.get(e.pointerId);
		if (!prev) return;
		const now = local(e);
		pointers.set(e.pointerId, now);
		if (pointers.size === 1) {
			sim.view.x -= (now.x - prev.x) / sim.view.scale;
			sim.view.y -= (now.y - prev.y) / sim.view.scale;
			onview?.();
		} else if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			const d = Math.hypot(a.x - b.x, a.y - b.y);
			if (pinchDistance > 0) {
				sim.view.zoomAt(d / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
				onview?.();
			}
			pinchDistance = d;
		}
	}

	function onpointerup(e: PointerEvent) {
		pointers.delete(e.pointerId);
		pinchDistance = 0;
	}

	function onwheel(e: WheelEvent) {
		e.preventDefault();
		const p = local(e);
		sim.view.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
		onview?.();
	}

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
	<canvas
		bind:this={canvas}
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
		{onwheel}
		aria-label="Map of the populations. Drag to move around, scroll or pinch to zoom."
	></canvas>
</div>

<style>
	.host {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
		cursor: grab;
	}
	canvas:active {
		cursor: grabbing;
	}
</style>
