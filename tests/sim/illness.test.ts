import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { singleCity } from '../../src/lib/config/scenarios';
import { createSimulation } from '../../src/lib/sim/engine';

describe('illness', () => {
	it('a disease with no silent phase shows symptoms the moment it is caught', () => {
		// Set explicitly: Ebola itself now has a silent incubation (6.1).
		const disease = { ...loadDisease('ebola'), silentTicks: 0, latentTicks: 0 };
		const sim = createSimulation(singleCity(), { seed: 1, diseaseId: 'ebola', disease });
		for (const i of sim.seedNow(0, 20)) {
			expect(sim.people.ill[i]).toBe(1);
			expect(sim.people.silentSymptomatic[i]).toBe(0);
		}
	});
});
