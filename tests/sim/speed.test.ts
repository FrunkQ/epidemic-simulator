import { describe, expect, it } from 'vitest';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { createSimulation } from '../../src/lib/sim/engine';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';

function timeStep(sim: ReturnType<typeof createSimulation>): number {
	const ticks = 300;
	const t0 = performance.now();
	sim.step(ticks);
	return (performance.now() - t0) / ticks;
}

describe('speed', () => {
	it('steps the 3-city map at 5,000 dots, with travel, in under 4 ms on average', () => {
		const scenario = microcosm(0);
		for (const r of scenario.regions) r.population = 166_667;
		const sim = createSimulation(scenario, { seed: 3, diseaseId: 'measles' });
		expect(sim.agents.activeCount).toBe(5001);
		expect(sim.routes.length).toBeGreaterThan(0);
		for (let r = 0; r < 3; r++) sim.send({ type: 'seed', region: r, count: 10 });
		sim.step(12 * TICKS_PER_DAY);
		const perTick = timeStep(sim);
		console.log(`step(1) on the 3-city map with 5,001 dots: ${perTick.toFixed(3)} ms`);
		expect(sim.snapshot().travelling).toBeGreaterThan(0);
		expect(perTick).toBeLessThan(4);
	});

	it('steps 5,000 dots mid-outbreak in under 4 ms on average', () => {
		const sim = createSimulation(singleCity({ population: 500_000 }), {
			seed: 3,
			diseaseId: 'measles'
		});
		expect(sim.agents.activeCount).toBe(5000);
		sim.send({ type: 'seed', region: 0, count: 20 });
		sim.step(12 * TICKS_PER_DAY);
		const infectious = sim.snapshot().totals;
		expect(infectious.silent + infectious.symptomatic).toBeGreaterThan(100);
		const perTick = timeStep(sim);
		console.log(`step(1) with 5,000 dots: ${perTick.toFixed(3)} ms`);
		expect(perTick).toBeLessThan(4);
	});
});
