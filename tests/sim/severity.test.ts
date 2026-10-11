import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import { POPULATION } from '../../src/lib/config/population';
import { defaultPolicy, ENGLAND_POLICY, withValue } from '../../src/lib/config/healthPolicy';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { DISEASES } from '../../src/lib/config/diseases';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, strainMultiplier } from '../../src/lib/sim/engine';
import { hospitalRegion } from '../../src/lib/sim/disease';
import {
	Protection,
	type Bands,
	type DiseaseConfig,
	type DiseaseId,
	type DiseaseRuntime,
	type HealthPolicy,
	type Scenario
} from '../../src/lib/sim/types';
import type { PeopleHooks } from '../../src/lib/sim/people';

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
function deathsPerCase(
	disease: DiseaseRuntime,
	p: HealthPolicy,
	seed: number,
	cases = 4000,
	scenario?: Scenario
) {
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

	// The death rule gives exactly d deaths per case when there is no strain, whether the band
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

		it(`raises deaths under strain, but never past every case with a bed plus the no-bed deaths (d ${d}, h ${h})`, () => {
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

	it('never protects an unfinished course better than a full one, against infection or serious illness', () => {
		// Overall protection against serious illness: kept from catching it, or caught it but protected.
		const overall = (infection: number, breakthrough: number) => 1 - (1 - infection) * (1 - breakthrough);
		for (const config of Object.values(DISEASES) as DiseaseConfig[]) {
			for (const v of loadDisease(config.id as DiseaseId).vaccines) {
				if (!v.hasPartialCourse) continue;
				const key = `${config.id} ${v.key}`;
				expect(v.fullInfection, key).toBeGreaterThanOrEqual(v.partialInfection);
				expect(overall(v.fullInfection, v.fullSevere), key).toBeGreaterThanOrEqual(
					overall(v.partialInfection, v.partialSevere) - 1e-9
				);
			}
		}
	});

	const noVaccine = (Object.values(DISEASES) as DiseaseConfig[])
		.filter((d) => !d.vaccines?.length)
		.map((d) => d.id as DiseaseId);
	it('covers every disease with no vaccine', () =>
		expect(noVaccine).toEqual(['marburg', 'flu1918', 'plague']));
	for (const id of noVaccine) {
		it(`vaccinates nobody against a disease with no vaccine, whatever the coverage (${id})`, () => {
			const real = loadDisease(id);
			expect(real.vaccines.every((v) => !v.exists && !v.hasPartialCourse)).toBe(true);
			const disease = { ...real, beta: 0, asymptomaticFraction: 0 };
			const sc = singleCity({
				population: 500_000,
				policy: policy(1000, 1),
				vaccinatedFull: 0.5,
				vaccinatedPartial: 0.3
			});
			const { rate, n, sim } = deathsPerCase(disease, policy(1000, 1), 8, 4000, sc);
			const a = sim.agents;
			for (let i = 0; i < a.activeCount; i++) expect(a.protection[i]).toBe(Protection.NONE);
			const d = disease.mortalityByBand[1];
			expect(Math.abs(rate - d)).toBeLessThan(tol(d, n));
		});
	}

	it('moves pressure by h / beds for one more ill dot (expected-value beds, 6.6)', () => {
		const h = 0.2;
		const p = policy(3, 0.3);
		const sim = createSimulation(singleCity({ population: 500_000, policy: p }), {
			seed: 9,
			diseaseId: 'flu',
			disease: counted(0, h)
		});
		const before = sim.snapshot().regions[0];
		sim.seedNow(0, 1);
		sim.step(loadDisease('flu').silentTicks + 1);
		const after = sim.snapshot().regions[0];
		expect(after.counts.symptomatic).toBe(1);
		expect(after.patients).toBeCloseTo(h, 6);
		expect(after.pressure - before.pressure).toBeCloseTo(h / after.beds, 6);
	});

	it('fills a bed from the tick symptoms start plus the admission delay, for the hospital stay (6.6)', () => {
		const h = 0.2;
		const delay = 3 * TICKS_PER_DAY;
		const stay = 5 * TICKS_PER_DAY;
		const sim = createSimulation(singleCity({ population: 500_000, policy: policy(3, 0.3) }), {
			seed: 9,
			diseaseId: 'flu',
			disease: counted(0, h, { admissionDelayTicks: delay, hospitalStayTicks: stay })
		});
		sim.seedNow(0, 1);
		let onset = -1;
		const seen: number[] = [];
		for (let t = 1; t <= 400; t++) {
			sim.step(1);
			const r = sim.snapshot().regions[0];
			if (onset < 0 && r.counts.symptomatic === 1) onset = t;
			seen.push(r.patients);
		}
		expect(onset).toBeGreaterThan(0);
		seen.forEach((patients, k) => {
			const t = k + 1;
			const inBed = t >= onset + delay && t < onset + delay + stay;
			expect(patients, `tick ${t}`).toBeCloseTo(inBed ? h : 0, 6);
		});
	});

	it('keeps a bed for its whole stay, even after the illness is over', () => {
		const h = 0.2;
		const disease = counted(0, h);
		const stay = disease.illTicks + 10 * TICKS_PER_DAY;
		const sim = createSimulation(singleCity({ population: 500_000, policy: policy(3, 0.3) }), {
			seed: 9,
			diseaseId: 'flu',
			disease: { ...disease, hospitalStayTicks: stay }
		});
		sim.seedNow(0, 1);
		sim.step(disease.silentTicks + disease.illTicks + 2);
		const r = sim.snapshot().regions[0];
		expect(r.counts.symptomatic).toBe(0);
		expect(r.patients).toBeCloseTo(h, 6);
	});

	it('with no timing figures, counts every ill dot’s expected beds in its region, as before', () => {
		const scenario = microcosm(0);
		for (const r of scenario.regions) {
			r.vaccinatedFull = 0;
			r.vaccinatedPartial = 0;
			r.policy = withValue(r.policy, 'travelFrequency', 0);
		}
		const disease = loadDisease('measles');
		expect(disease.admissionDelayTicks).toBe(0);
		expect(disease.hospitalStayTicks).toBe(disease.illTicks);
		const sim = createSimulation(scenario, { seed: 10, diseaseId: 'measles' });
		sim.send({ type: 'seed', region: 0, count: 50 });
		const a = sim.agents;
		const p = sim.people;
		let ill = 0;
		for (let day = 0; day < 40; day++) {
			sim.step(TICKS_PER_DAY);
			const expected = new Array(scenario.regions.length).fill(0);
			for (let i = 0; i < a.activeCount; i++) {
				if (p.ill[i] === 0) continue;
				ill += p.ill[i];
				const h = disease.hospitalByBand[a.ageBand[i]];
				const again = p.illAgain[i];
				expected[a.region[i]] +=
					h * ((p.ill[i] - again) * (1 - p.severe[i]) + again * (1 - p.severeAgain(i)));
			}
			sim.snapshot().regions.forEach((r, k) => expect(r.patients, `region ${k}`).toBeCloseTo(expected[k], 4));
		}
		expect(ill).toBeGreaterThan(0);
	});

	it('loses and doubles no bed when ill travellers land, and counts a traveller’s strain in its origin', () => {
		const scenario = microcosm(0);
		for (const r of scenario.regions) {
			r.vaccinatedFull = 0;
			r.vaccinatedPartial = 0;
			r.policy = withValue(r.policy, 'travelFrequency', 3);
		}
		const disease = loadDisease('measles');
		const sim = createSimulation(scenario, { seed: 10, diseaseId: 'measles' });
		sim.send({ type: 'seed', region: 0, count: 50 });
		const a = sim.agents;
		const p = sim.people;
		const routes = sim.routes;
		let travellersIll = 0;
		for (let t = 0; t < 40 * TICKS_PER_DAY; t++) {
			sim.step(1);
			let total = 0;
			for (let i = 0; i < a.activeCount; i++) {
				if (p.ill[i] === 0) continue;
				if (a.region[i] < 0) {
					// Worked out here from the route, not with the engine's helper.
					const route = routes[a.route[i]];
					travellersIll++;
					expect(hospitalRegion(a, routes, i)).toBe(a.routeDir[i] > 0 ? route.from : route.to);
				}
				const h = disease.hospitalByBand[a.ageBand[i]];
				const again = p.illAgain[i];
				total += h * ((p.ill[i] - again) * (1 - p.severe[i]) + again * (1 - p.severeAgain(i)));
			}
			const patients = sim.snapshot().regions.reduce((s, r) => s + r.patients, 0);
			expect(patients, `tick ${t}`).toBeCloseTo(total, 4);
		}
		expect(travellersIll).toBeGreaterThan(0);
	});

	it('keeps a bed, strain and any death in the city where symptoms started, a trip’s origin on the way (6.8)', () => {
		const scenario = microcosm(0);
		for (const r of scenario.regions) {
			r.vaccinatedFull = 0;
			r.vaccinatedPartial = 0;
			r.policy = withValue(r.policy, 'travelFrequency', 3);
		}
		const disease = loadDisease('measles');
		const sim = createSimulation(scenario, { seed: 10, diseaseId: 'measles' });
		const a = sim.agents;
		const p = sim.people;
		const routes = sim.routes;
		const stay = disease.hospitalStayTicks;
		// Recounted from each start of symptoms, with the city worked out here from the route.
		const onsets: { tick: number; region: number; need: number }[] = [];
		let onTrips = 0;
		let endedAway = 0;
		const deaths = new Array(scenario.regions.length).fill(0);
		const hooks = (sim as unknown as { hooks: PeopleHooks }).hooks;
		const { onSymptoms, onIllnessEnd } = hooks;
		hooks.onSymptoms = (dot, first, again, tick) => {
			let region = a.region[dot];
			if (region < 0) {
				const route = routes[a.route[dot]];
				region = a.routeDir[dot] > 0 ? route.from : route.to;
				onTrips += first + again;
			}
			const h = disease.hospitalByBand[a.ageBand[dot]];
			onsets.push({
				tick,
				region,
				need: h * (first * (1 - p.severe[dot]) + again * (1 - p.severeAgain(dot)))
			});
			onSymptoms(dot, first, again, tick);
		};
		hooks.onIllnessEnd = (dot, people, died, region) => {
			if (region >= 0) endedAway += people;
			deaths[region >= 0 ? region : hospitalRegion(a, routes, dot)] += died;
			onIllnessEnd(dot, people, died, region);
		};
		sim.send({ type: 'seed', region: 0, count: 50 });
		let landedIll = 0;
		for (let t = 1; t <= 120 * TICKS_PER_DAY; t++) {
			sim.step(1);
			const expected = new Array(scenario.regions.length).fill(0);
			for (const o of onsets) if (o.tick > t - stay && o.tick <= t) expected[o.region] += o.need;
			const regions = sim.snapshot().regions;
			regions.forEach((r, k) => expect(r.patients, `region ${k}, tick ${t}`).toBeCloseTo(expected[k], 6));
			for (let i = 0; i < a.activeCount; i++) if (a.region[i] >= 0) landedIll += p.awayCount(i);
		}
		const regions = sim.snapshot().regions;
		regions.forEach((r, k) => expect(r.deaths, `region ${k}`).toBe(deaths[k]));
		expect(onTrips).toBeGreaterThan(0);
		// Some landed while still ill, and every one of them ended their illness in the trip's hospital.
		expect(landedIll).toBeGreaterThan(0);
		expect(sim.anyInfected()).toBe(false);
		expect(endedAway).toBe(onTrips);
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

describe('waning, person by person (6.3)', () => {
	it('has half of a working vaccine cohort catchable again at the half-life', () => {
		const base = counted(0, 0);
		const halfLifeDays = 20;
		const vaccine = {
			...base.vaccines[0],
			fullInfection: 1,
			waningMeanTicks: Math.round((halfLifeDays / Math.LN2) * TICKS_PER_DAY)
		};
		const sc = singleCity({ population: 500_000, vaccinatedFull: 1 });
		const sim = createSimulation(sc, {
			seed: 6,
			diseaseId: 'flu',
			disease: { ...base, vaccines: [vaccine] }
		});
		const a = sim.agents;
		sim.step(halfLifeDays * TICKS_PER_DAY);
		let works = 0;
		for (let i = 0; i < a.activeCount; i++) works += sim.people.vaccineImmune[i];
		expect(Math.abs(works / (a.activeCount * sim.people.perDot) - 0.5)).toBeLessThan(0.03);
		// The vaccination level stays: they are still counted as vaccinated.
		for (let i = 0; i < a.activeCount; i++) expect(a.protection[i]).toBe(Protection.FULL);
	});

	it('makes recovered people catchable again, keeping protection against severe illness', () => {
		const base = counted(0, 0, { waningMeanTicks: 1, afterInfectionSevere: 0.6 });
		const sim = createSimulation(singleCity({ population: 100_000 }), {
			seed: 7,
			diseaseId: 'flu',
			disease: base
		});
		const p = sim.people;
		const cases = sim.seedNow(0, 200);
		sim.step(base.silentTicks + base.illTicks + 20);
		expect(cases.every((i) => p.susceptibleAgain[i] === 1 && p.recovered[i] === 0)).toBe(true);
		expect(cases.every((i) => Math.abs(p.severeAgain(i) - 0.6) < 1e-6)).toBe(true);
	});
});
