import { toRuntime } from '../sim/disease';
import type { DiseaseId, DiseaseRuntime } from '../sim/types';
import { DISEASES } from './diseases';
import { CALIBRATION } from './diseases.generated';

/** A disease ready for the engine: config numbers plus its calibrated spread chance. */
export function loadDisease(id: DiseaseId): DiseaseRuntime {
	return toRuntime(DISEASES[id], CALIBRATION[id]);
}
