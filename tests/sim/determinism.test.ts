import { describe, expect, it } from 'vitest';
import { threeCities } from '../../src/lib/config/scenarios';
import { createSimulation } from '../../src/lib/sim/engine';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';

function run(seed: number) {
	const sim = createSimulation(threeCities(), { seed, diseaseId: 'measles' });
	sim.send({ type: 'seed', region: 2, count: 3 });
	sim.step(30 * TICKS_PER_DAY);
	sim.send({ type: 'seed', region: 1, count: 2 });
	sim.step(70 * TICKS_PER_DAY);
	return sim.snapshot();
}

describe('determinism', () => {
	it('gives identical counts on day 100 for the same seed and commands', () => {
		const a = run(42);
		const b = run(42);
		expect(a.day).toBe(100);
		expect(a.regions.map((r) => r.counts)).toEqual(b.regions.map((r) => r.counts));
		expect(a.latest).toEqual(b.latest);
	});

	it('gives a different epidemic for a different seed', () => {
		expect(run(1).totals).not.toEqual(run(2).totals);
	});
});
