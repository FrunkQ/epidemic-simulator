import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../src/lib/config/diseases';
import { covid19BandsPerInfection, covid19SevereBandsPerInfection } from '../../src/lib/config/covidAgeIfr';

describe('COVID-19 deaths per infection by age', () => {
	it('brackets the central 85+ choice between the low and high cases', () => {
		const central = covid19BandsPerInfection('central').bands[2];
		expect(central).toBeGreaterThan(covid19BandsPerInfection('low').bands[2]);
		expect(central).toBeLessThan(covid19BandsPerInfection('high').bands[2]);
	});

	it('gives band shares that sum to 1', () => {
		const s = covid19BandsPerInfection().shares;
		expect(s[0] + s[1] + s[2]).toBeCloseTo(1, 12);
	});

	// Lesson test 16 for COVID-19: the bands are pinned to values worked out separately by hand
	// (research/covid-age-ifr.md and covid-hospital-age.md), so a change to the inputs or the
	// derivation fails here rather than silently reproducing itself.
	const close = (got: number, want: number) => expect(Math.abs(got / want - 1)).toBeLessThan(0.002);
	it('matches the hand-worked deaths per infection by band', () => {
		const b = DISEASES.covid19.mortalityByAge!;
		[0.0000339, 0.0032673, 0.066568].forEach((v, i) => close(b.value[i], v));
		close(b.overall, 0.014344);
	});

	it('matches the hand-worked severe cases per infection by band', () => {
		const b = DISEASES.covid19.hospitalisedByAge!;
		[0.001321, 0.023525, 0.18739].forEach((v, i) => close(b.value[i], v));
		close(b.overall, 0.04972);
		expect(covid19SevereBandsPerInfection()).toEqual(b.value);
	});
});
