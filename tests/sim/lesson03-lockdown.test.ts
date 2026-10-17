import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lesson3 } from './lockdownRuns';

it(
	'lesson 3: a lockdown from day 5 lowers the peak number of people ill',
	() => {
		expect(shareOf(SEEDS, (seed) => lesson3(seed))).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
