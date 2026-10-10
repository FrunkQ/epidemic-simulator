import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { defaultPolicy, withValue } from '../../src/lib/config/healthPolicy';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, deathTallyPeople } from '../../src/lib/sim/engine';
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
	return { t: sim.snapshot(), cases };
}

describe('deaths tally (6.6)', () => {
	it('adds each ended illness’s chance of death in people, so with no strain it is exactly cases x d', () => {
		const d = 0.013;
		const { t, cases } = run(d, 1);
		expect(t.regions[0].strain).toBe(1);
		expect(t.regions[0].deaths).toBeCloseTo(cases * d * t.peoplePerDot, 6);
		expect(t.regions[0].deathsByAge[1]).toBeCloseTo(t.regions[0].deaths, 9);
		expect(t.deaths).toBeCloseTo(t.regions[0].deaths, 9);
	});

	it('scales smoothly: a death rate far below one dot per run still shows', () => {
		const d = 0.0002;
		const { t, cases } = run(d, 2);
		// Fewer than one dot is expected to die, but the tally shows the people, and the card's
		// rounded figure is not 0.
		expect(t.regions[0].deaths).toBeCloseTo(cases * d * t.peoplePerDot, 6);
		expect(t.regions[0].deaths).toBeLessThan(t.peoplePerDot);
		expect(Math.round(t.regions[0].deaths)).toBeGreaterThan(0);
	});

	// The engine never runs at one person per dot today (dot allocation starts at 100), so this
	// checks the helper only; the guided village gets an engine-level check (11, step 6).
	it('helper: counts the dead dots themselves when a dot is one person', () => {
		expect(deathTallyPeople(0.3, true, 1)).toBe(1);
		expect(deathTallyPeople(0.3, false, 1)).toBe(0);
		expect(deathTallyPeople(0.3, false, 100)).toBeCloseTo(30, 9);
	});

	it('agrees with the dead dots on average', () => {
		const { t } = run(0.2, 3);
		const dots = t.regions[0].counts.deceased * t.peoplePerDot;
		const tally = t.regions[0].deaths;
		// Three standard errors of the dot draw.
		const se = Math.sqrt(3000 * 0.2 * 0.8) * t.peoplePerDot;
		expect(Math.abs(dots - tally)).toBeLessThan(3 * se);
	});

	it('agrees with the dead dots in every region with travel, full hospitals and vaccination', () => {
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
			const dots = r.counts.deceased * t.peoplePerDot;
			// The dot draw's variance, sum of P(1 - P), is at most sum of P = tally / peoplePerDot.
			const se = Math.sqrt(r.deaths * t.peoplePerDot);
			expect(Math.abs(dots - r.deaths), r.name).toBeLessThan(3 * se);
		}
		expect(t.deaths).toBeCloseTo(
			t.regions.reduce((a, r) => a + r.deaths, 0),
			6
		);
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
