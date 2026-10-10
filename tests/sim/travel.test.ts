import { describe, expect, it } from 'vitest';
import { microcosm } from '../../src/lib/config/scenarios';
import { DISEASES } from '../../src/lib/config/diseases';
import { withValue } from '../../src/lib/config/healthPolicy';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import { hospitalRegion } from '../../src/lib/sim/disease';
import { TRAVEL_DAYS } from '../../src/lib/sim/routes';
import type { Bands } from '../../src/lib/sim/types';
import { loadDisease } from '../../src/lib/config';

/**
 * Follow every traveller who sets off while silently infected and record, person by person, how
 * many are still infectious when they arrive, per kind of route. Nobody catches it on the way, so
 * the infected people who arrive are the ones who set off.
 */
function arrivals(seed: number) {
	const scenario = microcosm(0);
	for (const r of scenario.regions) {
		r.vaccinatedFull = 0;
		r.vaccinatedPartial = 0;
		r.policy = withValue(r.policy, 'travelFrequency', 3);
	}
	const sim = createSimulation(scenario, { seed, diseaseId: 'measles' });
	sim.send({ type: 'seed', region: 1, count: 20 });
	const a = sim.agents;
	const p = sim.people;
	// Person by person: by the moment a dot boards, its ill people have swapped out (finer-counts 4.4).
	const ready = sim.planes.readyToBoard;
	sim.planes.readyToBoard = (dot) => {
		const ok = ready(dot);
		if (ok) expect(p.ill[dot], 'an ill person boarded').toBe(0);
		return ok;
	};
	const leftSilent = new Map<number, { kind: string; silent: number }>();
	const result: Record<string, { infectious: number; total: number }> = {
		air: { infectious: 0, total: 0 },
		ferry: { infectious: 0, total: 0 },
		road: { infectious: 0, total: 0 }
	};
	const wasOnRoute = new Int16Array(a.capacity).fill(-1);
	for (let t = 0; t < 60 * TICKS_PER_DAY; t++) {
		sim.step(1);
		for (let i = 0; i < a.activeCount; i++) {
			const r = a.route[i];
			const silent = p.silentSymptomatic[i] + p.silentAsymptomatic[i];
			// Counted after the tick, so anyone who fell ill on the first tick of the trip counts too.
			if (r >= 0 && wasOnRoute[i] < 0 && silent + p.ill[i] > 0)
				leftSilent.set(i, { kind: sim.routes[r].kind, silent: silent + p.ill[i] });
			if (r < 0 && wasOnRoute[i] >= 0 && leftSilent.has(i)) {
				const left = leftSilent.get(i)!;
				result[left.kind].total += left.silent;
				// The arrival tick's spread can infect more of the dot; count only up to those who set off.
				result[left.kind].infectious += Math.min(left.silent, silent + p.ill[i]);
				leftSilent.delete(i);
			}
			wasOnRoute[i] = r;
		}
	}
	return result;
}

describe('lesson 2: fast travel beats burnout, slow travel does not', () => {
	it('silent measles cases still spread when a plane lands, but not when a ferry docks', () => {
		const totals = { air: { infectious: 0, total: 0 }, ferry: { infectious: 0, total: 0 } };
		for (const seed of [1, 2, 3]) {
			const r = arrivals(seed);
			for (const k of ['air', 'ferry'] as const) {
				totals[k].infectious += r[k].infectious;
				totals[k].total += r[k].total;
			}
		}
		expect(totals.air.total).toBeGreaterThan(10);
		expect(totals.ferry.total).toBeGreaterThan(5);
		expect(totals.air.infectious / totals.air.total).toBeGreaterThanOrEqual(0.9);
		expect(1 - totals.ferry.infectious / totals.ferry.total).toBeGreaterThanOrEqual(0.9);
	});
});

describe('travel keeps populations level', () => {
	it('moves people both ways without draining any city', () => {
		const sim = createSimulation(microcosm(0), { seed: 9, diseaseId: 'flu' });
		const start = sim.snapshot();
		const before = start.regions.map((r) => r.dots * start.peoplePerDot);
		sim.step(60 * TICKS_PER_DAY);
		const snap = sim.snapshot();
		expect(snap.travelling).toBeGreaterThan(0);
		snap.regions.forEach((r, i) => {
			const now = Object.values({ ...r.counts, everInfected: 0 }).reduce((a, b) => a + b, 0);
			expect(Math.abs(now - before[i]) / before[i]).toBeLessThan(0.1);
		});
	});
});

describe('every person is counted once, travellers included', () => {
	it('keeps totals equal to the people, and deaths on a route in the counts, every day', () => {
		const scenario = microcosm(0);
		for (const r of scenario.regions) {
			r.vaccinatedFull = 0;
			r.vaccinatedPartial = 0;
			r.policy = withValue(r.policy, 'travelFrequency', 3);
		}
		// Whooping cough's long illness, with deaths made common (an accounting test, not a lesson),
		// so some people are sure to die on the way whatever the seed.
		const pertussis = loadDisease('pertussis');
		const disease = { ...pertussis, mortalityByBand: [0.3, 0.3, 0.3] as Bands, mortality: 0.3 };
		const sim = createSimulation(scenario, { seed: 7, diseaseId: 'pertussis', disease });
		sim.send({ type: 'seed', region: 1, count: 20 });
		const a = sim.agents;
		const p = sim.people;
		let diedOnRoute = 0;
		const counted = new Uint8Array(a.capacity);
		const origins = new Set<number>();
		for (let day = 1; day <= 150; day++) {
			for (let t = 0; t < TICKS_PER_DAY; t++) {
				sim.step(1);
				for (let i = 0; i < a.activeCount; i++)
					if (a.route[i] >= 0 && p.dead[i] > 0 && !counted[i]) {
						counted[i] = 1;
						diedOnRoute++;
						origins.add(hospitalRegion(a, sim.routes, i));
					}
			}
			const snap = sim.snapshot();
			let dead = 0;
			for (let i = 0; i < a.activeCount; i++) dead += p.dead[i];
			expect(snap.totals.deceased, `day ${day}`).toBe(dead);
			const t = snap.totals;
			const everyone =
				t.unprotected + t.full + t.partial + t.silent + t.symptomatic + t.recovered + t.deceased;
			expect(everyone, `day ${day}`).toBe(a.activeCount * p.perDot);
		}
		// The scenario that lost deaths before: some people did die on the way.
		expect(diedOnRoute).toBeGreaterThan(0);
		// Their deaths are counted in the region they set out from (6.6).
		const snap = sim.snapshot();
		for (const r of origins) {
			expect(r).toBeGreaterThanOrEqual(0);
			expect(snap.regions[r].deaths).toBeGreaterThan(0);
		}
	});
});

describe('journey times (config)', () => {
	it('keeps road and ferry trips longer than a measles case lasts, so it burns out on the way', () => {
		const measles = DISEASES.measles;
		const caseDays = measles.silentDays.value + measles.illDays.value;
		expect(TRAVEL_DAYS.road).toBeGreaterThan(caseDays);
		expect(TRAVEL_DAYS.ferry).toBeGreaterThan(caseDays);
		expect(TRAVEL_DAYS.air).toBeLessThan(measles.silentDays.value);
	});
});
