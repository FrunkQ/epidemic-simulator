import { loadDisease } from '../../src/lib/config';
import { DISEASES } from '../../src/lib/config/diseases';
import { singleCity } from '../../src/lib/config/scenarios';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import { State, type DiseaseId, type Region } from '../../src/lib/sim/types';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';

export function cityRun(id: DiseaseId, seed: number, region: Partial<Region> = {}): Simulation {
	return createSimulation(singleCity(region), { seed, disease: loadDisease(id) });
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
 * imported case itself is not counted). With measles' real two-dose protection, some fully
 * vaccinated people stay catchable, so they count as unprotected in proportion.
 * A large city (5,000 dots) with one imported case keeps chance small.
 */
export function attackRate(full: number, seed: number): number {
	const sim = cityRun('measles', seed, { vaccinatedFull: full, population: 500_000 });
	sim.send({ type: 'seed', region: 0, count: 1 });
	runOut(sim, 400);
	const r = sim.snapshot().regions[0];
	const unprotected = r.dots * (1 - full * DISEASES.measles.fullEfficacy.value);
	return (r.counts.everInfected - 1) / unprotected;
}
