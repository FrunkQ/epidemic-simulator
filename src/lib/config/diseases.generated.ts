// Written by scripts/calibrate.ts. Do not edit by hand; rerun `npm run calibrate`.
// Seeds start at 1001; each seed runs `indexPerRun` index cases.
//   measles: target R0 15, measured 15 ± 0.269 over 60 seeds, 240 index cases
//   polio: target R0 6, measured 6.002 ± 0.101 over 50 seeds, 500 index cases
//   flu: target R0 1.3, measured 1.301 ± 0.0217 over 60 seeds, 2760 index cases
//   covid19: target R0 3.32, measured 3.321 ± 0.0548 over 60 seeds, 1080 index cases
//   chickenpox: target R0 5, measured 5.013 ± 0.0928 over 50 seeds, 600 index cases
//   mumps: target R0 11, measured 10.99 ± 0.203 over 50 seeds, 250 index cases
//   rubella: target R0 5, measured 4.997 ± 0.0879 over 50 seeds, 600 index cases
//   pertussis: target R0 5.5, measured 5.506 ± 0.0871 over 70 seeds, 770 index cases
//   smallpox: target R0 5, measured 4.998 ± 0.0892 over 50 seeds, 600 index cases
//   ebola: target R0 1.8, measured 1.795 ± 0.03 over 60 seeds, 1980 index cases
//   marburg: target R0 1.59, measured 1.591 ± 0.0268 over 60 seeds, 2280 index cases
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
	},
	covid19: {
		beta: 0.004827,
		transmissionRadius: 8,
		measuredR0: 3.321,
		standardError: 0.0548,
		seeds: 60,
		indexCases: 1080
	},
	chickenpox: {
		beta: 0.01124,
		transmissionRadius: 8,
		measuredR0: 5.013,
		standardError: 0.0928,
		seeds: 50,
		indexCases: 600
	},
	mumps: {
		beta: 0.02526,
		transmissionRadius: 8,
		measuredR0: 10.99,
		standardError: 0.203,
		seeds: 50,
		indexCases: 250
	},
	rubella: {
		beta: 0.005498,
		transmissionRadius: 8,
		measuredR0: 4.997,
		standardError: 0.0879,
		seeds: 50,
		indexCases: 600
	},
	pertussis: {
		beta: 0.002916,
		transmissionRadius: 8,
		measuredR0: 5.506,
		standardError: 0.0871,
		seeds: 70,
		indexCases: 770
	},
	smallpox: {
		beta: 0.004625,
		transmissionRadius: 8,
		measuredR0: 4.998,
		standardError: 0.0892,
		seeds: 50,
		indexCases: 600
	},
	ebola: {
		beta: 0.002594,
		transmissionRadius: 8,
		measuredR0: 1.795,
		standardError: 0.03,
		seeds: 60,
		indexCases: 1980
	},
	marburg: {
		beta: 0.002992,
		transmissionRadius: 8,
		measuredR0: 1.591,
		standardError: 0.0268,
		seeds: 60,
		indexCases: 2280
	}
};
