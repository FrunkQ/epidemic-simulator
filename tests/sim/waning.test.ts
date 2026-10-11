import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../src/lib/config/diseases';
import { CALIBRATION } from '../../src/lib/config/diseases.generated';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { toRuntime } from '../../src/lib/sim/disease';
import { createSimulation } from '../../src/lib/sim/engine';

describe('waning', () => {
	// waningDays is a half-life, as sources report protection over time (§3).
	it('has half of a protected cohort waned at waningDays', () => {
		const config = DISEASES.covid19;
		const disease = {
			...toRuntime(config, CALIBRATION.covid19),
			beta: 0,
			mortality: 0,
			mortalityByBand: [0, 0, 0] as [number, number, number]
		};
		const sim = createSimulation(singleCity({ population: 500_000 }), {
			seed: 7,
			diseaseId: 'covid19',
			disease
		});
		const cases = sim.seedNow(0, 4000);
		// Everyone recovers on the same tick, then waningDays pass.
		sim.step(disease.silentTicks + disease.illTicks);
		sim.step(config.waningDays.value! * TICKS_PER_DAY);
		const p = sim.people;
		let waned = 0;
		for (const i of cases) waned += p.susceptibleAgain[i];
		expect(waned / cases.length).toBeGreaterThan(0.47);
		expect(waned / cases.length).toBeLessThan(0.53);
	});

	it('never wanes when research says protection lasts', () => {
		const disease = toRuntime(DISEASES.flu1918, CALIBRATION.flu1918);
		expect(disease.waningMeanTicks).toBe(0);
	});
});
