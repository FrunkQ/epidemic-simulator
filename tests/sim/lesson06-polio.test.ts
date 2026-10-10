import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { outbreak, SEEDS, LESSON_TIMEOUT } from './lessonRuns';

it(
	'lesson 6: polio, at least 90% of infections never turn red',
	() => {
		const share = shareOf(SEEDS, (seed) => {
			const p = outbreak('polio', seed, {}, 90, 30).people;
			return 1 - p.symptomaticInfections / p.infections >= 0.9;
		});
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
