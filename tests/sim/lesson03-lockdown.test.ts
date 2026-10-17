import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lockdownRun } from './lockdownRuns';

/** Lesson 3 (10): COVID-19 in one city, lockdown from day 5 against none, same seed. */
export const lesson3 = (seed: number, scenario = {}) =>
	lockdownRun(seed, { lockdownDay: 5, scenario }).peakIll <
	lockdownRun(seed, { lockdownDay: null, scenario }).peakIll;

it(
	'lesson 3: a lockdown from day 5 lowers the peak number of people ill',
	() => {
		expect(shareOf(SEEDS, (seed) => lesson3(seed))).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
