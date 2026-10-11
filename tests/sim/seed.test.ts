import { describe, expect, it } from 'vitest';
import { singleCity } from '../../src/lib/config/scenarios';
import { Protection } from '../../src/lib/sim/types';
import { createSimulation } from '../../src/lib/sim/engine';

describe('seeding', () => {
	it('uses unvaccinated dots first, then the rest, so it brings in as many people as asked', () => {
		const sim = createSimulation(singleCity({ population: 200_000, vaccinatedFull: 0.97 }), {
			seed: 4,
			diseaseId: 'measles'
		});
		const a = sim.agents;
		let unvaccinated = 0;
		for (let i = 0; i < a.activeCount; i++) if (a.protection[i] === Protection.NONE) unvaccinated++;
		const asked = unvaccinated + 50;
		const dots = sim.seedNow(0, asked);
		expect(dots.length).toBe(asked);
		expect(new Set(dots).size).toBe(asked);
		// Every unvaccinated dot was used before any vaccinated one.
		expect(dots.slice(0, unvaccinated).every((i) => a.protection[i] === Protection.NONE)).toBe(true);
		expect(dots.slice(unvaccinated).every((i) => a.protection[i] !== Protection.NONE)).toBe(true);
	});
});
