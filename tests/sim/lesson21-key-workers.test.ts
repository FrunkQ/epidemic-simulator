import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lockdownRun } from './lockdownRuns';
import { microcosm } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';

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

/*
 * The same direction on the 3-city map, as the card's chart counts it (6.4): city 0 locks down on
 * day 5, and of the people there when it began, followed wherever they go, key workers have caught
 * it more often since than working-age people who stay home. Counting whoever is in the city now
 * read backwards here, as travellers from other cities mix into the key-worker dots. Only runs
 * where the outbreak took off in that cohort are judged.
 */
it(
	'lesson 21 on the 3-city map: of the people in a city when its lockdown began, key workers catch it more often since',
	() => {
		let tookOff = 0;
		let right = 0;
		const ratios: number[] = [];
		for (let seed = 1; seed <= SEEDS; seed++) {
			const sim = createSimulation(microcosm(0), { seed, diseaseId: 'covid19' });
			sim.seedNow(0, 10);
			sim.step(5 * TICKS_PER_DAY);
			sim.send({ type: 'lockdown', region: 0, on: true });
			sim.step(55 * TICKS_PER_DAY);
			const { keyWorkersCaught: key, stayHomeCaught: home } = sim.snapshot().regions[0];
			if (key + home === 0) continue;
			tookOff++;
			ratios.push(home > 0 ? key / home : Infinity);
			if (key > home) right++;
		}
		const share = right / tookOff;
		const sorted = ratios.slice().sort((a, b) => a - b);
		console.log(
			`lesson 21, 3-city map: ${tookOff} of ${SEEDS} runs took off; key workers / stay-home share caught since day 5, median ${sorted[sorted.length >> 1]?.toFixed(2)}; pass share ${share}`
		);
		expect(tookOff).toBeGreaterThanOrEqual(SEEDS / 4);
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);

it('a city that locks down again counts its key-worker chart from the new start', () => {
	const sim = createSimulation(microcosm(0), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, 10);
	sim.step(5 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(40 * TICKS_PER_DAY);
	const first = sim.snapshot().regions[0];
	expect(first.keyWorkersCaught).toBeGreaterThan(0);
	sim.send({ type: 'lockdown', region: 0, on: false });
	sim.step(10 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(1);
	const again = sim.snapshot().regions[0];
	expect(again.keyWorkersCaught).toBeLessThan(first.keyWorkersCaught / 10);
	expect(again.stayHomeCaught).toBeLessThan(first.stayHomeCaught / 10 + 1e-9);
});
