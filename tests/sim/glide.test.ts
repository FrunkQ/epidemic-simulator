import { describe, expect, it } from 'vitest';
import { microcosm } from '../../src/lib/config/scenarios';
import { createSimulation } from '../../src/lib/sim/engine';

/** A canvas that accepts every call and draws nothing. */
function nullContext(): CanvasRenderingContext2D {
	const target = { getTransform: () => ({ a: 1 }) };
	return new Proxy(target, {
		get: (t, key) => (key in t ? t[key as keyof typeof t] : () => undefined),
		set: () => true
	}) as unknown as CanvasRenderingContext2D;
}

class NullPath {
	moveTo() {}
	lineTo() {}
	closePath() {}
	rect() {}
	arc() {}
}

const viewport = { width: 1280, height: 720 };

/** Where the renderer drew each dot on the last frame (world units). */
function drawn(sim: ReturnType<typeof createSimulation>): { x: Float32Array; y: Float32Array } {
	const r = (sim as unknown as { renderer: { atX: Float32Array; atY: Float32Array } }).renderer;
	return { x: r.atX, y: r.atY };
}

describe('gliding between ticks', () => {
	(globalThis as { Path2D?: unknown }).Path2D ??= NullPath;
	const sim = createSimulation(microcosm(0), { seed: 3, diseaseId: 'measles' });
	const agents = (sim as unknown as { agents: { x: Float32Array; y: Float32Array; activeCount: number } })
		.agents;
	const ctx = nullContext();

	it('draws a dot part way between its last two positions, by the fraction of the next tick', () => {
		sim.step(5);
		sim.render(ctx, viewport, 0, 1);
		const fromX = Float32Array.from(agents.x);
		const fromY = Float32Array.from(agents.y);
		sim.step(1);
		const toX = Float32Array.from(agents.x);
		const toY = Float32Array.from(agents.y);
		let moved = 0;
		for (const alpha of [0, 0.25, 0.5, 1]) {
			sim.render(ctx, viewport, 0, alpha);
			const { x, y } = drawn(sim);
			for (let i = 0; i < agents.activeCount; i++) {
				const dx = toX[i] - fromX[i];
				const dy = toY[i] - fromY[i];
				if (dx * dx + dy * dy > 16) continue; // boarded or landed: drawn where it is
				if (alpha === 0.5 && dx !== 0) moved++;
				expect(x[i]).toBeCloseTo(fromX[i] + dx * alpha, 2);
				expect(y[i]).toBeCloseTo(fromY[i] + dy * alpha, 2);
			}
		}
		expect(moved).toBeGreaterThan(agents.activeCount / 2);
	});

	it('draws the latest positions after a jump of several ticks', () => {
		sim.step(3);
		sim.render(ctx, viewport, 0, 0.5);
		const { x, y } = drawn(sim);
		for (let i = 0; i < agents.activeCount; i++) {
			expect(x[i]).toBe(agents.x[i]);
			expect(y[i]).toBe(agents.y[i]);
		}
	});
});
