import { describe, expect, it } from 'vitest';
import { covid19BandsPerInfection } from '../../src/lib/config/covidAgeIfr';

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
});
