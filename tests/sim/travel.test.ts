import { describe, expect, it } from 'vitest';
import { microcosm } from '../../src/lib/config/scenarios';
import { START_MAPS } from '../../src/lib/config/startMaps.generated';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import { generateWorld } from '../../src/lib/sim/geography';
import { State } from '../../src/lib/sim/types';

/**
 * Follow every traveller who sets off while silently infected and record whether they are
 * still infectious when they arrive, per kind of route.
 */
function arrivals(seed: number) {
	const world = generateWorld(START_MAPS[0].seed);
	const scenario = microcosm(0);
	for (const r of scenario.regions) {
		r.vaccinatedFull = 0;
		r.vaccinatedPartial = 0;
	}
	scenario.travelScale = 3;
	const sim = createSimulation(scenario, { seed, diseaseId: 'measles', world });
	sim.send({ type: 'seed', region: 1, count: 20 });
	const a = sim.agents;
	const leftSilent = new Map<number, string>();
	const result: Record<string, { infectious: number; total: number }> = {
		air: { infectious: 0, total: 0 },
		ferry: { infectious: 0, total: 0 },
		road: { infectious: 0, total: 0 }
	};
	const wasOnRoute = new Int16Array(a.capacity).fill(-1);
	for (let t = 0; t < 60 * TICKS_PER_DAY; t++) {
		sim.step(1);
		for (let i = 0; i < a.activeCount; i++) {
			const r = a.route[i];
			if (r >= 0 && wasOnRoute[i] < 0 && a.state[i] === State.SILENT) leftSilent.set(i, sim.routes[r].kind);
			if (r < 0 && wasOnRoute[i] >= 0 && leftSilent.has(i)) {
				const kind = leftSilent.get(i)!;
				result[kind].total++;
				if (a.state[i] === State.SILENT || a.state[i] === State.SYMPTOMATIC) result[kind].infectious++;
				leftSilent.delete(i);
			}
			wasOnRoute[i] = r;
		}
	}
	return result;
}

describe('lesson 2: fast travel beats burnout, slow travel does not', () => {
	it('silent measles cases still spread when a plane lands, but not when a ferry docks', () => {
		const totals = { air: { infectious: 0, total: 0 }, ferry: { infectious: 0, total: 0 } };
		for (const seed of [1, 2, 3]) {
			const r = arrivals(seed);
			for (const k of ['air', 'ferry'] as const) {
				totals[k].infectious += r[k].infectious;
				totals[k].total += r[k].total;
			}
		}
		expect(totals.air.total).toBeGreaterThan(10);
		expect(totals.ferry.total).toBeGreaterThan(5);
		expect(totals.air.infectious / totals.air.total).toBeGreaterThanOrEqual(0.9);
		expect(1 - totals.ferry.infectious / totals.ferry.total).toBeGreaterThanOrEqual(0.9);
	});
});

describe('travel keeps populations level', () => {
	it('moves people both ways without draining any city', () => {
		const world = generateWorld(START_MAPS[0].seed);
		const sim = createSimulation(microcosm(0), { seed: 9, diseaseId: 'flu', world });
		const before = sim.snapshot().regions.map((r) => r.dots);
		sim.step(60 * TICKS_PER_DAY);
		const snap = sim.snapshot();
		expect(snap.travelling).toBeGreaterThan(0);
		snap.regions.forEach((r, i) => {
			const now = Object.values({ ...r.counts, everInfected: 0 }).reduce((a, b) => a + b, 0);
			expect(Math.abs(now - before[i]) / before[i]).toBeLessThan(0.1);
		});
	});
});
