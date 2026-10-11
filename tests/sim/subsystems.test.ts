import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { DISEASES } from '../../src/lib/config/diseases';
import { STEIN_40_WEEKS } from '../../src/lib/config/derived';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import type { Subsystems } from '../../src/lib/sim/types';

const city = (subsystems: Partial<Subsystems>) => ({ ...singleCity({ population: 300_000 }), subsystems });

describe('subsystem switches (6.14)', () => {
	it('deaths off: nobody dies, even of Ebola', () => {
		const sim = createSimulation(city({ deaths: false }), { seed: 1, diseaseId: 'ebola' });
		sim.seedNow(0, 200);
		sim.step(40 * TICKS_PER_DAY);
		expect(sim.snapshot().totals.deceased).toBe(0);
		expect(sim.snapshot().deaths).toBe(0);
	});

	it('silent spread off: a disease contagious almost only before symptoms barely spreads', () => {
		const measles = loadDisease('measles');
		// Contagious for the silent days, then ill for a single tick.
		const disease = { ...measles, illTicks: 1, asymptomaticFraction: 0 };
		const on = createSimulation(city({}), { seed: 2, diseaseId: 'measles', disease });
		const off = createSimulation(city({ silentSpread: false }), { seed: 2, diseaseId: 'measles', disease });
		for (const sim of [on, off]) {
			sim.seedNow(0, 20);
			sim.step(disease.silentTicks + 5);
		}
		// Only the single ill tick can spread it when silent spread is off.
		const spreadOn = on.snapshot().totals.everInfected - 20;
		const spreadOff = off.snapshot().totals.everInfected - 20;
		expect(spreadOn).toBeGreaterThan(20);
		expect(spreadOff).toBeLessThan(spreadOn / 10);
	});

	it('ill stops movement: a dot stops once half or more of its people are ill, unless switched off', () => {
		const run = (illStopsMovement: boolean) => {
			const sim = createSimulation(city({ illStopsMovement }), { seed: 3, diseaseId: 'measles' });
			sim.seedNow(0, 200);
			const a = sim.agents;
			const p = sim.people;
			let moved = 0;
			let still = 0;
			for (let t = 0; t < 20 * TICKS_PER_DAY; t++) {
				const x = Float32Array.from(a.x);
				const y = Float32Array.from(a.y);
				const flagged = Uint8Array.from(a.ill);
				sim.step(1);
				for (let i = 0; i < a.activeCount; i++) {
					// The flag is the majority rule (finer-counts §0).
					expect(a.ill[i]).toBe(2 * p.ill[i] >= p.perDot ? 1 : 0);
					if (flagged[i] === 0 || a.region[i] < 0) continue;
					if (a.x[i] === x[i] && a.y[i] === y[i]) still++;
					else moved++;
				}
			}
			return { moved, still };
		};
		const on = run(true);
		expect(on.still).toBeGreaterThan(0);
		expect(on.moved).toBe(0);
		expect(run(false).moved).toBeGreaterThan(0);
	});

	it('travel off: nobody leaves their population', () => {
		const sim = createSimulation(
			{ ...microcosm(0), subsystems: { travel: false } },
			{ seed: 4, diseaseId: 'flu' }
		);
		for (let d = 0; d < 20; d++) {
			sim.step(TICKS_PER_DAY);
			expect(sim.snapshot().travelling).toBe(0);
		}
	});

	it('waning off: nothing fades', () => {
		const sim = createSimulation(
			{ ...singleCity({ population: 200_000, vaccinatedFull: 0.8 }), subsystems: { waning: false } },
			{ seed: 5, diseaseId: 'flu' }
		);
		sim.seedNow(0, 50);
		sim.step(60 * TICKS_PER_DAY);
		const a = sim.agents;
		const p = sim.people;
		for (let i = 0; i < a.activeCount; i++) {
			expect(p.nextVaccineWane[i]).toBe(Infinity);
			expect(p.nextRecoveredWane[i]).toBe(Infinity);
		}
	});

	it('hospital off: no pressure and no strain', () => {
		const sim = createSimulation(city({ hospital: false }), { seed: 6, diseaseId: 'covid19' });
		sim.seedNow(0, 500);
		sim.step(10 * TICKS_PER_DAY);
		const r = sim.snapshot().regions[0];
		expect(r.pressure).toBe(0);
		expect(r.strain).toBe(1);
	});

	it('age bands off: everyone gets the all-ages chances', () => {
		const flu = loadDisease('flu');
		const disease = {
			...flu,
			beta: 0,
			asymptomaticFraction: 0,
			mortality: 0.1,
			mortalityByBand: [0, 0, 1] as [number, number, number],
			hospitalisedShare: 1,
			hospitalByBand: [1, 1, 1] as [number, number, number]
		};
		const run = (ageBands: boolean) => {
			const sim = createSimulation(
				{ ...singleCity({ population: 500_000 }), subsystems: { ageBands, hospital: false } },
				{ seed: 7, diseaseId: 'flu', disease }
			);
			const n = sim.seedNow(0, 4000).length;
			sim.step(disease.silentTicks + disease.illTicks + 5);
			return sim.snapshot().regions[0].counts.deceased / n;
		};
		expect(Math.abs(run(false) - 0.1)).toBeLessThan(0.015);
		// With bands, only the 65+ die, every one of them.
		expect(run(true)).toBeGreaterThan(0.15);
	});

	it('credits each infection to the index case that caused it when calibrating (6.9)', () => {
		const sim = createSimulation(city({}), { seed: 8, diseaseId: 'measles', secondaryOnly: true });
		const cases = sim.seedNow(0, 3);
		sim.step(8 * TICKS_PER_DAY);
		const credited = sim.people.secondaries!;
		let traced = 0;
		for (let i = 0; i < sim.agents.activeCount; i++) {
			if (!cases.includes(i)) expect(credited[i]).toBe(0);
			traced += credited[i];
		}
		expect(traced).toBe(sim.snapshot().totals.everInfected - cases.length);
		expect(traced).toBeGreaterThan(0);
	});
});

describe('protection after COVID-19 infection matches Stein 2023 at 40 weeks (6.2)', () => {
	// With one-step waning, protection against reinfection at t is 2^(-t / half-life); the population's
	// protection against severe disease is then 1 - (1 - that) x (1 - the breakthrough figure).
	// Tolerance: 0.05, well inside Stein's own 95% intervals (78.6%: 49.8-93.6; 36.1%: 24.4-51.3).
	const days = STEIN_40_WEEKS.weeks * 7;
	for (const [id, pair] of [
		['covid19', STEIN_40_WEEKS.preOmicron],
		['covid19omicron', STEIN_40_WEEKS.ba1]
	] as const) {
		it(`${id}: the model's waning reproduces the reinfection and severe figures`, () => {
			const halfLife = DISEASES[id].waningDays.value!;
			const reinfection = 2 ** (-days / halfLife);
			const severe = 1 - (1 - reinfection) * (1 - loadDisease(id).afterInfectionSevere);
			expect(Math.abs(reinfection - pair.reinfection)).toBeLessThan(0.05);
			expect(Math.abs(severe - pair.severe)).toBeLessThan(0.05);
		});
	}
});
