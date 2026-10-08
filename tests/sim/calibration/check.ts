import { expect, it } from 'vitest';
import { MAX_RELATIVE_SE, measureR0 } from '../../../scripts/calibrate';
import { DISEASES } from '../../../src/lib/config/diseases';
import { CALIBRATION } from '../../../src/lib/config/diseases.generated';
import type { DiseaseId } from '../../../src/lib/sim/types';

/** Seeds the calibration never used, so this is a fresh measurement, not a replay. */
const CHECK_SEED_BASE = 50_000;

/**
 * Re-measures R0 at the committed spread chance. One test file per disease, so vitest runs
 * them in parallel and the suite stays inside its time budget.
 */
export function checkCalibration(id: DiseaseId): void {
	it(`${id} spreads at its research R0 with the committed spread chance`, { timeout: 600_000 }, () => {
		const cal = CALIBRATION[id];
		const target = DISEASES[id].r0.value;
		expect(cal.seeds, 'calibration not rerun').toBeGreaterThan(0);
		expect(cal.standardError).toBeLessThan(MAX_RELATIVE_SE * target);
		const m = measureR0(id, cal.beta, cal.transmissionRadius, cal.seeds, CHECK_SEED_BASE);
		// The committed beta was fitted on noisy seeds and this check is noisy too, so the gap from the
		// target is judged against both standard errors combined.
		const se = Math.hypot(m.se, cal.standardError);
		expect(Math.abs(m.r0 - target)).toBeLessThanOrEqual(3 * se);
	});
}
