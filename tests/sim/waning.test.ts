import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../src/lib/config/diseases';
import { CALIBRATION } from '../../src/lib/config/diseases.generated';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { drawWaneTicks, toRuntime } from '../../src/lib/sim/disease';
import { Rng } from '../../src/lib/sim/rng';

describe('waning', () => {
	// waningDays is a half-life, as sources report protection over time (§3).
	it('has half of a protected cohort waned at waningDays', () => {
		const config = DISEASES.covid19;
		const disease = toRuntime(config, CALIBRATION.covid19);
		const rng = new Rng(7);
		const n = 20000;
		const limit = config.waningDays.value! * TICKS_PER_DAY;
		let waned = 0;
		for (let i = 0; i < n; i++) if (drawWaneTicks(disease.waningMeanTicks, rng) <= limit) waned++;
		expect(waned / n).toBeGreaterThan(0.49);
		expect(waned / n).toBeLessThan(0.51);
	});

	it('never wanes when research says protection lasts', () => {
		const disease = toRuntime(DISEASES.flu1918, CALIBRATION.flu1918);
		expect(drawWaneTicks(disease.waningMeanTicks, new Rng(1))).toBe(-1);
	});
});
