import { expect } from 'vitest';
import { outbreak } from './lessonRuns';

/**
 * One season, which is what the narration claims. Within it some runs see reinfections once
 * single-round protection wanes, so the lesson claims deaths only (10, test 15).
 */
const SEASON_DAYS = 180;

/**
 * Lesson 15 on a range of seeds. Its 20 seeds run as two files of 10 so vitest can run them in
 * parallel; each half must pass on its own, which is at least as strict as the 20 together.
 * Partial coverage is 0 in both runs (singleCity's default), so the coverage stays the same
 * although only the original vaccine has an unfinished course.
 */
export function lesson15(firstSeed: number, lastSeed: number): void {
	let fewer = 0;
	for (let seed = firstSeed; seed <= lastSeed; seed++) {
		const run = (vaccine: string) =>
			outbreak(
				'covid19omicron',
				seed,
				{ population: 600_000, vaccinatedFull: 0.7, vaccinatedPartial: 0, vaccine },
				SEASON_DAYS
			).snapshot().regions[0].counts;
		if (run('covid-updated').deceased < run('covid-original').deceased) fewer++;
	}
	expect(fewer / (lastSeed - firstSeed + 1)).toBeGreaterThanOrEqual(0.8);
}
