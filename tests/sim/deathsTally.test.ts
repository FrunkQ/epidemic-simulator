import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, deathTallyPeople } from '../../src/lib/sim/engine';
import type { Bands, DiseaseRuntime } from '../../src/lib/sim/types';

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
		const { t } = run(0.0002, 2);
		// Fewer than one dot is expected to die, but the tally shows the people.
		expect(t.regions[0].deaths).toBeGreaterThan(0);
		expect(t.regions[0].deaths).toBeLessThan(t.peoplePerDot);
	});

	it('counts the dead dots themselves when a dot is one person', () => {
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

	it('is the same in two runs with the same seed', () => {
		expect(run(0.05, 4).t.regions[0].deaths).toBe(run(0.05, 4).t.regions[0].deaths);
	});
});
