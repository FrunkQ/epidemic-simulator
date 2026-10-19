import { describe, expect, it } from 'vitest';
import { microcosm } from '../../src/lib/config/scenarios';
import { createSimulation } from '../../src/lib/sim/engine';
import { Renderer } from '../../src/lib/sim/render';
import { Transit } from '../../src/lib/sim/transit';

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
(globalThis as { Path2D?: unknown }).Path2D ??= NullPath;

const viewport = { width: 1280, height: 720 };
const ctx = nullContext();
/** World units a dot can move in one tick and still glide (render.ts GLIDE_LIMIT). */
const LIMIT = 4;

type Sim = ReturnType<typeof createSimulation>;
interface Positions {
	x: Float32Array;
	y: Float32Array;
	route: Int16Array;
	activeCount: number;
}
const agentsOf = (sim: Sim) => (sim as unknown as { agents: Positions }).agents;
/** Where the renderer drew each dot on the last frame (world units). */
function drawn(sim: Sim): { x: Float32Array; y: Float32Array } {
	const r = (sim as unknown as { renderer: { atX: Float32Array; atY: Float32Array } }).renderer;
	return { x: r.atX, y: r.atY };
}

describe('gliding between ticks', () => {
	const sim = createSimulation(microcosm(0), { seed: 3, diseaseId: 'measles' });
	const agents = agentsOf(sim);

	it('draws a dot part way between its last two positions, by the fraction of the next tick', () => {
		sim.step(5);
		sim.render(ctx, viewport, 0, 1);
		const fromX = Float32Array.from(agents.x);
		const fromY = Float32Array.from(agents.y);
		const fromRoute = Int16Array.from(agents.route);
		sim.step(1);
		let moved = 0;
		for (const alpha of [0, 0.25, 0.5, 1]) {
			sim.render(ctx, viewport, 0, alpha);
			const { x, y } = drawn(sim);
			for (let i = 0; i < agents.activeCount; i++) {
				// A dot that boarded or landed in this tick jumps; the next test covers those.
				if (agents.route[i] !== fromRoute[i]) continue;
				const dx = agents.x[i] - fromX[i];
				const dy = agents.y[i] - fromY[i];
				expect(dx * dx + dy * dy).toBeLessThanOrEqual(LIMIT * LIMIT);
				if (alpha === 0.5 && dx !== 0) moved++;
				expect(x[i]).toBeCloseTo(fromX[i] + dx * alpha, 2);
				expect(y[i]).toBeCloseTo(fromY[i] + dy * alpha, 2);
			}
		}
		expect(moved).toBeGreaterThan(agents.activeCount / 2);
	});

	it('draws a dot that jumped (boarded or landed) where it is, not part way', () => {
		sim.render(ctx, viewport, 0, 1);
		const i = 7;
		const fromX = agents.x[i];
		sim.step(1);
		agents.x[i] = fromX + 50; // as if it had just landed somewhere else
		sim.render(ctx, viewport, 0, 0.5);
		expect(drawn(sim).x[i]).toBe(agents.x[i]);
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

	it('draws the new run as it is after a restart, even a second one at the same tick while paused', () => {
		for (const seed of [11, 12]) {
			sim.setup(microcosm(0), 'measles', seed);
			sim.render(ctx, viewport, 0, 0.5);
			const { x, y } = drawn(sim);
			for (let i = 0; i < agents.activeCount; i++) {
				expect(x[i]).toBe(agents.x[i]);
				expect(y[i]).toBe(agents.y[i]);
			}
		}
	});
});

describe('gliding planes', () => {
	/** The renderer's private glide steps, reached for this test. */
	interface Glide {
		place(agents: Positions, transit: Transit, tick: number, alpha: number): void;
		planeAt(transit: Transit, p: number, axis: number): number;
	}
	const agents: Positions = {
		x: new Float32Array(4),
		y: new Float32Array(4),
		route: new Int16Array(4),
		activeCount: 0
	};

	function flyOneTick(route: number): number {
		const r = new Renderer(4) as unknown as Glide;
		const transit = new Transit(4, 3);
		transit.planeRoute.fill(-1);
		transit.planeRoute[0] = 0;
		transit.planeX[0] = 100;
		r.place(agents, transit, 1, 1);
		transit.planeRoute[0] = route;
		transit.planeX[0] = 160;
		r.place(agents, transit, 2, 0.5);
		return r.planeAt(transit, 0, 0);
	}

	it('glides a plane along the route it is on', () => {
		expect(flyOneTick(0)).toBeCloseTo(130, 4);
	});

	it('draws a plane that changed route (a new flight) where it is', () => {
		expect(flyOneTick(1)).toBe(160);
	});
});
