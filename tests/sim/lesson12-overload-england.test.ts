import { expect, it } from 'vitest';
import { ENGLAND_POLICY } from '../../src/lib/config/healthPolicy';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import { shareOf } from './helpers';
import { SEEDS } from './lessonRuns';

it('lesson 12: COVID-19 with the England (NHS) preset and no interventions overloads hospitals', () => {
	const share = shareOf(SEEDS, (seed) => {
		const policy = structuredClone(ENGLAND_POLICY);
		const sim = createSimulation(singleCity({ population: 200_000, policy }), { seed, diseaseId: 'covid19' });
		sim.seedNow(0, 10);
		for (let d = 0; d < 365; d++) {
			sim.step(TICKS_PER_DAY);
			if (sim.snapshot().regions[0].overloaded) return true;
		}
		return false;
	});
	expect(share).toBeGreaterThanOrEqual(0.8);
});
