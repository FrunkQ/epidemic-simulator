import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { PREGNANCY_YEARS, WEEKS_PER_YEAR, pregnantShareOf } from '../../src/lib/config/derived';
import { DISEASES } from '../../src/lib/config/diseases';
import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { MAX_HARMS, TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { Agents } from '../../src/lib/sim/agents';
import { createSimulation } from '../../src/lib/sim/engine';
import { People } from '../../src/lib/sim/people';
import { Rng } from '../../src/lib/sim/rng';
import type { Bands, DiseaseConfig, DiseaseId, DiseaseRuntime } from '../../src/lib/sim/types';
import { about, harmText } from '../../src/lib/ui/harmText';

/** The values in research/lasting-harm.md (as corrected by lasting-harm-verify.md). */
describe('lasting harm rates (6.17)', () => {
	const rate = (id: DiseaseId, key: string) =>
		(DISEASES[id] as DiseaseConfig).lastingHarm!.counted.find((h) => h.key === key)!.rate.value;

	it('matches the ruled figures', () => {
		const covid = rate('covid19', 'longCovid');
		expect(covid[0]).toBeCloseTo(0.003, 6);
		expect(covid[1]).toBeCloseTo(0.0125, 4);
		expect(covid[2]).toBeCloseTo(0.0131, 4);
		expect(rate('measles', 'brainDamage')[0]).toBeCloseTo(0.00029, 5);
		expect(rate('polio', 'paralysis')[0]).toBeCloseTo(0.08, 3);
		expect(rate('smallpox', 'pockmarks')[0]).toBeCloseTo(0.725, 9);
		expect(rate('smallpox', 'blindness')[0]).toBeCloseTo(0.0046, 4);
		const ebola = Object.fromEntries(DISEASES.ebola.lastingHarm.counted.map((h) => [h.key, h.rate.value[0]]));
		expect(ebola).toEqual({
			jointPain: expect.closeTo(0.3, 9),
			memoryLoss: expect.closeTo(0.244, 9),
			uveitis: expect.closeTo(0.143, 9),
			musclePain: expect.closeTo(0.13, 9),
			tiredness: expect.closeTo(0.121, 9),
			headache: expect.closeTo(0.12, 9)
		});
	});

	it('counts no long COVID for Omicron: no 12-month figure exists', () => {
		expect(DISEASES.covid19omicron.lastingHarm.counted).toEqual([]);
		expect(loadDisease('covid19omicron').harmRates).toEqual([]);
	});

	it('lowers long COVID only for a full COVID-19 course, by Watanabe 2023', () => {
		expect(loadDisease('covid19').harmVaccinatedFactor).toBe(0.64);
		expect(loadDisease('ebola').harmVaccinatedFactor).toBe(1);
	});

	it('works out the pregnant share from births, about 0.9% of 15-64s in the EU and 1.1% in the UK', () => {
		expect(PREGNANCY_YEARS).toBeCloseTo(0.71, 2);
		expect(pregnantShareOf('EU')).toBeCloseTo(0.0088, 4);
		expect(pregnantShareOf('UK')).toBeCloseTo(0.011, 3);
		expect(defaultPolicy().pregnantShare.value).toBe(pregnantShareOf('EU'));
	});

	it('gives the per 15-64 infection baby risks in the research table', () => {
		const perInfection = (id: DiseaseId) => {
			const d = DISEASES[id] as DiseaseConfig;
			const perCase = loadDisease(id).babyRiskPerCase * pregnantShareOf('EU');
			return perCase * (1 - d.asymptomaticFraction.value);
		};
		// Rubella: 20% over the first 20 weeks, a window of the year's weeks, needing no pregnancy length.
		expect(perInfection('rubella')).toBeCloseTo((7.909 / 1000 / 0.6335) * (20 / WEEKS_PER_YEAR) * 0.2, 6);
		expect(perInfection('rubella')).toBeCloseTo(0.00096, 5);
		expect(loadDisease('rubella').babyRiskPerCase).toBeCloseTo(
			2 * 0.2 * (20 / WEEKS_PER_YEAR / PREGNANCY_YEARS),
			9
		);
		expect(perInfection('ebola')).toBeCloseTo(0.0068, 4);
		expect(perInfection('smallpox')).toBeCloseTo(0.0028, 4);
		expect(loadDisease('measles').babyRiskPerCase).toBe(0);
	});
});

/** A disease that doesn't spread, so every case is a seeded one, among 15-64 year olds only. */
function run(id: DiseaseId, seed: number, vaccinatedFull = 0) {
	const base = loadDisease(id);
	const disease: DiseaseRuntime = { ...base, beta: 0, asymptomaticFraction: 0 };
	const policy = { ...defaultPolicy(), ageMix: { value: [0, 1, 0] as Bands, sources: [] } };
	const sim = createSimulation(
		singleCity({ population: 500_000, policy, vaccinatedFull, vaccinatedPartial: 0 }),
		{
			seed,
			diseaseId: id,
			disease
		}
	);
	sim.seedNow(0, 3000);
	sim.step(disease.silentTicks + disease.illTicks + 5 * TICKS_PER_DAY);
	const t = sim.snapshot();
	// Nobody is still ill, so everyone infected has finished their illness.
	expect(t.totals.silent + t.totals.symptomatic).toBe(0);
	return { t, cases: t.regions[0].counts.everInfected, disease, policy };
}

describe('the lasting harm tally (6.17)', () => {
	it('counts each harm as its rate times the people who survived, with no draw', () => {
		const { t, cases, disease } = run('ebola', 4);
		const r = t.regions[0];
		const survivors = cases - r.deaths;
		expect(survivors).toBeGreaterThan(0);
		disease.harmRates.forEach((rate, h) => expect(r.harmed[h]).toBeCloseTo(survivors * rate[1], 6));
		// Babies come from everyone whose illness ended, survivors or not.
		expect(r.babies).toBeCloseTo(cases * pregnantShareOf('EU') * disease.babyRiskPerCase, 6);
		// The headline channel is the largest harm, in thousandths, never the sum.
		expect(t.latest[0].lastingHarm).toBe(Math.round(Math.max(...r.harmed) * 1000));
	});

	it('leaves the run itself unchanged: the same seed gives the same deaths with or without harm', () => {
		const a = run('covid19', 7);
		const plain = loadDisease('covid19');
		const policy = { ...defaultPolicy(), ageMix: { value: [0, 1, 0] as Bands, sources: [] } };
		const sim = createSimulation(
			singleCity({ population: 500_000, policy, vaccinatedFull: 0, vaccinatedPartial: 0 }),
			{
				seed: 7,
				diseaseId: 'covid19',
				disease: { ...plain, beta: 0, asymptomaticFraction: 0, harmRates: [], babyRiskPerCase: 0 }
			}
		);
		sim.seedNow(0, 3000);
		sim.step(a.disease.silentTicks + a.disease.illTicks + 5 * TICKS_PER_DAY);
		expect(sim.snapshot().regions[0].deaths).toBe(a.t.regions[0].deaths);
		expect(sim.snapshot().regions[0].harmed).toEqual([]);
	});

	it('gives fully vaccinated people who still fall ill 0.64 times the long COVID rate', () => {
		const { t, cases, disease } = run('covid19', 2, 1);
		const r = t.regions[0];
		const survivors = cases - r.deaths;
		expect(r.harmed[0]).toBeCloseTo(survivors * disease.harmRates[0][1] * 0.64, 6);
	});
});

describe('lasting harm on the map (6.17)', () => {
	it('follows the people: never more than a city’s recovered, and the world total is the cities plus travellers', () => {
		// Smallpox: everyone infected falls ill and immunity never fades, so every survivor is recovered.
		const sim = createSimulation(microcosm(), { seed: 1, diseaseId: 'smallpox' });
		for (const r of [0, 1, 2]) sim.send({ type: 'seed', region: r, count: 3 });
		const rate = DISEASES.smallpox.lastingHarm.counted[0].rate.value[0];
		let checked = 0;
		for (let day = 0; day < 150; day++) {
			sim.step(TICKS_PER_DAY);
			if (day % 10 !== 9) continue;
			const t = sim.snapshot();
			for (const r of t.regions) expect(r.harmed[0]).toBeLessThanOrEqual(r.counts.recovered * rate + 1e-6);
			const world = t.regions.reduce((a, r) => a + r.harmed[0], 0) + t.harmedInTransit[0];
			const survivors =
				t.regions.reduce((a, r) => a + r.counts.everInfected - r.deaths, 0) -
				t.totals.symptomatic -
				t.totals.silent;
			expect(world).toBeCloseTo(survivors * rate, 4);
			if (survivors > 1000) checked++;
		}
		expect(checked).toBeGreaterThan(5);
	});

	it.each(['covid19', 'covid19omicron'] as const)(
		'%s: never gives a dot more survivors than people who may have had it, with travel and reinfection',
		(id) => {
			// Immunity wanes and people catch it again, ill or silent, and travel between cities.
			const sim = createSimulation(microcosm(), { seed: 1, diseaseId: id });
			for (const r of [0, 1, 2]) sim.send({ type: 'seed', region: r, count: 10 });
			const p = sim.people;
			let reinfected = 0;
			for (let day = 0; day < 400; day++) {
				sim.step(TICKS_PER_DAY);
				if (day % 5 !== 4) continue;
				for (let i = 0; i < sim.agents.activeCount; i++) {
					const pool =
						p.recovered[i] +
						p.susceptibleAgain[i] +
						p.illAgain[i] +
						p.silentAgain[i] +
						p.silentAsymptomatic[i];
					expect(p.illSurvivors[i], `dot ${i}, day ${day + 1}`).toBeLessThanOrEqual(pool + 1e-9);
					expect(p.illSurvivors[i]).toBeLessThanOrEqual(p.perDot - p.dead[i] + 1e-9);
					expect(p.illSurvivors[i]).toBeGreaterThanOrEqual(-1e-9);
					reinfected += p.illAgain[i] + p.silentAgain[i];
				}
			}
			expect(reinfected).toBeGreaterThan(0);
		}
	);

	it.each(['polio', 'rubella', 'chickenpox'] as const)(
		'%s: with lifelong immunity, never gives a dot more survivors than its recovered, with travel',
		(id) => {
			// Nobody catches it twice, so every survivor is recovered, and people who never got symptoms
			// carry no share when they move.
			const sim = createSimulation(microcosm(), { seed: 1, diseaseId: id });
			for (const r of [0, 1, 2]) sim.send({ type: 'seed', region: r, count: 10 });
			const p = sim.people;
			let survivors = 0;
			for (let day = 0; day < 200; day++) {
				sim.step(TICKS_PER_DAY);
				for (let i = 0; i < sim.agents.activeCount; i++) {
					expect(p.illSurvivors[i], `dot ${i}, day ${day + 1}`).toBeLessThanOrEqual(p.recovered[i] + 1e-9);
					expect(p.illSurvivors[i]).toBeGreaterThanOrEqual(-1e-9);
					if (day === 199) survivors += p.illSurvivors[i];
				}
			}
			expect(survivors).toBeGreaterThan(0);
		}
	);

	it('counts a reinfected person once whether they live or die, even if their first time was silent', () => {
		// One dot: 60 people have had it, 50 of them counted as survivors. 10 of the 60 fall ill again,
		// each holding 50/60 of a survivor. If all 10 die they take 10 x 50/60 with them; if all live,
		// all 10 are survivors now, including the 10/6 whose first time had no symptoms.
		const end = (died: boolean) => {
			const p = new People(new Agents(), loadDisease('covid19'), 100, false);
			p.recovered[0] = 50;
			p.illSurvivors[0] = 50;
			const hooks = { onInfected() {}, onIllnessEnd() {}, onSymptoms() {} };
			const endIllness = (p as unknown as { endIllness: (...a: unknown[]) => void }).endIllness.bind(p);
			endIllness(0, 0, 10, 10, -1, new Rng(1), hooks, () => (died ? 1 : 0));
			return p.illSurvivors[0];
		};
		expect(end(true)).toBeCloseTo(50 - (10 * 50) / 60, 9);
		expect(end(false)).toBeCloseTo(50 + 10 - (10 * 50) / 60, 9);
	});

	it('works out a trip group’s share over the whole pool, the dot’s other reinfected people included', () => {
		// One dot: 30 recovered and 20 whose immunity wore off, 40 of the 50 counted as survivors. All
		// 20 catch it again; 10 fall ill on a trip (an away group), 10 at home, and all end on one tick.
		// Each holds 40/50 of a survivor while ill. The away group ends first, over the pool of 50:
		// 40 - 10 x 0.8 + 10 = 42. Then the 10 at home, over 40 recovered plus themselves: 42 - 10 x
		// 42/50 + 10 = 43.6. Leaving the home group out of the first pool (30 + 10) would give 42.
		const disease = { ...loadDisease('covid19'), asymptomaticFraction: 0 };
		const p = new People(new Agents(), disease, 100, false);
		p.recovered[0] = 30;
		p.susceptibleAgain[0] = 20;
		p.illSurvivors[0] = 40;
		const hooks = {
			onInfected() {},
			onIllnessEnd() {},
			onSymptoms(i: number, _first: number, again: number, tick: number) {
				if (again === 20) p.markAway(i, tick, 0, 10, 1);
			}
		};
		const rng = new Rng(1);
		p.infect(0, 20, 0, rng, hooks, false);
		expect(p.illAgain[0] + p.silentAgain[0]).toBe(20);
		for (let tick = 1; tick <= disease.silentTicks + disease.illTicks + 1; tick++)
			p.advance(tick, rng, hooks, () => 0, true);
		expect(p.illAgain[0] + p.silentAgain[0]).toBe(0);
		expect(p.illSurvivors[0]).toBeCloseTo(43.6, 9);
	});

	it('counts people whose immunity has worn off, who still live with the harm', () => {
		const sim = createSimulation(microcosm(), { seed: 2, diseaseId: 'covid19' });
		sim.send({ type: 'seed', region: 0, count: 20 });
		sim.step(400 * TICKS_PER_DAY);
		let survivors = 0;
		let waned = 0;
		for (let i = 0; i < sim.agents.activeCount; i++) {
			survivors += sim.people.illSurvivors[i];
			waned += sim.people.susceptibleAgain[i];
			expect(sim.people.illSurvivors[i]).toBeLessThanOrEqual(sim.people.perDot - sim.people.dead[i] + 1e-9);
		}
		expect(waned).toBeGreaterThan(0);
		expect(survivors).toBeGreaterThan(0);
	});
});

describe('what the card says about lasting harm (6.17)', () => {
	it('says "about" for one harm and "at least" the largest for several, never their sum', () => {
		expect(harmText(DISEASES.covid19, [12.4], 0, false).line).toBe(
			'about 12 people here live with lasting harm'
		);
		const ebola = harmText(DISEASES.ebola, [30, 24.4, 14.3, 13, 12.1, 12], 3.2, true);
		expect(ebola.line).toBe('of whom at least 30 live with lasting harm');
		expect(ebola.hover.split('\n')[1]).toBe('About 30: Joint pain.');
		expect(ebola.babies).toBe('About 3 babies harmed or pregnancies lost here');
	});

	it('names harms with no figure as not counted, and shows no babies line without a figure', () => {
		const mumps = harmText(DISEASES.mumps, [], 0, true);
		expect(mumps.line).toBe('lasting harm: not counted');
		expect(mumps.hover).toContain('Not counted: no figure for permanent deafness.');
		expect(mumps.babies).toBeNull();
	});

	it('reads grammatically for one person or fewer', () => {
		expect(harmText(DISEASES.covid19, [0.3], 0, false).line).toBe(
			'fewer than 1 person here lives with lasting harm'
		);
		expect(harmText(DISEASES.covid19, [1.2], 0, false).line).toBe(
			'about 1 person here lives with lasting harm'
		);
		// Several harms: one person can have more than one, so the people harmed are at most the sum.
		const ebola = harmText(DISEASES.ebola, [0.4, 0.3, 0.2, 0.1, 0.1, 0.1], 0.2, true);
		expect(ebola.line).toBe('of whom up to 1 lives with lasting harm');
		expect(harmText(DISEASES.ebola, [0.1, 0.1, 0.1, 0.1, 0, 0], 0, true).line).toBe(
			'of whom fewer than 1 lives with lasting harm'
		);
		expect(harmText(DISEASES.ebola, [0.4, 0.4, 0.4, 0.4, 0.4, 0.4], 0, true).line).toBe(
			'of whom up to 2 live with lasting harm'
		);
		expect(ebola.hover.split('\n')[1]).toBe('Fewer than 1: Joint pain.');
		expect(ebola.babies).toBe('Fewer than 1 baby harmed or pregnancy lost here');
		expect(harmText(DISEASES.ebola, [1, 1, 1, 1, 1, 1], 1, true).babies).toBe(
			'About 1 baby harmed or pregnancy lost here'
		);
	});

	it('says none so far, not "at least 0", before anyone is harmed', () => {
		expect(harmText(DISEASES.ebola, [0, 0, 0, 0, 0, 0], 0, true).line).toBe(
			'of whom none so far live with lasting harm'
		);
		expect(harmText(DISEASES.covid19, [0], 0, false).line).toBe('nobody here lives with lasting harm so far');
		expect(harmText(DISEASES.ebola, [0, 0, 0, 0, 0, 0], 0, true).babies).toBe(
			'No babies harmed or pregnancies lost here so far'
		);
	});

	it('never shows a doubled "not counted" in any disease’s text', () => {
		for (const d of Object.values(DISEASES) as DiseaseConfig[]) {
			const t = harmText(d, [0.3, 2, 2, 2, 2, 2], 0.3, true);
			for (const text of [t.line ?? '', t.hover, t.babies ?? '', t.babiesHover])
				expect(text, d.id).not.toMatch(/: not counted:/i);
		}
	});

	it('never rounds a count of some people down to 0', () => {
		expect(about(0)).toBe('0');
		expect(about(0.3)).toBe('fewer than 1');
		expect(about(1234.6)).toBe('1,235');
	});

	it('links every figure a hover quotes to a source, marked as shown only', () => {
		for (const d of Object.values(DISEASES) as DiseaseConfig[]) {
			for (const [k, v] of Object.entries({ ...d.lastingHarm?.context, ...d.babyHarm?.context })) {
				expect(v.contextOnly, `${d.id}.${k}`).toBe(true);
				expect(v.sources.length, `${d.id}.${k}`).toBeGreaterThan(0);
			}
		}
		expect(Object.keys(DISEASES.ebola.lastingHarm.context!)).toHaveLength(6);
	});

	it('counts no harm or babies for a disease that wanes with no reinfection rule, which would count twice', () => {
		// Without an after-infection figure, a reinfection is booked as a first illness (people.ts).
		for (const id of Object.keys(DISEASES) as DiseaseId[]) {
			const d = loadDisease(id);
			if (d.waningMeanTicks > 0 && d.afterInfectionSevere === 0) {
				expect(d.harmRates, id).toEqual([]);
				expect(d.babyRiskPerCase, id).toBe(0);
			}
		}
	});

	it('counts no more harms for one disease than telemetry has room for', () => {
		for (const id of Object.keys(DISEASES) as DiseaseId[])
			expect(loadDisease(id).harmRates.length, id).toBeLessThanOrEqual(MAX_HARMS);
	});

	it('gives every disease something to say, and every counted harm a line', () => {
		for (const d of Object.values(DISEASES) as DiseaseConfig[]) {
			expect(d.lastingHarm, d.id).toBeDefined();
			for (const h of d.lastingHarm!.counted) expect(h.label.length, `${d.id}.${h.key}`).toBeGreaterThan(5);
		}
	});
});
