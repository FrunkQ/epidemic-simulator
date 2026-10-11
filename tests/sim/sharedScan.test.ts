import { describe, expect, it, vi } from 'vitest';
import { microcosm } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import type { DiseaseId } from '../../src/lib/sim/types';

/**
 * The shared neighbour scan for several diseases at once (6.12) is only reached with two or more
 * disease slots, which arrive with 3c. Until then this test runs it by adding a second, inert
 * disease slot (nobody ever infected) to every spread step: the results must be exactly those of
 * the one-disease fast path, seed for seed.
 */
const inert = vi.hoisted(() => ({ on: false, calls: 0 }));

vi.mock('../../src/lib/sim/disease', async (importOriginal) => {
	const real = await importOriginal<typeof import('../../src/lib/sim/disease')>();
	const { People } = await import('../../src/lib/sim/people');
	const extra = new WeakMap<
		object,
		{ people: InstanceType<typeof People>; exposure: InstanceType<typeof real.Exposure> }
	>();
	return {
		...real,
		transmit: (...args: Parameters<typeof real.transmit>) => {
			const [agents, grid, slots, exposure, tick, rng, hooks, silentSpread] = args;
			if (!inert.on) return real.transmit(...args);
			inert.calls++;
			let second = extra.get(slots[0]);
			if (!second) {
				second = {
					people: new People(agents, slots[0].disease, slots[0].perDot, false),
					exposure: new real.Exposure(agents.capacity)
				};
				extra.set(slots[0], second);
			}
			real.transmit(
				agents,
				grid,
				[slots[0], second.people],
				[exposure[0], second.exposure],
				tick,
				rng,
				[hooks[0], hooks[0]],
				silentSpread
			);
		}
	};
});

const { createSimulation } = await import('../../src/lib/sim/engine');

function run(diseaseId: DiseaseId, seed: number, withInert: boolean) {
	inert.on = withInert;
	const sim = createSimulation(microcosm(0), { seed, diseaseId });
	for (let r = 0; r < 3; r++) sim.send({ type: 'seed', region: r, count: 5 });
	sim.step(40 * TICKS_PER_DAY);
	inert.on = false;
	return sim.snapshot();
}

describe('shared neighbour scan', () => {
	for (const diseaseId of ['measles', 'covid19'] as const) {
		it(`with an inert second disease, ${diseaseId} runs exactly as on the one-disease path`, () => {
			for (const seed of [1, 2, 3, 4]) {
				const one = run(diseaseId, seed, false);
				const calls = inert.calls;
				const two = run(diseaseId, seed, true);
				// The two-slot scan really ran, every tick.
				expect(inert.calls - calls).toBe(40 * TICKS_PER_DAY);
				expect(two.totals.everInfected).toBeGreaterThan(50);
				expect(two.totals).toEqual(one.totals);
				expect(two.regions.map((r) => r.counts)).toEqual(one.regions.map((r) => r.counts));
			}
		});
	}
});
