import { expect, it } from 'vitest';
import { shareOf, withCaution } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import { singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';

/*
 * Lesson 22 (10, research/lockdown-movers.md §9.6): COVID-19 with no tools in one city of 200,000
 * people. With caution at its shipped default, fewer people have ever been infected by day 180
 * than with caution at 0, in at least 80% of seeds; a tie fails. 10 index cases, fixed in advance:
 * every seed takes off, so none is picked or dropped. The two arms are the same run until the
 * first death (caution's ranks come from their own stream), so each seed is a paired comparison.
 * The size of the cut is reported, never tuned (6.18).
 */
const INDEX_CASES = 10;
const DAYS = 180;

function everInfected(seed: number, share: number): number {
	const scenario = withCaution(singleCity({ population: 200_000 }), share);
	const sim = createSimulation(scenario, { seed, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(DAYS * TICKS_PER_DAY);
	return sim.snapshot().regions[0].counts.everInfected;
}

it(
	'lesson 22: when people stay in as deaths rise, fewer catch it, even with no other tools',
	() => {
		const cuts: number[] = [];
		const share = shareOf(SEEDS, (seed) => {
			const without = everInfected(seed, 0);
			const withIt = everInfected(seed, BEHAVIOUR.cautionShare.value);
			cuts.push(1 - withIt / without);
			return withIt < without;
		});
		const sorted = cuts.slice().sort((a, b) => a - b);
		const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
		console.log(
			`lesson 22: ever infected by day ${DAYS} cut by a median ${pct(sorted[sorted.length >> 1])} (range ${pct(sorted[0])}-${pct(sorted[sorted.length - 1])}); pass share ${share}`
		);
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
