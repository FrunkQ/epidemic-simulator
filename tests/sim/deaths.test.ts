import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { defaultPolicy, withValue } from '../../src/lib/config/healthPolicy';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import type { Bands, DiseaseRuntime } from '../../src/lib/sim/types';
import { roundToTotal } from '../../src/lib/ui/charts/scale';

/** Flu that doesn't spread and always shows symptoms, with chosen chances, in a roomy hospital. */
function run(d: number, seed: number) {
	const flu = loadDisease('flu');
	const disease: DiseaseRuntime = {
		...flu,
		beta: 0,
		asymptomaticFraction: 0,
		mortality: d,
		mortalityByBand: [d, d, d],
		hospitalisedShare: 0.5,
		hospitalByBand: [0.5, 0.5, 0.5]
	};
	const policy = {
		...defaultPolicy(),
		ageMix: { value: [0, 1, 0] as Bands, sources: [] },
		hospitalBedsPerThousand: { value: 1000, sources: [] },
		spareBedShare: { value: 1, sources: [] }
	};
	const sim = createSimulation(singleCity({ population: 500_000, policy }), {
		seed,
		diseaseId: 'flu',
		disease
	});
	const cases = sim.seedNow(0, 3000).length;
	sim.step(disease.silentTicks + disease.illTicks + 5 * TICKS_PER_DAY);
	return { t: sim.snapshot(), cases, sim };
}

/** Every person who has died, wherever their dot is now. */
function deadPeople(sim: ReturnType<typeof createSimulation>): number {
	let dead = 0;
	for (let i = 0; i < sim.agents.activeCount; i++) dead += sim.people.dead[i];
	return dead;
}

describe('deaths in whole people (6.6)', () => {
	it('kills d of cases with no strain, in whole people', () => {
		const d = 0.013;
		const { t, cases, sim } = run(d, 1);
		expect(t.regions[0].strain).toBe(1);
		const deaths = t.regions[0].deaths;
		expect(Number.isInteger(deaths)).toBe(true);
		expect(Math.abs(deaths - cases * d)).toBeLessThan(3 * Math.sqrt(cases * d * (1 - d)));
		expect(deaths).toBe(deadPeople(sim));
		expect(t.regions[0].deathsByAge[1]).toBe(deaths);
		expect(t.deaths).toBe(deaths);
	});

	it('shows a rare death as one person, not a fraction', () => {
		// 3,000 cases at 1 in 2,000: 1.5 deaths expected, so most seeds have one or two.
		let some = 0;
		for (const seed of [2, 12, 22, 32, 42]) {
			const deaths = run(0.0005, seed).t.regions[0].deaths;
			expect(Number.isInteger(deaths)).toBe(true);
			expect(deaths).toBeLessThan(10);
			if (deaths > 0) some++;
		}
		expect(some).toBeGreaterThan(0);
	});

	it('counts each death once, in every region, with travel, full hospitals and vaccination', () => {
		const scenario = microcosm(0);
		for (const r of scenario.regions) {
			r.policy = withValue(r.policy, 'hospitalBedsPerThousand', 0.3);
		}
		const sim = createSimulation(scenario, { seed: 5, diseaseId: 'covid19' });
		sim.send({ type: 'seed', region: 0, count: 30 });
		let strained = false;
		for (let day = 0; day < 200; day++) {
			sim.step(TICKS_PER_DAY);
			if (sim.snapshot().regions.some((r) => r.strain > 1)) strained = true;
		}
		const t = sim.snapshot();
		expect(strained).toBe(true);
		expect(t.regions.some((r) => r.counts.full > 0)).toBe(true);
		for (const r of t.regions) {
			expect(r.deaths, r.name).toBeGreaterThan(0);
			expect(r.counts.deceased, r.name).toBe(r.deaths);
		}
		expect(t.deaths).toBe(t.regions.reduce((a, r) => a + r.deaths, 0));
		expect(t.deaths).toBe(deadPeople(sim));
	});

	it('starts at 0 after a restart', () => {
		const sim = createSimulation(singleCity({ population: 300_000 }), { seed: 6, diseaseId: 'ebola' });
		sim.seedNow(0, 200);
		sim.step(40 * TICKS_PER_DAY);
		expect(sim.snapshot().deaths).toBeGreaterThan(0);
		sim.setup(singleCity({ population: 300_000 }));
		expect(sim.snapshot().deaths).toBe(0);
		expect(sim.snapshot().regions[0].deaths).toBe(0);
	});

	it('is the same in two runs with the same seed', () => {
		expect(run(0.05, 4).t.regions[0].deaths).toBe(run(0.05, 4).t.regions[0].deaths);
	});
});

describe('age bars round to the card’s total (8)', () => {
	it('gives whole numbers that add up to the rounded total', () => {
		expect(roundToTotal([0.4, 0.4, 0.4])).toEqual([1, 0, 0]);
		expect(roundToTotal([10.6, 20.2, 30.2])).toEqual([11, 20, 30]);
		expect(roundToTotal([33.4, 33.3, 33.3], 100)).toEqual([34, 33, 33]);
		expect(roundToTotal([0, 0, 0])).toEqual([0, 0, 0]);
	});
});
