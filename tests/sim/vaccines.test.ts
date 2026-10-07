import { describe, expect, it } from 'vitest';
import { DISEASES, OMICRON_VACCINE_INPUTS } from '../../src/lib/config/diseases';
import {
	breakthroughSevereProtection,
	defaultVaccine,
	stackedProtection,
	sumDeathsPer100k,
	vaccineKey
} from '../../src/lib/config/vaccines';
import type { DiseaseConfig, Sourced, Vaccine } from '../../src/lib/sim/types';

const WITH_VACCINES = (Object.values(DISEASES) as DiseaseConfig[]).filter((d) => d.vaccines?.length);

/** Every protection share in a vaccine entry, labelled for failure messages. */
function protections(d: DiseaseConfig, v: Vaccine): [string, Sourced | null][] {
	const base = `${d.id}.${vaccineKey(v)}`;
	return [
		[`${base}.infection`, v.infection],
		[`${base}.severe`, v.severe],
		[`${base}.partial.infection`, v.partial?.infection ?? null],
		[`${base}.partial.severe`, v.partial?.severe ?? null]
	];
}

function vaccine(deaths: number | null): Vaccine {
	return {
		product: 'test',
		label: 'Test',
		infection: { value: 0.5, sources: ['x'] },
		severe: null,
		seriousPer100kDoses: { value: 1, sources: ['x'] },
		deathsPer100kDoses: { value: deaths, sources: ['x'] },
		waningDays: { value: null, sources: ['x'] }
	};
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
			expect(d.fullEfficacy.value, d.id).toBe(v.infection.value);
			expect(v.partial?.infection, `${d.id} default has no partial-course infection value`).toBeTruthy();
			expect(d.partialEfficacy.value, d.id).toBe(v.partial!.infection!.value);
		}
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
				if (v.severe) {
					expect(breakthroughSevereProtection(v.infection.value, v.severe.value), key).toBeGreaterThanOrEqual(
						0
					);
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

	it('gives every risk rate a number or null, never a missing or negative value', () => {
		for (const d of WITH_VACCINES) {
			for (const v of d.vaccines!) {
				for (const r of [v.seriousPer100kDoses, v.deathsPer100kDoses]) {
					expect(r.value === null || (Number.isFinite(r.value) && r.value >= 0), d.id).toBe(true);
				}
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
		const updated = DISEASES.covid19omicron.vaccines.find((v) => v.product === 'covid-updated')!;
		const original = DISEASES.covid19omicron.vaccines.find((v) => v.product === 'covid-original')!;
		expect(updated.infection.value).toBe(1 - (1 - k.bivalentRelativeInfection) * (1 - k.originalInfection));
		expect(updated.severe!.value).toBe(1 - (1 - k.bivalentRelativeSevere) * (1 - k.originalSevere));
		expect(updated.infection.value).toBeCloseTo(0.45, 3);
		expect(updated.severe!.value).toBeCloseTo(0.826, 3);
		// The same constants back the original vaccine's own entry.
		expect(original.infection.value).toBe(k.originalInfection);
		expect(original.severe!.value).toBe(k.originalSevere);
		expect(stackedProtection(0, 0.3)).toBeCloseTo(0.3, 12);
		expect(stackedProtection(0.5, 0.5)).toBeCloseTo(0.75, 12);
	});

	describe('sumDeathsPer100k', () => {
		it('never turns a null death rate into 0', () => {
			expect(sumDeathsPer100k([vaccine(null)])).toBeNull();
			expect(sumDeathsPer100k([vaccine(null), vaccine(null)])).toBeNull();
			expect(sumDeathsPer100k([])).toBeNull();
		});

		it('adds only confirmed rates when some are null', () => {
			expect(sumDeathsPer100k([vaccine(null), vaccine(0.25), vaccine(null), vaccine(0.5)])).toBeCloseTo(
				0.75,
				12
			);
			expect(sumDeathsPer100k([vaccine(0)])).toBe(0);
		});

		it('never lets a null reach a numeric total for any disease', () => {
			for (const d of WITH_VACCINES) {
				const rates = d.vaccines!.map((v) => v.deathsPer100kDoses.value);
				const total = sumDeathsPer100k(d.vaccines!);
				if (rates.every((r) => r === null)) expect(total, d.id).toBeNull();
				else {
					expect(total, d.id).toBeCloseTo(
						rates.reduce<number>((s, r) => (r === null ? s : s + r), 0),
						12
					);
					expect(Number.isNaN(total), d.id).toBe(false);
				}
			}
		});
	});
});
