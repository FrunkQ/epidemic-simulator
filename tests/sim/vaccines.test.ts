import { describe, expect, it } from 'vitest';
import { DISEASES, OMICRON_VACCINE_INPUTS } from '../../src/lib/config/diseases';
import { herdCoverage } from '../../src/lib/config/herd';
import {
	breakthroughSevereProtection,
	defaultVaccine,
	stackedProtection,
	vaccineCausedDeaths,
	vaccineDeathsWords,
	vaccineKey
} from '../../src/lib/config/vaccines';
import type { DiseaseConfig, Sourced, Vaccine, VaccineDeathRate } from '../../src/lib/sim/types';

const WITH_VACCINES = (Object.values(DISEASES) as DiseaseConfig[]).filter((d) => d.vaccines?.length);

/** Every protection share in a vaccine entry, labelled for failure messages. */
function protections(d: DiseaseConfig, v: Vaccine): [string, Sourced | undefined][] {
	const base = `${d.id}.${vaccineKey(v)}`;
	return [
		[`${base}.full.infection`, v.full.infection],
		[`${base}.full.severe`, v.full.severe],
		[`${base}.partial.infection`, v.partial?.infection],
		[`${base}.partial.severe`, v.partial?.severe]
	];
}

function vaccine(deaths: VaccineDeathRate): Vaccine {
	return {
		product: 'test',
		label: 'Test',
		full: { infection: { value: 0.5, sources: ['x'] } },
		seriousPer100kDoses: { value: 1, sources: ['x'] },
		deathsPer100kDoses: deaths,
		waningDays: { value: null, sources: ['x'] }
	};
}

function rateOf(v: Vaccine): number {
	const r = v.deathsPer100kDoses;
	if (r.kind !== 'rate') throw new Error(`${vaccineKey(v)} has no death rate`);
	return r.value;
}

function find(d: DiseaseConfig, key: string): Vaccine {
	const v = d.vaccines!.find((x) => vaccineKey(x) === key);
	if (!v) throw new Error(`${d.id} has no vaccine ${key}`);
	return v;
}

describe('vaccines', () => {
	it('lists vaccines for the diseases that have one', () => {
		expect(WITH_VACCINES.length).toBeGreaterThan(0);
	});

	it('marks exactly one default per disease', () => {
		for (const d of WITH_VACCINES) {
			expect(d.vaccines!.filter((v) => v.default === true).length, d.id).toBe(1);
		}
	});

	it('keys each vaccine uniquely within its disease', () => {
		for (const d of WITH_VACCINES) {
			const keys = d.vaccines!.map(vaccineKey);
			expect(new Set(keys).size, d.id).toBe(keys.length);
		}
	});

	it("keeps fullEfficacy and partialEfficacy equal to the default vaccine's infection values", () => {
		for (const d of WITH_VACCINES) {
			const v = defaultVaccine(d.vaccines)!;
			expect(d.fullEfficacy.value, d.id).toBe(v.full.infection.value);
			// "Partly vaccinated" means an unfinished course of the default vaccine (6.13).
			if (v.partial?.infection) expect(d.partialEfficacy?.value, d.id).toBe(v.partial.infection.value);
			else
				expect(d.partialEfficacy, `${d.id} has no unfinished course, so no partialEfficacy`).toBeUndefined();
		}
	});

	it('leaves out a partial course where the vaccine has none, rather than filling it with nulls', () => {
		for (const d of WITH_VACCINES) {
			for (const v of d.vaccines!) {
				const key = `${d.id}.${vaccineKey(v)}`;
				for (const course of [v.full, v.partial]) {
					if (!course) continue;
					for (const field of Object.values(course)) expect(field, key).not.toBeNull();
				}
				if (v.partial) expect(Object.keys(v.partial).length, `${key}.partial is empty`).toBeGreaterThan(0);
			}
		}
		// One-dose vaccines, and old vaccinations (which are waning, not a partial course).
		expect(DISEASES.flu.vaccines[0].partial).toBeUndefined();
		expect((DISEASES.ebola.vaccines[0] as Vaccine).partial).toBeUndefined();
		expect((DISEASES.smallpox.vaccines[0] as Vaccine).partial).toBeUndefined();
		expect(find(DISEASES.covid19omicron, 'covid-updated').partial).toBeUndefined();
	});

	it('names the same COVID-19 vaccine the same way everywhere', () => {
		const versions = (d: DiseaseConfig) => d.vaccines!.map((v) => [v.product, v.version]);
		expect(versions(DISEASES.covid19)).toEqual([['covid', 'original']]);
		expect(versions(DISEASES.covid19omicron)).toEqual([
			['covid', 'original'],
			['covid', 'updated']
		]);
	});

	it('keeps every protection between 0 and 1', () => {
		for (const d of WITH_VACCINES) {
			for (const v of d.vaccines!) {
				for (const [key, p] of protections(d, v)) {
					if (!p) continue;
					expect(p.value, key).toBeGreaterThanOrEqual(0);
					expect(p.value, key).toBeLessThanOrEqual(1);
				}
			}
		}
	});

	it('never gives breakthrough cases negative protection, for a full or a partial course', () => {
		let checked = 0;
		for (const d of WITH_VACCINES) {
			for (const v of d.vaccines!) {
				const key = `${d.id}.${vaccineKey(v)}`;
				if (v.full.severe) {
					expect(
						breakthroughSevereProtection(v.full.infection.value, v.full.severe.value),
						key
					).toBeGreaterThanOrEqual(0);
					checked++;
				}
				const p = v.partial;
				if (p?.infection && p.severe) {
					expect(
						breakthroughSevereProtection(p.infection.value, p.severe.value),
						`${key}.partial`
					).toBeGreaterThanOrEqual(0);
					checked++;
				}
			}
		}
		expect(checked).toBeGreaterThan(0);
	});

	it('works out breakthrough protection as 1 - (1 - severe) / (1 - infection)', () => {
		expect(breakthroughSevereProtection(0.5, 0.75)).toBeCloseTo(0.5, 12);
		expect(breakthroughSevereProtection(0, 0.99)).toBeCloseTo(0.99, 12);
		// Not clamped: numbers that don't fit together show up as negative.
		expect(breakthroughSevereProtection(0.9, 0.5)).toBeLessThan(0);
	});

	it('gives every risk rate a number or a sourced reason, never a missing or negative value', () => {
		for (const d of WITH_VACCINES) {
			for (const v of d.vaccines!) {
				const key = `${d.id}.${vaccineKey(v)}`;
				const s = v.seriousPer100kDoses.value;
				expect(s === null || (Number.isFinite(s) && s >= 0), key).toBe(true);
				const r = v.deathsPer100kDoses;
				expect(r.sources.length, key).toBeGreaterThan(0);
				if (r.kind === 'rate') expect(Number.isFinite(r.value) && r.value >= 0, key).toBe(true);
				if (r.kind === 'established-no-rate') expect(r.group && r.text, key).toBeTruthy();
			}
		}
	});

	it('gives every vaccine its own sourced waningDays: a positive half-life or null', () => {
		for (const d of WITH_VACCINES) {
			for (const v of d.vaccines!) {
				const key = `${d.id}.${vaccineKey(v)}.waningDays`;
				expect(v.waningDays, key).toBeDefined();
				expect(v.waningDays.sources.length, key).toBeGreaterThan(0);
				const w = v.waningDays.value;
				expect(w === null || (Number.isFinite(w) && w > 0), key).toBe(true);
			}
		}
	});

	it("works out the updated COVID-19 vaccine's protection from the original's and the bivalent's relative effectiveness", () => {
		const k = OMICRON_VACCINE_INPUTS;
		const updated = find(DISEASES.covid19omicron, 'covid-updated');
		const original = find(DISEASES.covid19omicron, 'covid-original');
		expect(updated.full.infection.value).toBe(
			1 - (1 - k.bivalentRelativeInfection) * (1 - k.originalInfection)
		);
		expect(updated.full.severe!.value).toBe(1 - (1 - k.bivalentRelativeSevere) * (1 - k.originalSevere));
		expect(updated.full.infection.value).toBeCloseTo(0.45, 3);
		expect(updated.full.severe!.value).toBeCloseTo(0.826, 3);
		// The same constants back the original vaccine's own entry.
		expect(original.full.infection.value).toBe(k.originalInfection);
		expect(original.full.severe!.value).toBe(k.originalSevere);
		expect(stackedProtection(0, 0.3)).toBeCloseTo(0.3, 12);
		expect(stackedProtection(0.5, 0.5)).toBeCloseTo(0.75, 12);
	});

	it('works out each derived number from the figures its source states', () => {
		const days = (d: DiseaseConfig, key: string) => find(d, key).waningDays.value!;
		const covid = find(DISEASES.covid19, 'covid-original');
		// Liu 0.85 falling 21 points over months 1-6 (Feikin): exponential 372, straight line 308.
		expect(days(DISEASES.covid19, 'covid-original')).toBeCloseTo(339.9, 0);
		expect(days(DISEASES.covid19omicron, 'covid-original')).toBe(143 - 14);
		expect(days(DISEASES.flu, 'inactivated')).toBeCloseTo(105, 0);
		expect(days(DISEASES.mumps, 'MMR')).toBeCloseTo(19.0 * 365.25, 9);
		expect(days(DISEASES.pertussis, 'DTaP')).toBeCloseTo(2637, 0);
		expect(days(DISEASES.smallpox, 'vaccinia')).toBeCloseTo(4 * 365.25, 9);
		expect(days(DISEASES.polio, 'OPV')).toBeCloseTo((5 / 12 + 4) * 365.25, 9);
		expect(days(DISEASES.chickenpox, 'varicella')).toBeCloseTo(3195, 0);
		expect(DISEASES.flu.waningDays.value).toBeCloseTo(4.1 * 365.25, 9);
		expect(DISEASES.pertussis.waningDays.value).toBeCloseTo(12 * 365.25, 9);
		expect(DISEASES.covid19.waningDays.value).toBeCloseTo((22 * 365.25) / 12, 9);
		// Straight line from 65.2% at 3 months to 24.7% at 12 reaches 50% at 6.38 months.
		expect(DISEASES.covid19omicron.waningDays.value).toBeCloseTo(194.1, 1);
		// Myocarditis or pericarditis 22.6 plus anaphylaxis 7.91 per million doses.
		expect(covid.seriousPer100kDoses.value).toBeCloseTo(3.051, 9);
		// At least 8 autopsy-proven deaths in 79,989,990 mRNA doses (six counts summed).
		expect(rateOf(covid)).toBeCloseTo((8 / 79_989_990) * 1e5, 12);
		expect(covid.deathsPer100kDoses).toMatchObject({ lowerBound: true });
		expect(DISEASES.measles.vaccines[0].deathsPer100kDoses.kind).toBe('established-no-rate');
		// Conversions and picks from a range: stored as the source's figures, converted here.
		expect(DISEASES.measles.vaccines[0].seriousPer100kDoses.value).toBeCloseTo((25 + 100 / 3) / 2, 9);
		expect(DISEASES.flu.vaccines[0].seriousPer100kDoses.value).toBeCloseTo(0.285, 12);
		expect(find(DISEASES.polio, 'IPV').seriousPer100kDoses.value).toBeCloseTo(0.131, 12);
		expect(find(DISEASES.polio, 'IPV').partial!.severe!.value).toBeCloseTo((0.33 + 0.41 + 0.47) / 3, 12);
		expect(find(DISEASES.polio, 'OPV').full.infection.value).toBeCloseTo(0.87, 12);
		expect(find(DISEASES.polio, 'OPV').seriousPer100kDoses.value).toBeCloseTo((0.05 + 0.1 / 3) / 2, 12);
		expect(DISEASES.pertussis.vaccines[0].seriousPer100kDoses.value).toBe(10);
		expect(find(DISEASES.smallpox, 'vaccinia').seriousPer100kDoses.value).toBeCloseTo(7.4, 12);
		expect(rateOf(find(DISEASES.smallpox, 'vaccinia'))).toBeCloseTo(0.1, 12);
		expect(DISEASES.ebola.vaccines[0].seriousPer100kDoses.value).toBeCloseTo((3 / 15_399) * 1e5, 12);
	});

	it('shows the vaccine deaths that are known, worked out from their sources', () => {
		// Paralysis from oral polio vaccine (1 per 2 to 3 million doses) x 3.5% of paralytic cases dying.
		expect(rateOf(find(DISEASES.polio, 'OPV'))).toBeCloseTo(((0.05 + 0.1 / 3) / 2) * 0.035, 12);
		// Six vaccine-strain chickenpox deaths in 132.8 million doses.
		expect(rateOf(find(DISEASES.chickenpox, 'varicella'))).toBeCloseTo(0.00452, 5);
	});

	it('marks polio herd immunity as out of reach with the default injected vaccine', () => {
		const herd = herdCoverage(DISEASES.polio);
		expect(herd.reachable).toBe(false);
		expect(herd.coverage).toBeGreaterThan(1);
	});

	describe('vaccineCausedDeaths', () => {
		const none: VaccineDeathRate = { kind: 'none-established', sources: ['x'] };
		const noRate: VaccineDeathRate = {
			kind: 'established-no-rate',
			group: 'people with severe immune deficiencies',
			text: 't',
			sources: ['x']
		};

		it('never turns a missing rate into 0, for any number of doses', () => {
			for (const doses of [0, 1_000_000]) {
				expect(vaccineCausedDeaths(vaccine(none), doses)).toEqual({ kind: 'none-established' });
				expect(vaccineCausedDeaths(vaccine(noRate), doses)).toEqual({
					kind: 'established-no-rate',
					group: 'people with severe immune deficiencies'
				});
			}
		});

		it('scales a known rate by the doses given and keeps "at least"', () => {
			expect(vaccineCausedDeaths(vaccine({ kind: 'rate', value: 0.5, sources: ['x'] }), 200_000)).toEqual({
				kind: 'rate',
				deaths: 1,
				lowerBound: false
			});
			expect(
				vaccineCausedDeaths(vaccine({ kind: 'rate', value: 0.5, sources: ['x'], lowerBound: true }), 0)
			).toEqual({ kind: 'rate', deaths: 0, lowerBound: true });
			expect(() => vaccineCausedDeaths(vaccine(none), -1)).toThrow(RangeError);
		});

		it('gives words for every kind without a number', () => {
			expect(vaccineDeathsWords({ kind: 'none-established' })).toBe(
				'No deaths confirmed as caused by this vaccine.'
			);
			expect(
				vaccineDeathsWords({ kind: 'established-no-rate', group: 'people with severe immune deficiencies' })
			).toBe(
				"Deaths have been confirmed in people with severe immune deficiencies, for whom it isn't recommended. No rate has been published."
			);
			expect(vaccineDeathsWords({ kind: 'rate', deaths: 1, lowerBound: false })).toBeNull();
		});

		it('handles every product in the catalogue, never giving NaN', () => {
			for (const d of WITH_VACCINES) {
				for (const v of d.vaccines!) {
					const result = vaccineCausedDeaths(v, 100_000);
					const key = `${d.id}.${vaccineKey(v)}`;
					expect(result.kind, key).toBe(v.deathsPer100kDoses.kind);
					if (result.kind === 'rate') expect(result.deaths, key).toBeCloseTo(rateOf(v), 12);
					else expect(vaccineDeathsWords(result), key).toBeTruthy();
				}
			}
		});
	});
});
