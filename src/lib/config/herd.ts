import type { DiseaseConfig, DiseaseId } from '../sim/types';

export interface HerdCoverage {
	/** Share of people who must be fully vaccinated to stop spread; can exceed 1. */
	coverage: number;
	/** False when vaccination alone can't get there. */
	reachable: boolean;
}

/** Coverage needed for herd immunity: (1 - 1/R0) / fullEfficacy. The UI only displays it. */
export function herdCoverage(disease: DiseaseConfig): HerdCoverage {
	const coverage = (1 - 1 / disease.r0.value) / disease.fullEfficacy.value;
	return { coverage, reachable: coverage <= 1 };
}

/** Values worked out from config numbers rather than stored; sources may cite them. */
export function derivedKeys(ids: DiseaseId[]): string[] {
	return ids.map((id) => `${id}.herdImmunityThreshold`);
}

/** Facts a source backs that appear only as words on the About page (e.g. why Ebola burns out). */
export function aboutKeys(ids: DiseaseId[]): string[] {
	return ids.map((id) => `${id}.about`);
}
