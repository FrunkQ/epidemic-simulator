import { describe, expect, it } from 'vitest';
import { BEHAVIOUR } from '../../src/lib/config/behaviour';
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
		const d = BEHAVIOUR;
		const ratio = (2.4 * 0.05) / (d.hospitalBedsPerThousand.value * d.spareBedShare.value);
		expect(a.regions[0].capacity).toBeCloseTo(b.regions[0].capacity * ratio, 9);
		expect(a.regions[0].beds).toBeCloseTo((b.regions[0].beds * 2.4) / d.hospitalBedsPerThousand.value, 9);
		for (const r of [1, 2]) {
			expect(a.regions[r].capacity).toBe(b.regions[r].capacity);
			expect(after.regions[r].policy).toEqual(before.regions[r].policy);
		}
		// Fewer, fuller beds put that population's hospitals under more pressure straight away.
		expect(a.regions[0].pressure).toBeGreaterThan(b.regions[0].pressure);
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

describe('the scenario passed in', () => {
	it('is never changed by a policy command, so the same scenario and seed reproduce the run', () => {
		const scenario = microcosm(0);
		const before = structuredClone(scenario);
		const run = () => {
			const sim = createSimulation(scenario, { seed: 4, diseaseId: 'measles' });
			sim.send({ type: 'seed', region: 2, count: 5 });
			sim.step(5 * TICKS_PER_DAY);
			sim.send({
				type: 'policy',
				region: 1,
				policy: withValue(scenario.regions[1].policy, 'travelFrequency', 0)
			});
			sim.step(40 * TICKS_PER_DAY);
			return sim.snapshot();
		};
		const first = run();
		expect(scenario).toEqual(before);
		expect(run().regions.map((r) => r.counts)).toEqual(first.regions.map((r) => r.counts));
	});
});
