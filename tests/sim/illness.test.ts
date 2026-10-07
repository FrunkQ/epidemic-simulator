import { describe, expect, it } from 'vitest';
import { State } from '../../src/lib/sim/types';
import { cityRun } from './helpers';

describe('illness', () => {
	it('a disease with no silent phase shows symptoms the moment it is caught', () => {
		const sim = cityRun('ebola', 1);
		for (const i of sim.seedNow(0, 20)) expect(sim.agents.state[i]).toBe(State.SYMPTOMATIC);
	});
});
