import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { singleCity } from '../../src/lib/config/scenarios';
import { createSimulation } from '../../src/lib/sim/engine';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';

describe('speed', () => {
	it('steps 5,000 dots mid-outbreak in under 4 ms on average', () => {
		const sim = createSimulation(singleCity({ population: 500_000 }), {
			seed: 3,
			disease: loadDisease('measles')
		});
		expect(sim.agents.activeCount).toBe(5000);
		sim.send({ type: 'seed', region: 0, count: 20 });
		sim.step(12 * TICKS_PER_DAY);
		const infectious = sim.snapshot().totals;
		expect(infectious.silent + infectious.symptomatic).toBeGreaterThan(100);
		const ticks = 300;
		const t0 = performance.now();
		sim.step(ticks);
		const perTick = (performance.now() - t0) / ticks;
		console.log(`step(1) with 5,000 dots: ${perTick.toFixed(3)} ms`);
		expect(perTick).toBeLessThan(4);
	});
});
