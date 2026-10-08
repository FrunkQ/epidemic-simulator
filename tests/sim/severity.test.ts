import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import { POPULATION } from '../../src/lib/config/population';
import { defaultPolicy, ENGLAND_POLICY } from '../../src/lib/config/healthPolicy';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, strainMultiplier } from '../../src/lib/sim/engine';
import { Protection, State, type Bands, type DiseaseRuntime, type HealthPolicy, type Scenario } from '../../src/lib/sim/types';

/** Everyone aged 15-64, so one band's chances apply to every case. */
const WORKING_AGE: Bands = [0, 1, 0];

/**
 * A disease that doesn't spread (beta 0) and always shows symptoms, with chosen death and bed
 * chances, so the illness rules can be counted case by case.
 */
function counted(d: number, h: number, extra: Partial<DiseaseRuntime> = {}): DiseaseRuntime {
	const flu = loadDisease('flu');
	return {
		...flu,
		beta: 0,
		asymptomaticFraction: 0,
		mortality: d,
		mortalityByBand: [d, d, d],
		hospitalisedShare: h,
		hospitalByBand: [h, h, h],
		...extra
	};
}

function policy(beds: number, spare: number, ageMix: Bands = WORKING_AGE): HealthPolicy {
	const p = defaultPolicy();
	return {
		...p,
		ageMix: { value: ageMix, sources: [] },
		hospitalBedsPerThousand: { value: beds, sources: [] },
		spareBedShare: { value: spare, sources: [] }
	};
}

/** Seed `cases` index cases into a 5,000-dot city and run until they are over; deaths per case. */
function deathsPerCase(disease: DiseaseRuntime, p: HealthPolicy, seed: number, cases = 4000, scenario?: Scenario) {
	const sc = scenario ?? singleCity({ population: 500_000, policy: p });
	const sim = createSimulation(sc, { seed, diseaseId: 'flu', disease });
	const seeded = sim.seedNow(0, cases).length;
	sim.step((disease.silentTicks + disease.illTicks + 2) * 1);
	sim.step(5 * TICKS_PER_DAY);
	return { rate: sim.snapshot().regions[0].counts.deceased / seeded, n: seeded, sim };
}

/** Three standard errors of a share p measured over n cases. */
const tol = (p: number, n: number) => 3 * Math.sqrt((p * (1 - p)) / n) + 1e-9;

describe('who gets seriously ill (6.2, 6.6)', () => {
	it("draws each dot's age band from its population's age mix", () => {
		const mix = POPULATION.oldAgeMix.value;
		const sim = createSimulation(singleCity({ population: 500_000, policy: policy(3, 0.3, mix) }), {
			seed: 3,
			diseaseId: 'flu'
		});
		const a = sim.agents;
		const counts = [0, 0, 0];
		for (let i = 0; i < a.activeCount; i++) counts[a.ageBand[i]]++;
		counts.forEach((c, b) => expect(Math.abs(c / a.activeCount - mix[b])).toBeLessThan(0.02));
	});

	// The two-draw rule gives exactly d deaths per case when there is no strain, whether the band
	// has more deaths than beds or fewer (6.6).
	for (const [d, h] of [
		[0.3, 0.1],
		[0.05, 0.2]
	]) {
		it(`kills d of cases with no strain (d ${d}, h ${h})`, () => {
			// Plenty of empty beds: pressure stays far below the strain threshold.
			const { rate, n, sim } = deathsPerCase(counted(d, h), policy(1000, 1), 1);
			expect(sim.snapshot().regions[0].strain).toBe(1);
			expect(Math.abs(rate - d)).toBeLessThan(tol(d, n));
		});

		it(`raises deaths under strain, but never past every bedded case plus the no-bed deaths (d ${d}, h ${h})`, () => {
			// Almost no beds and none spare: pressure far above 110%, so strain sits at its cap.
			const { rate, n } = deathsPerCase(counted(d, h), policy(0.5, 0), 2);
			const m = BEHAVIOUR.strainMaxMultiplier.value;
			const base = Math.min(d, h) / h;
			const expected = h * ((m * base) / (1 - base + m * base)) + Math.max(0, d - h);
			expect(Math.abs(rate - expected)).toBeLessThan(tol(expected, n));
			expect(rate).toBeLessThanOrEqual(h + Math.max(0, d - h) + tol(h, n));
			if (d < h) expect(rate).toBeGreaterThan(d);
		});
	}

	it('applies strain to the odds of death, so the chance stays below 1', () => {
		const { rate } = deathsPerCase(counted(0.9, 0.95), policy(0.5, 0), 3);
		expect(rate).toBeLessThan(1);
		expect(rate).toBeGreaterThan(0.9);
	});

	it('follows the agreed strain curve: 1 up to the threshold, the cap from 110%', () => {
		expect(strainMultiplier(0.5)).toBe(1);
		expect(strainMultiplier(BEHAVIOUR.strainThreshold.value)).toBe(1);
		expect(strainMultiplier(1.1)).toBeCloseTo(BEHAVIOUR.strainMaxMultiplier.value, 9);
		expect(strainMultiplier(3)).toBe(BEHAVIOUR.strainMaxMultiplier.value);
	});

	it('cuts a vaccinated breakthrough case’s chances by its severe protection', () => {
		const d = 0.3;
		const base = counted(d, 0.5);
		const vaccine = { ...base.vaccines[0], fullInfection: 0, fullSevere: 0.8, waningMeanTicks: 0 };
		const disease = { ...base, vaccines: [vaccine] };
		const sc = singleCity({ population: 500_000, policy: policy(1000, 1), vaccinatedFull: 1 });
		const { rate, n } = deathsPerCase(disease, policy(1000, 1), 4, 4000, sc);
		expect(Math.abs(rate - d * 0.2)).toBeLessThan(tol(d * 0.2, n));
	});

	it('keeps the existing default for an unfinished course with no severe figure: shorter, never fatal', () => {
		const base = counted(0.3, 0.5);
		const vaccine = {
			...base.vaccines[0],
			hasPartialCourse: true,
			partialInfection: 0,
			partialSevere: 1,
			partialShortIll: true
		};
		const disease = { ...base, vaccines: [vaccine] };
		const sc = singleCity({ population: 500_000, policy: policy(1000, 1), vaccinatedPartial: 1 });
		const sim = createSimulation(sc, { seed: 5, diseaseId: 'flu', disease });
		const a = sim.agents;
		const cases = sim.seedNow(0, 1000);
		expect(cases.every((i) => a.protection[i] === Protection.PARTIAL && a.shortIll[i] === 1)).toBe(true);
		sim.step(disease.silentTicks + disease.shortIllTicks + 2);
		expect(cases.every((i) => a.state[i] === State.RECOVERED)).toBe(true);
	});

	it('starts the general default Coping and the England (NHS) preset Under pressure', () => {
		const eu = createSimulation(singleCity(), { seed: 1, diseaseId: 'flu' }).snapshot().regions[0];
		expect(eu.pressure).toBeCloseTo(1 - BEHAVIOUR.spareBedShare.value, 6);
		expect(eu.pressureBand).toBe('coping');
		expect(eu.strain).toBe(1);
		const england = createSimulation(singleCity({ policy: structuredClone(ENGLAND_POLICY) }), {
			seed: 1,
			diseaseId: 'flu'
		}).snapshot().regions[0];
		expect(england.pressureBand).toBe('under-pressure');
		expect(england.strain).toBeGreaterThan(1);
	});
});

describe('waning, one step per dot (6.3)', () => {
	it('has half of a working vaccine cohort catchable again at the half-life', () => {
		const base = counted(0, 0);
		const halfLifeDays = 20;
		const vaccine = {
			...base.vaccines[0],
			fullInfection: 1,
			waningMeanTicks: Math.round((halfLifeDays / Math.LN2) * TICKS_PER_DAY)
		};
		const sc = singleCity({ population: 500_000, vaccinatedFull: 1 });
		const sim = createSimulation(sc, { seed: 6, diseaseId: 'flu', disease: { ...base, vaccines: [vaccine] } });
		const a = sim.agents;
		sim.step(halfLifeDays * TICKS_PER_DAY);
		let works = 0;
		for (let i = 0; i < a.activeCount; i++) works += a.vaccineWorks[i];
		expect(Math.abs(works / a.activeCount - 0.5)).toBeLessThan(0.03);
		// The vaccination level stays: they are still counted as vaccinated.
		for (let i = 0; i < a.activeCount; i++) expect(a.protection[i]).toBe(Protection.FULL);
	});

	it('makes recovered dots catchable again, keeping protection against severe illness', () => {
		const base = counted(0, 0, { waningMeanTicks: 1, afterInfectionSevere: 0.6 });
		const sim = createSimulation(singleCity({ population: 100_000 }), {
			seed: 7,
			diseaseId: 'flu',
			disease: base
		});
		const a = sim.agents;
		const cases = sim.seedNow(0, 200);
		sim.step(base.silentTicks + base.illTicks + 20);
		expect(cases.every((i) => a.state[i] === State.SUSCEPTIBLE)).toBe(true);
		expect(cases.every((i) => Math.abs(a.severe[i] - 0.6) < 1e-6)).toBe(true);
	});
});
