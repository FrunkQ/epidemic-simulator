import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import type { DiseaseId, HealthPolicy, Scenario } from '../../src/lib/sim/types';
import { anyInfectious } from './helpers';

/*
 * Shared runs for the lockdown lessons (3, 13, 21 and the 6.6 check): one city of 200,000 people
 * with 10 index cases, and a lockdown from `lockdownDay` (none when null) that stays on. Lessons set
 * inputs only (the scenario, its policy and commands), never engine internals.
 */

export interface LockdownRun {
	sim: Simulation;
	/** The most people ill at once. */
	peakIll: number;
	/** The highest hospital pressure (6.6). */
	peakPressure: number;
	/** The first day pressure went over full capacity (6.6), or Infinity if it never did. */
	overDay: number;
}

export interface LockdownOptions {
	lockdownDay: number | null;
	disease?: DiseaseId;
	policy?: HealthPolicy;
	/** Other scenario inputs: the ill-stop rule (illStopShare, subsystems) for the recheck. */
	scenario?: Partial<Scenario>;
	days?: number;
	/** Stop early once this day is reached (lesson 21 reads day 60). */
	until?: number;
}

export function lockdownRun(seed: number, options: LockdownOptions): LockdownRun {
	const policy = options.policy ?? defaultPolicy();
	const scenario = { ...singleCity({ population: 200_000, policy }), ...options.scenario };
	const sim = createSimulation(scenario, { seed, diseaseId: options.disease ?? 'covid19' });
	sim.seedNow(0, 10);
	let peakIll = 0;
	let peakPressure = 0;
	let overDay = Infinity;
	const days = options.until ?? options.days ?? 365;
	for (let d = 0; d < days; d++) {
		if (d === options.lockdownDay) sim.send({ type: 'lockdown', region: 0, on: true });
		sim.step(TICKS_PER_DAY);
		const r = sim.snapshot().regions[0];
		peakIll = Math.max(peakIll, r.counts.symptomatic);
		peakPressure = Math.max(peakPressure, r.pressure);
		if (r.pressure > 1 && overDay === Infinity) overDay = d + 1;
		if (options.until === undefined && !anyInfectious(sim)) break;
	}
	return { sim, peakIll, peakPressure, overDay };
}

/** Lesson 3 (10): COVID-19 in one city, lockdown from day 5 against none, same seed. */
export const lesson3 = (seed: number, scenario: Partial<Scenario> = {}) =>
	lockdownRun(seed, { lockdownDay: 5, scenario }).peakIll <
	lockdownRun(seed, { lockdownDay: null, scenario }).peakIll;
