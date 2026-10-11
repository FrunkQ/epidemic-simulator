import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { ALIMOHAMADI_EUROPE_STAY, OMICRON_STAY } from '../../src/lib/config/derived';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import { TelemetryCounters } from '../../src/lib/sim/telemetry';
import type { Rng } from '../../src/lib/sim/rng';

describe('disease timing (6.1, 6.6)', () => {
	it('scales the European COVID-19 stay by the US Omicron to winter 2020 ratio', () =>
		expect(OMICRON_STAY).toBeCloseTo((ALIMOHAMADI_EUROPE_STAY * 5.5) / 8, 10));

	it('turns the figures into ticks, defaulting to no delay and a stay as long as the illness', () => {
		const covid = loadDisease('covid19');
		expect(covid.admissionDelayTicks).toBe(Math.round(5.74 * TICKS_PER_DAY));
		expect(covid.hospitalStayTicks).toBe(Math.round(ALIMOHAMADI_EUROPE_STAY * TICKS_PER_DAY));
		expect(covid.noSymptomInfectiousness).toBe(0.32);
		const omicron = loadDisease('covid19omicron');
		expect(omicron.admissionDelayTicks).toBe(0);
		expect(omicron.hospitalStayTicks).toBe(Math.round(OMICRON_STAY * TICKS_PER_DAY));
		const measles = loadDisease('measles');
		expect(measles.admissionDelayTicks).toBe(0);
		expect(measles.hospitalStayTicks).toBe(measles.illTicks);
		expect(measles.noSymptomInfectiousness).toBe(1);
	});

	it('holds each region’s admissions from tick + delay for stay ticks', () => {
		const c = new TelemetryCounters(2);
		c.setBedTiming(2, 3);
		const seen: [number, number][] = [];
		// As in a tick: symptoms start (admissions), then the beds are counted.
		for (let t = 4; t <= 12; t++) {
			if (t === 4) c.admit(0, 1, 0.5, t);
			if (t === 5) c.admit(1, 0, 0.25, t);
			c.countPatients(t);
			seen.push([c.patients[0], c.patients[1]]);
		}
		expect(seen.map(([a]) => a)).toEqual([0, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0]);
		expect(seen.map(([, b]) => b)).toEqual([0, 0, 0, 0.25, 0.25, 0.25, 0, 0, 0]);
	});

	for (const [share, label] of [
		[1, 'never get symptoms'],
		[0, 'will get symptoms']
	] as const) {
		it(`weights silent people who ${label} by the no-symptom factor once past their latent days`, () => {
			const real = loadDisease('covid19');
			// COVID-19 has no latent days of its own; one is added so it can be checked.
			const disease = { ...real, beta: 0, asymptomaticFraction: share, latentTicks: TICKS_PER_DAY };
			expect(disease.latentTicks).toBeLessThan(disease.silentTicks);
			const sim = createSimulation(singleCity({ population: 500_000 }), {
				seed: 3,
				diseaseId: 'covid19',
				disease
			});
			sim.seedNow(0, 20);
			const p = sim.people;
			const a = sim.agents;
			const factor = share === 1 ? disease.noSymptomInfectiousness : 1;
			sim.step(1);
			let latent = 0;
			for (let i = 0; i < a.activeCount; i++) latent += p.infectious(i, true);
			expect(latent).toBe(0);
			sim.step(disease.latentTicks);
			let silent = 0;
			let infectious = 0;
			for (let i = 0; i < a.activeCount; i++) {
				silent += p.silentSymptomatic[i] + p.silentAsymptomatic[i];
				infectious += p.infectious(i, true);
			}
			expect(silent).toBe(20);
			expect(infectious).toBeCloseTo(20 * factor, 6);
		});
	}

	for (const id of ['ebola', 'marburg', 'smallpox'] as const)
		it(`gives index cases seeded between ticks their beds when there is no silent phase (${id})`, () => {
			const disease = loadDisease(id);
			expect(disease.silentTicks).toBe(0);
			const sim = createSimulation(singleCity({ population: 500_000 }), {
				seed: 4,
				diseaseId: id,
				disease: { ...disease, beta: 0 }
			});
			const dots = sim.seedNow(0, 20);
			const a = sim.agents;
			const p = sim.people;
			sim.step(1);
			let need = 0;
			for (const i of dots) {
				const h = disease.hospitalByBand[a.ageBand[i]];
				need += h * (p.ill[i] - p.illAgain[i]) * (1 - p.severe[i]);
			}
			expect(need).toBeGreaterThan(0);
			expect(sim.snapshot().regions[0].patients).toBeCloseTo(need, 9);
			// And the beds empty when the illness ends, never below zero for anyone else.
			sim.step(disease.illTicks + 1);
			expect(sim.snapshot().regions[0].patients).toBeCloseTo(0, 9);
		});

	it('moves people who will never get symptoms with their latent days in the boarding swap', () => {
		const real = loadDisease('covid19');
		const disease = { ...real, beta: 0, asymptomaticFraction: 1, latentTicks: TICKS_PER_DAY };
		const sim = createSimulation(singleCity({ population: 500_000 }), {
			seed: 3,
			diseaseId: 'covid19',
			disease
		});
		const [from] = sim.seedNow(0, 1);
		sim.step(1);
		const p = sim.people;
		const to = from === 0 ? 1 : 0;
		const rng = (sim as unknown as { rng: Rng }).rng;
		expect(p.latentQuiet[from]).toBe(1);
		// Move people until the latent one goes: only they are silent, so their counts move together.
		while (p.silentAsymptomatic[from] > 0) p.moveOneNotIll(from, to, sim.tick, rng);
		expect([p.latent[from], p.latentQuiet[from]]).toEqual([0, 0]);
		expect([p.latent[to], p.latentQuiet[to], p.silentAsymptomatic[to]]).toEqual([1, 1, 1]);
		expect(p.infectious(to, true)).toBe(0);
		sim.step(TICKS_PER_DAY);
		expect(p.latentQuiet[to]).toBe(0);
		expect(p.infectious(to, true)).toBeCloseTo(disease.noSymptomInfectiousness, 9);
	});
});
