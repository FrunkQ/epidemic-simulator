import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lockdownRun } from './lockdownRuns';

/*
 * Lesson 21 (10, research/lockdown-movers.md §5.6): COVID-19, lockdown from day 5. By day 60 the
 * share who have caught it is higher among people in key-worker dots than among people in non-key
 * 15-64 dots that keep to a lockdown. Both groups are fixed by their ranks, not by who happens to be
 * out, and both are aged 15-64, so age can't explain the gap. The direction is all the narration
 * claims; the ratio is reported, never tuned (§5.7). A person counts in the dot where they caught it:
 * that dot's flags never change, though the boarding swap can later move them across the line.
 */
it(
	'lesson 21: in a lockdown, key workers catch it more often than working-age people who stay home',
	() => {
		const ratios: number[] = [];
		const share = shareOf(SEEDS, (seed) => {
			const { sim } = lockdownRun(seed, { lockdownDay: 5, until: 60 });
			const { key, home } = sim.keyWorkerInfection();
			ratios.push(home > 0 ? key / home : Infinity);
			return key > home;
		});
		const sorted = ratios.slice().sort((a, b) => a - b);
		console.log(
			`lesson 21: key workers / stay-home share caught by day 60, median ${sorted[sorted.length >> 1].toFixed(2)} (range ${sorted[0].toFixed(2)}-${sorted[sorted.length - 1].toFixed(2)}); pass share ${share}`
		);
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
