// Written by scripts/calibrate.ts. Do not edit by hand; rerun `npm run calibrate`.
import type { DiseaseCalibration, DiseaseId } from '../sim/types';

export const CALIBRATION: Record<DiseaseId, DiseaseCalibration> = {
	measles: { beta: 0.02796, transmissionRadius: 8, measuredR0: 14.82 },
	polio: { beta: 0.003008, transmissionRadius: 8, measuredR0: 5.96 },
	flu: { beta: 0.00271, transmissionRadius: 8, measuredR0: 1.24 }
};
