import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { FULL_COURSE_BORROWS_PARTIAL, PARTIAL_NO_INFECTION_FIGURE } from '../../src/lib/config/assumptions';
import { overallSevere, unvaccinatedShare, vaccineFor } from '../../src/lib/sim/disease';
import { createSimulation } from '../../src/lib/sim/engine';
import { singleCity } from '../../src/lib/config/scenarios';
import { Protection } from '../../src/lib/sim/types';
import { DISEASES } from '../../src/lib/config/diseases';
import { waningWords } from '../../src/lib/config/waning';

describe('what the card says about vaccination', () => {
	it('counts the hidden partial share as not vaccinated when the version has no unfinished course', () => {
		const omicron = loadDisease('covid19omicron');
		const updated = vaccineFor(omicron, 'covid-updated');
		const original = vaccineFor(omicron, 'covid-original');
		expect(updated.hasPartialCourse).toBe(false);
		expect(unvaccinatedShare(0.45, 0.25, updated)).toBeCloseTo(0.55, 9);
		expect(unvaccinatedShare(0.45, 0.25, original)).toBeCloseTo(0.3, 9);
		expect(unvaccinatedShare(0.45, 0.25, vaccineFor(loadDisease('marburg'), undefined))).toBe(1);
	});

	it('matches what the engine spawns', () => {
		const sim = createSimulation(
			singleCity({
				population: 500_000,
				vaccinatedFull: 0.45,
				vaccinatedPartial: 0.25,
				vaccine: 'covid-updated'
			}),
			{ seed: 1, diseaseId: 'covid19omicron' }
		);
		const a = sim.agents;
		let none = 0;
		for (let i = 0; i < a.activeCount; i++) if (a.protection[i] === Protection.NONE) none++;
		const shown = unvaccinatedShare(0.45, 0.25, vaccineFor(loadDisease('covid19omicron'), 'covid-updated'));
		expect(Math.abs(none / a.activeCount - shown)).toBeLessThan(0.02);
	});

	it('shows chickenpox full and unfinished courses with the same overall protection against serious illness', () => {
		const v = loadDisease('chickenpox').vaccines[0];
		const partial = DISEASES.chickenpox.vaccines[0].partial!.severe!.value;
		expect(partial).toBeCloseTo(0.987, 3);
		expect(overallSevere(v.fullInfection, v.fullSevere)).toBeCloseTo(partial, 9);
		expect(overallSevere(v.partialInfection, v.partialSevere)).toBeCloseTo(partial, 9);
	});

	it('says how fast protection fades, and the season figure for flu', () => {
		expect(waningWords(null)).toBe('');
		expect(waningWords(DISEASES.flu.vaccines[0].waningDays.value)).toBe(
			' just after the course, halving every 105 days'
		);
		expect(waningWords(DISEASES.smallpox.vaccines[0].waningDays.value)).toBe(
			' just after the course, halving every 20 years'
		);
		expect(DISEASES.flu.vaccines[0].cardNote).toBe(
			'Averaged over a season it protects about 41 in 100 (Guo 2024).'
		);
	});

	it('writes one About line for each borrowed or missing course figure', () => {
		expect(FULL_COURSE_BORROWS_PARTIAL).toHaveLength(1);
		expect(FULL_COURSE_BORROWS_PARTIAL[0]).toMatch(/^Chickenpox, /);
		expect(PARTIAL_NO_INFECTION_FIGURE).toHaveLength(1);
		expect(PARTIAL_NO_INFECTION_FIGURE[0]).toMatch(/^Polio, .*OPV/);
		expect(vaccineFor(loadDisease('polio'), 'OPV').partialInfectionSourced).toBe(false);
	});
});
