import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { microcosm } from '../../src/lib/config/scenarios';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import {
	SHADE_FLOOR,
	SHADE_FULL_SHARE,
	SPECK_MIN_CSS,
	paintSpecks,
	speckCap,
	speckMinSide,
	shadeStrength,
	speckSpots,
	speckStride,
	type Box,
	type MapLook,
	type SpeckFrame,
	type SpeckPeople
} from '../../src/lib/sim/specks';

/*
 * The two map views (§3). Both are drawing only: these check the specks match the people the cards
 * count, and that drawing either view, or switching between them, never changes a run.
 */

const DEAD = 1;
const ILL = 2;
const SILENT = 3;

function people(perDot: number, dots: [dead: number, ill: number, silent: number][]): SpeckPeople {
	const col = (k: number) => Int32Array.from(dots.map((d) => d[k]));
	return {
		perDot,
		dead: col(0),
		ill: col(1),
		silentSymptomatic: col(2),
		silentAsymptomatic: new Int32Array(dots.length)
	};
}

function frame(count: number, at: [number, number][], over: Partial<SpeckFrame> = {}): SpeckFrame {
	return {
		list: Int32Array.from({ length: count }, (_, i) => i),
		count,
		x: Float32Array.from(at.map((p) => p[0])),
		y: Float32Array.from(at.map((p) => p[1])),
		ox: 0,
		oy: 0,
		scale: 1,
		patch: 10,
		minSide: 2,
		maxSide: 6,
		colours: { dead: DEAD, ill: ILL, silent: SILENT },
		...over
	};
}

const tally = (buf: Uint32Array) => {
	const out = { [DEAD]: 0, [ILL]: 0, [SILENT]: 0 } as Record<number, number>;
	for (const v of buf) if (v) out[v]++;
	return out;
};

describe('specks', () => {
	it('paints one speck per infected person, and counts exactly those', () => {
		const W = 100;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		const p = people(100, [
			[0, 3, 4],
			[2, 0, 1]
		]);
		const drawn = paintSpecks(
			buf,
			W,
			W,
			p,
			frame(2, [
				[30, 30],
				[70, 70]
			]),
			box
		);
		expect(drawn).toBe(3 + 4 + 1);
		// Each infected speck is 2 x 2 device pixels (the floor); their patches never meet here.
		const t = tally(buf);
		expect(t[ILL]).toBe(3 * 4);
		expect(t[SILENT]).toBe(5 * 4);
		expect(t[DEAD]).toBeGreaterThan(0);
	});

	it('draws a single case even when one person is far less than a pixel of ground', () => {
		const W = 40;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		// A patch 1 pixel across holding 100 people: each person is 1/100 of a pixel.
		expect(paintSpecks(buf, W, W, people(100, [[0, 0, 1]]), frame(1, [[20, 20]], { patch: 0.5 }), box)).toBe(
			1
		);
		expect(tally(buf)[SILENT]).toBe(4);
	});

	it("never covers an infected person with a death, even a neighbour dot's", () => {
		const W = 60;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		// Two dots on the same spot: one all dead, one with every person infected.
		const p = people(50, [
			[50, 0, 0],
			[0, 25, 25]
		]);
		paintSpecks(
			buf,
			W,
			W,
			p,
			frame(
				2,
				[
					[30, 30],
					[30, 30]
				],
				{ minSide: 1 }
			),
			box
		);
		const alone = new Uint32Array(W * W);
		paintSpecks(
			alone,
			W,
			W,
			people(50, [
				[0, 0, 0],
				[0, 25, 25]
			]),
			frame(
				2,
				[
					[30, 30],
					[30, 30]
				],
				{ minSide: 1 }
			),
			{
				x0: 0,
				y0: 0,
				x1: 0,
				y1: 0
			}
		);
		for (let k = 0; k < alone.length; k++) if (alone[k]) expect(buf[k]).toBe(alone[k]);
	});

	it('never draws a speck under SPECK_MIN_CSS CSS pixels, at any device scale', () => {
		for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.25, 3]) {
			const minSide = speckMinSide(dpr);
			expect(minSide / dpr, `dpr ${dpr}`).toBeGreaterThanOrEqual(SPECK_MIN_CSS);
			// One death and one case, each alone in its own dot, painted at that floor.
			const W = 80;
			const buf = new Uint32Array(W * W);
			const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
			const p = people(100, [
				[1, 0, 0],
				[0, 1, 0]
			]);
			const at: [number, number][] = [
				[20, 20],
				[60, 60]
			];
			paintSpecks(buf, W, W, p, frame(2, at, { patch: 0.5, minSide, maxSide: 6 }), box);
			const t = tally(buf);
			expect(t[DEAD], `dpr ${dpr}: a death`).toBe(minSide * minSide);
			expect(t[ILL], `dpr ${dpr}: a case`).toBe(minSide * minSide);
		}
	});

	it("shows ill and silent people in about their shares, even where a dot's specks overlap", () => {
		// The default frame: a patch about 3 device pixels across holding 100 people.
		const W = 400;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		const mixes: [number, number, number][] = [];
		const at: [number, number][] = [];
		for (let k = 0; k < 100; k++) {
			const ill = 10 + ((k * 37) % 80);
			mixes.push([0, ill, 100 - ill - (k % 7)]);
			at.push([20 + (k % 10) * 36, 20 + Math.floor(k / 10) * 36]);
		}
		paintSpecks(buf, W, W, people(100, mixes), frame(100, at, { patch: 1.5, minSide: 2 }), box);
		// Over the map, as a city's card counts them, the red share of lit pixels is within a few
		// points of the ill share (painting all the ill first, then the silent, gave 46% for 74%).
		const t = tally(buf);
		const ill = mixes.reduce((s, m) => s + m[1], 0);
		const infected = mixes.reduce((s, m) => s + m[1] + m[2], 0);
		expect(Math.abs(t[ILL] / (t[ILL] + t[SILENT]) - ill / infected)).toBeLessThan(0.04);
	});

	it('changes one speck when one person falls ill, so specks keep their colour from frame to frame', () => {
		const W = 100;
		const paint = (ill: number, silent: number) => {
			const buf = new Uint32Array(W * W);
			const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
			paintSpecks(
				buf,
				W,
				W,
				people(50, [[0, ill, silent]]),
				frame(1, [[50, 50]], { patch: 30, maxSide: 2 }),
				box
			);
			return buf;
		};
		for (const [ill, silent] of [
			[10, 20],
			[24, 1],
			[1, 30]
		]) {
			const before = paint(ill, silent);
			const after = paint(ill + 1, silent - 1);
			let changed = 0;
			for (let k = 0; k < before.length; k++)
				if (before[k] !== after[k]) {
					changed++;
					expect(after[k]).toBe(ILL);
				}
			// One 2 x 2 speck at most, less where a neighbour overlaps it.
			expect(changed).toBeGreaterThan(0);
			expect(changed).toBeLessThanOrEqual(4);
		}
	});

	it('clips a speck crossing the edge of the layer rather than leaving it out', () => {
		const W = 20;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		// One person a dot sits on the dot, here half off the left edge.
		paintSpecks(buf, W, W, people(1, [[0, 1, 0]]), frame(1, [[0, 10]], { patch: 1, minSide: 4 }), box);
		expect(tally(buf)[ILL]).toBeGreaterThan(0);
	});

	it('paints no more specks a dot than its patch can show apart', () => {
		const W = 60;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		const drawn = paintSpecks(
			buf,
			W,
			W,
			people(100, [[0, 50, 50]]),
			frame(1, [[30, 30]], { patch: 1.5 }),
			box
		);
		expect(drawn).toBe(speckCap(1.5, 2));
		expect(drawn).toBeLessThan(100);
	});

	it("clears last frame's specks, so a person who recovers leaves none behind", () => {
		const W = 60;
		const buf = new Uint32Array(W * W);
		const box: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
		paintSpecks(buf, W, W, people(100, [[3, 5, 5]]), frame(1, [[30, 30]]), box);
		expect(box.x1).toBeGreaterThan(box.x0);
		expect(paintSpecks(buf, W, W, people(100, [[0, 0, 0]]), frame(1, [[30, 30]]), box)).toBe(0);
		expect(buf.every((v) => v === 0)).toBe(true);
		expect(box.x1).toBeLessThanOrEqual(box.x0);
	});

	it("keeps each person at the same spot from frame to frame, inside their dot's patch", () => {
		for (const n of [1, 10, 100]) {
			const spots = speckSpots(n);
			expect(speckSpots(n)).toBe(spots);
			for (let k = 0; k < n; k++) expect(Math.hypot(spots[2 * k], spots[2 * k + 1])).toBeLessThanOrEqual(1);
			// The stride reaches every spot once.
			const seen = new Set(Array.from({ length: n }, (_, j) => (j * speckStride(n)) % n));
			expect(seen.size).toBe(n);
		}
		// One person per dot sits on the dot itself.
		expect([...speckSpots(1)]).toEqual([0, 0]);
	});
});

describe('shading', () => {
	it('shows any case at least at the floor, and is solid at a quarter of the dot', () => {
		expect(shadeStrength(0, 100)).toBe(0);
		expect(shadeStrength(1, 100)).toBeCloseTo(SHADE_FLOOR, 10);
		expect(shadeStrength(5, 100)).toBeCloseTo(0.5, 10);
		expect(shadeStrength(1, 1000)).toBeCloseTo(SHADE_FLOOR, 10);
		expect(shadeStrength(SHADE_FULL_SHARE * 100, 100)).toBe(1);
		expect(shadeStrength(100, 100)).toBe(1);
		let last = 0;
		for (let k = 1; k <= 100; k++) {
			const t = shadeStrength(k, 100);
			expect(t).toBeGreaterThanOrEqual(last);
			last = t;
		}
	});
});

/** A 2D context that does nothing, with the transform and canvas size the renderer reads. */
function stubContext(width: number, height: number): CanvasRenderingContext2D {
	const canvas = { width, height };
	return new Proxy({} as Record<string | symbol, unknown>, {
		get: (target, key) => {
			if (key === 'canvas') return canvas;
			if (key === 'getTransform') return () => ({ a: 1 });
			if (key in target) return target[key];
			return () => {};
		},
		set: (target, key, value) => {
			target[key] = value;
			return true;
		}
	}) as unknown as CanvasRenderingContext2D;
}

describe('the map view switch', () => {
	// Node has no OffscreenCanvas or ImageData: stand-ins, so the specks' painting really runs.
	const g = globalThis as Record<string, unknown>;
	const saved = { o: g.OffscreenCanvas, i: g.ImageData, p: g.Path2D };
	beforeAll(() => {
		g.Path2D = class {
			moveTo() {}
			lineTo() {}
			closePath() {}
		};
		g.ImageData = class {
			data: Uint8ClampedArray;
			constructor(
				public width: number,
				public height: number
			) {
				this.data = new Uint8ClampedArray(width * height * 4);
			}
		};
		g.OffscreenCanvas = class {
			constructor(
				public width: number,
				public height: number
			) {}
			getContext() {
				return stubContext(this.width, this.height);
			}
		};
	});
	afterAll(() => {
		g.OffscreenCanvas = saved.o;
		g.ImageData = saved.i;
		g.Path2D = saved.p;
	});

	const state = (sim: Simulation) => {
		const p = sim.people as unknown as Record<string, Int32Array>;
		return JSON.stringify({
			snapshot: sim.snapshot(),
			x: Array.from(sim.agents.x),
			people: ['susceptible', 'recovered', 'dead', 'ill', 'silentSymptomatic', 'silentAsymptomatic'].map(
				(k) => Array.from(p[k])
			)
		});
	};

	it('never changes a run: drawing either view, or switching every frame, matches not drawing at all', () => {
		const run = (looks: MapLook[] | null) => {
			const sim = createSimulation(microcosm(0), { seed: 7, diseaseId: 'measles' });
			sim.send({ type: 'seed', region: 2, count: 20 });
			const ctx = stubContext(1400, 900);
			for (let t = 0; t < 400; t++) {
				sim.step(1);
				if (looks) sim.render(ctx, { width: 1400, height: 900 }, t * 16, 1, looks[t % looks.length]);
			}
			return state(sim);
		};
		const none = run(null);
		expect(run(['specks'])).toBe(none);
		expect(run(['shading'])).toBe(none);
		expect(run(['specks', 'shading', 'shading'])).toBe(none);
	});

	it('draws a speck for every infected person outside a plane when the whole map is in view', () => {
		const sim = createSimulation(microcosm(0), { seed: 3, diseaseId: 'measles' });
		sim.send({ type: 'seed', region: 2, count: 20 });
		for (let t = 0; t < 300; t++) sim.step(1);
		// Every dot well inside the canvas, so every patch is on it.
		const a0 = sim.agents;
		const xs = Array.from(a0.x.subarray(0, a0.activeCount));
		const ys = Array.from(a0.y.subarray(0, a0.activeCount));
		const W = 4000;
		sim.view.fit(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), W, W, 200);
		sim.render(stubContext(W, W), { width: W, height: W }, 0, 1, 'specks');
		const a = sim.agents;
		const p = sim.people;
		let infected = 0;
		for (let i = 0; i < a.activeCount; i++) {
			const route = a.route[i];
			if (route >= 0 && sim.routes[route].kind === 'air') continue;
			infected += p.ill[i] + p.silentSymptomatic[i] + p.silentAsymptomatic[i];
		}
		expect(infected).toBeGreaterThan(100);
		const drawn = (sim as unknown as { renderer: { specksDrawn: number } }).renderer.specksDrawn;
		expect(drawn).toBe(infected);
	});
});
