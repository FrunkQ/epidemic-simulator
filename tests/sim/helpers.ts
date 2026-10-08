import { singleCity } from '../../src/lib/config/scenarios';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import { State, type DiseaseId, type Region } from '../../src/lib/sim/types';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';

export function cityRun(id: DiseaseId, seed: number, region: Partial<Region> = {}): Simulation {
	return createSimulation(singleCity(region), { seed, diseaseId: id });
}

export function anyInfectious(sim: Simulation): boolean {
	const a = sim.agents;
	for (let i = 0; i < a.activeCount; i++) {
		if (a.state[i] === State.SILENT || a.state[i] === State.SYMPTOMATIC) return true;
	}
	return false;
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
 * Share of the people the vaccine does not protect who caught it from someone else (the
 * imported case itself is not counted). "Not protected" is counted dot by dot: everyone whose
 * vaccine did not take, including the fully vaccinated few it fails for.
 * A large city (5,000 dots) with one imported case keeps chance small.
 */
export function attackRate(full: number, seed: number): number {
	const sim = cityRun('measles', seed, { vaccinatedFull: full, population: 500_000 });
	sim.send({ type: 'seed', region: 0, count: 1 });
	runOut(sim, 400);
	const a = sim.agents;
	let unprotected = 0;
	for (let i = 0; i < a.activeCount; i++) if (a.vaccineWorks[i] === 0) unprotected++;
	const r = sim.snapshot().regions[0];
	return (r.counts.everInfected - 1) / (unprotected - 1);
}
