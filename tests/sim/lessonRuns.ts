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

/** Deaths (the tally, in people, 6.6) per person ever infected. */
export function deathsPerInfection(sim: Simulation): number {
	const t = sim.snapshot();
	return t.regions[0].deaths / (t.regions[0].counts.everInfected * t.peoplePerDot);
}

/** People infected at least once, and deaths (the tally, 6.6), in each age band, in people. */
export function byBand(sim: Simulation): { infected: Bands; died: Bands } {
	const a = sim.agents;
	const t = sim.snapshot();
	const infected: Bands = [0, 0, 0];
	for (let i = 0; i < a.activeCount; i++)
		if (a.infectedTick[i] >= 0) infected[a.ageBand[i]] += t.peoplePerDot;
	return { infected, died: [...t.regions[0].deathsByAge] as Bands };
}
