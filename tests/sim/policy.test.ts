import { describe, expect, it } from 'vitest';
import { withValue } from '../../src/lib/config/healthPolicy';
import { microcosm } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';

function run(change: boolean) {
	const scenario = microcosm(0);
	const sim = createSimulation(scenario, { seed: 5, diseaseId: 'measles' });
	sim.send({ type: 'seed', region: 2, count: 5 });
	sim.step(10 * TICKS_PER_DAY);
	if (change) {
		const policy = withValue(scenario.regions[0].policy, 'hospitalBedsPerThousand', 2.4);
		sim.send({ type: 'policy', region: 0, policy: withValue(policy, 'spareBedShare', 0.05) });
	}
	sim.step(50 * TICKS_PER_DAY);
	return sim;
}

describe('health policy, per population and live', () => {
	it("changes only that population's beds, without a restart, and leaves the others alone", () => {
		const before = run(false);
		const after = run(true);
		const b = before.snapshot();
		const a = after.snapshot();
		expect(a.day).toBe(60);
		expect(a.regions[0].capacity).toBeCloseTo((b.regions[0].capacity * (2.4 * 0.05)) / (5.07 * 0.1), 9);
		for (const r of [1, 2]) {
			expect(a.regions[r].capacity).toBe(b.regions[r].capacity);
			expect(after.regions[r].policy).toEqual(before.regions[r].policy);
		}
		// Beds don't change the epidemic until hospital load arrives in step 3.
		expect(a.regions.map((r) => r.counts)).toEqual(b.regions.map((r) => r.counts));
	});

	it('runs a route at the lower of its two ends, the same both ways', () => {
		const scenario = microcosm(0);
		scenario.regions[0].policy = withValue(scenario.regions[0].policy, 'travelFrequency', 0);
		const sim = createSimulation(scenario, { seed: 2, diseaseId: 'flu' });
		const a = sim.agents;
		let toOrFromIsland = 0;
		let others = 0;
		for (let t = 0; t < 20 * TICKS_PER_DAY; t++) {
			sim.step(1);
			for (let i = 0; i < a.activeCount; i++) {
				const r = a.route[i];
				if (r < 0) continue;
				const route = sim.routes[r];
				if (route.from === 0 || route.to === 0) toOrFromIsland++;
				else others++;
			}
		}
		expect(toOrFromIsland).toBe(0);
		expect(others).toBeGreaterThan(0);
	});
});
