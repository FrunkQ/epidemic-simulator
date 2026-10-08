// Written by scripts/calibrate.ts. Do not edit by hand; rerun `npm run calibrate`.
// Seeds start at 1001; each seed runs `indexPerRun` index cases.
//   measles: target R0 15, measured 15 ± 0.269 over 60 seeds, 240 index cases
//   polio: target R0 6, measured 6.002 ± 0.101 over 50 seeds, 500 index cases
//   flu: target R0 1.3, measured 1.301 ± 0.0217 over 60 seeds, 2760 index cases
import type { DiseaseCalibration, DiseaseId } from '../sim/types';

export const CALIBRATION: Record<DiseaseId, DiseaseCalibration> = {
	measles: {
		beta: 0.0276,
		transmissionRadius: 8,
		measuredR0: 15,
		standardError: 0.269,
		seeds: 60,
		indexCases: 240
	},
	polio: {
		beta: 0.003112,
		transmissionRadius: 8,
		measuredR0: 6.002,
		standardError: 0.101,
		seeds: 50,
		indexCases: 500
	},
	flu: {
		beta: 0.003246,
		transmissionRadius: 8,
		measuredR0: 1.301,
		standardError: 0.0217,
		seeds: 60,
		indexCases: 2760
	}
};
