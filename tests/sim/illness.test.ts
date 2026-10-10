import { describe, expect, it } from 'vitest';
import { cityRun } from './helpers';

describe('illness', () => {
	it('a disease with no silent phase shows symptoms the moment it is caught', () => {
		const sim = cityRun('ebola', 1);
		for (const i of sim.seedNow(0, 20)) {
			expect(sim.people.ill[i]).toBe(1);
			expect(sim.people.silentSymptomatic[i]).toBe(0);
		}
	});
});
