// Written by scripts/calibrate.ts. Do not edit by hand; rerun `npm run calibrate`.
// Seeds start at 1001; each seed runs `indexPerRun` index cases.
//   measles: target R0 15, measured 15 ± 0.257 over 60 seeds, 240 index cases
//   polio: target R0 6, measured 5.998 ± 0.111 over 50 seeds, 500 index cases
//   flu: target R0 1.3, measured 1.3 ± 0.0234 over 50 seeds, 2300 index cases
//   covid19: target R0 3.32, measured 3.32 ± 0.0589 over 60 seeds, 1080 index cases
//   covid19omicron: target R0 8.4, measured 8.398 ± 0.149 over 70 seeds, 490 index cases
//   chickenpox: target R0 5, measured 4.998 ± 0.0932 over 50 seeds, 600 index cases
//   mumps: target R0 11, measured 11 ± 0.188 over 80 seeds, 400 index cases
//   rubella: target R0 5, measured 4.998 ± 0.0902 over 50 seeds, 600 index cases
//   pertussis: target R0 5.5, measured 5.498 ± 0.0958 over 60 seeds, 660 index cases
//   smallpox: target R0 5, measured 5 ± 0.0798 over 70 seeds, 840 index cases
//   ebola: target R0 1.95, measured 1.949 ± 0.0332 over 60 seeds, 1860 index cases
//   marburg: target R0 1.59, measured 1.59 ± 0.0264 over 60 seeds, 2280 index cases
//   flu1918: target R0 1.8, measured 1.8 ± 0.0337 over 50 seeds, 1650 index cases
//   plague: target R0 1.707, measured 1.706 ± 0.0311 over 50 seeds, 1750 index cases
import type { DiseaseCalibration, DiseaseId } from '../sim/types';

export const CALIBRATION: Record<DiseaseId, DiseaseCalibration> = {
	measles: {
		beta: 0.02334,
		transmissionRadius: 8,
		measuredR0: 15,
		standardError: 0.257,
		seeds: 60,
		indexCases: 240
	},
	polio: {
		beta: 0.003086,
		transmissionRadius: 8,
		measuredR0: 5.998,
		standardError: 0.111,
		seeds: 50,
		indexCases: 500
	},
	flu: {
		beta: 0.003558,
		transmissionRadius: 8,
		measuredR0: 1.3,
		standardError: 0.0234,
		seeds: 50,
		indexCases: 2300
	},
	covid19: {
		beta: 0.00495,
		transmissionRadius: 8,
		measuredR0: 3.32,
		standardError: 0.0589,
		seeds: 60,
		indexCases: 1080
	},
	covid19omicron: {
		beta: 0.02241,
		transmissionRadius: 8,
		measuredR0: 8.398,
		standardError: 0.149,
		seeds: 70,
		indexCases: 490
	},
	chickenpox: {
		beta: 0.009458,
		transmissionRadius: 8,
		measuredR0: 4.998,
		standardError: 0.0932,
		seeds: 50,
		indexCases: 600
	},
	mumps: {
		beta: 0.02183,
		transmissionRadius: 8,
		measuredR0: 11,
		standardError: 0.188,
		seeds: 80,
		indexCases: 400
	},
	rubella: {
		beta: 0.004923,
		transmissionRadius: 8,
		measuredR0: 4.998,
		standardError: 0.0902,
		seeds: 50,
		indexCases: 600
	},
	pertussis: {
		beta: 0.00282,
		transmissionRadius: 8,
		measuredR0: 5.498,
		standardError: 0.0958,
		seeds: 60,
		indexCases: 660
	},
	smallpox: {
		beta: 0.004435,
		transmissionRadius: 8,
		measuredR0: 5,
		standardError: 0.0798,
		seeds: 70,
		indexCases: 840
	},
	ebola: {
		beta: 0.002681,
		transmissionRadius: 8,
		measuredR0: 1.949,
		standardError: 0.0332,
		seeds: 60,
		indexCases: 1860
	},
	marburg: {
		beta: 0.002756,
		transmissionRadius: 8,
		measuredR0: 1.59,
		standardError: 0.0264,
		seeds: 60,
		indexCases: 2280
	},
	flu1918: {
		beta: 0.005055,
		transmissionRadius: 8,
		measuredR0: 1.8,
		standardError: 0.0337,
		seeds: 50,
		indexCases: 1650
	},
	plague: {
		beta: 0.002457,
		transmissionRadius: 8,
		measuredR0: 1.706,
		standardError: 0.0311,
		seeds: 50,
		indexCases: 1750
	}
};
