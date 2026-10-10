import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import type { Bands, DiseaseId, HealthPolicy, Region } from '../../src/lib/sim/types';
import { anyInfectious } from './helpers';

/*
 * Shared runs for the lesson tests (10), about 20 seeds each. Lessons set inputs only, never engine internals, and
 * assert on the share of seeds. Each lesson has its own file so vitest runs them in parallel.
 */

export const SEEDS = 20;

/** Each lesson runs 10 to 20 outbreaks; CI runners are slower than a laptop, so allow more than the default. */
export const LESSON_TIMEOUT = 600_000;

export function withAges(policy: HealthPolicy, ages: Bands): HealthPolicy {
	return { ...policy, ageMix: { value: ages, sources: [] } };
}

/** Plenty of empty beds: hospitals are never strained. */
export function roomy(): HealthPolicy {
	return {
		...defaultPolicy(),
		hospitalBedsPerThousand: { value: 1000, sources: [] },
		spareBedShare: { value: 1, sources: [] }
	};
}

/** A city (2,000 dots unless `region` says otherwise) with an outbreak, run until it ends or `days` pass. */
export function outbreak(
	id: DiseaseId,
	seed: number,
	region: Partial<Region>,
	days = 365,
	cases = 10
): Simulation {
	const sim = createSimulation(singleCity({ population: 200_000, ...region }), { seed, diseaseId: id });
	sim.seedNow(0, cases);
	for (let d = 0; d < days; d++) {
		sim.step(TICKS_PER_DAY);
		if (!anyInfectious(sim)) break;
	}
	return sim;
}

/** Deaths per person ever infected. */
export function deathsPerInfection(sim: Simulation): number {
	const r = sim.snapshot().regions[0];
	return r.deaths / r.counts.everInfected;
}

/** People infected at least once, and deaths, in each age band. */
export function byBand(sim: Simulation): { infected: Bands; died: Bands } {
	return { infected: sim.everInfectedByAge(0), died: [...sim.snapshot().regions[0].deathsByAge] as Bands };
}
