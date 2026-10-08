import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { outbreak, SEEDS, LESSON_TIMEOUT } from './lessonRuns';

/** One season: the first wave, before waning brings a second one. */
const SEASON_DAYS = 180;

it(
	'lesson 15: Omicron era, same coverage, the updated vaccine gives fewer deaths in a season',
	() => {
		const share = shareOf(SEEDS, (seed) => {
			const run = (vaccine: string) =>
				outbreak(
					'covid19omicron',
					seed,
					{ population: 600_000, vaccinatedFull: 0.7, vaccine },
					SEASON_DAYS
				).snapshot().regions[0].counts;
			const original = run('covid-original');
			const updated = run('covid-updated');
			return updated.deceased < original.deceased;
		});
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
