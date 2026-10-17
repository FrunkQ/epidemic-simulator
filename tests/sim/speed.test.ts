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

/** The day the lockdown case locks the city: past the start of the climb, before the peak. */
const LOCK_DAY = 35;

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

	it.each([false, true])(
		'steps 5,000 dots in under 4 ms on average through the busiest 5 days of a COVID-19 run (lockdown: %s)',
		(lockdown) => {
			// COVID-19 peaks with every dot holding someone infected, the slowest case on people counts.
			// With a lockdown, every tick also works out who stays home (6.4). Locked down from the start,
			// the outbreak dies out, so it starts once nearly every dot holds someone infected.
			const sim = createSimulation(singleCity({ population: 500_000 }), {
				seed: 3,
				diseaseId: 'covid19'
			});
			expect(sim.agents.activeCount).toBe(5000);
			sim.send({ type: 'seed', region: 0, count: 1 });
			const window = 5 * TICKS_PER_DAY;
			let worst = 0;
			let busiest = 0;
			let peakActive = 0;
			let lockedActive = 0;
			for (let day = 0; day < 150; day += 5) {
				if (lockdown && day === LOCK_DAY) sim.send({ type: 'lockdown', region: 0, on: true });
				const t0 = performance.now();
				sim.step(window);
				const perTick = (performance.now() - t0) / window;
				if (perTick > worst) {
					worst = perTick;
					busiest = day;
				}
				peakActive = Math.max(peakActive, sim.people.activeCount);
				if (lockdown && day >= LOCK_DAY) lockedActive = Math.max(lockedActive, sim.people.activeCount);
			}
			console.log(
				`busiest 5 days of COVID-19${lockdown ? ' in a lockdown' : ''} (from day ${busiest}): ${worst.toFixed(3)} ms per step`
			);
			// The run did reach a peak where nearly every dot holds someone infected.
			expect(peakActive).toBeGreaterThan(4500);
			if (lockdown) expect(lockedActive).toBeGreaterThan(4500);
			expect(worst).toBeLessThan(4);
		}
	);
});
