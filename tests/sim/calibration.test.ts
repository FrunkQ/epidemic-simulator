import { describe, expect, it } from 'vitest';
import { measureR0 } from '../../scripts/calibrate';
import { DISEASES } from '../../src/lib/config/diseases';
import { CALIBRATION } from '../../src/lib/config/diseases.generated';
import type { DiseaseId } from '../../src/lib/sim/types';

/** Seeds the calibration never used, so this is a fresh measurement, not a replay. */
const CHECK_SEED_BASE = 50_000;

describe('calibration', () => {
	for (const id of Object.keys(DISEASES) as DiseaseId[]) {
		it(`${id} spreads at its research R0 with the committed spread chance`, { timeout: 600_000 }, () => {
			const cal = CALIBRATION[id];
			const target = DISEASES[id].r0.value;
			expect(cal.seeds, 'calibration not rerun').toBeGreaterThan(0);
			expect(cal.standardError).toBeLessThan(0.02 * target);
			const m = measureR0(id, cal.beta, cal.transmissionRadius, cal.seeds, CHECK_SEED_BASE);
			expect(Math.abs(m.r0 - target)).toBeLessThanOrEqual(3 * m.se);
		});
	}
});
