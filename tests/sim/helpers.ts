import { singleCity } from '../../src/lib/config/scenarios';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import type { DiseaseId, Region } from '../../src/lib/sim/types';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';

export function cityRun(id: DiseaseId, seed: number, region: Partial<Region> = {}): Simulation {
	return createSimulation(singleCity(region), { seed, diseaseId: id });
}

export function anyInfectious(sim: Simulation): boolean {
	return sim.anyInfected();
}

/** Run until the outbreak is over or `maxDays` pass. */
export function runOut(sim: Simulation, maxDays: number): void {
	for (let d = 0; d < maxDays; d++) {
		sim.step(TICKS_PER_DAY);
		if (!anyInfectious(sim)) return;
	}
}

/** Share of seeds for which `pass` holds. */
export function shareOf(seeds: number, pass: (seed: number) => boolean): number {
	let ok = 0;
	for (let s = 1; s <= seeds; s++) if (pass(s)) ok++;
	return ok / seeds;
}

/**
 * People lesson 1 brings in, each in their own dot, as the button places them. The lesson is
 * about coverage, not the luck of one introduction: one person fizzles by chance in 4 of 20 seeds
 * at 85%, while 3, 5 and 10 all pass both arms in 20 of 20 (10). A setup choice, not a model figure.
 */
export const LESSON1_IMPORTED_PEOPLE = 10;

/**
 * Share of the people the vaccine does not protect who caught it from someone else (the people
 * brought in are not counted). "Not protected" is counted person by person: everyone whose
 * vaccine did not take, including the fully vaccinated few it fails for.
 * A large city (500,000 people) keeps chance small.
 */
export function attackRate(full: number, seed: number): number {
	const sim = cityRun('measles', seed, { vaccinatedFull: full, population: 500_000 });
	sim.send({ type: 'seed', region: 0, count: LESSON1_IMPORTED_PEOPLE });
	runOut(sim, 400);
	const unprotected = sim.unprotectedPeople(0);
	const r = sim.snapshot().regions[0];
	return (r.counts.everInfected - LESSON1_IMPORTED_PEOPLE) / (unprotected - LESSON1_IMPORTED_PEOPLE);
}
