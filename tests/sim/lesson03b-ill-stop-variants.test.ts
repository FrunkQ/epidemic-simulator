import { it } from 'vitest';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lesson3 } from './lesson03-lockdown.test';

/*
 * The majority-movement recheck (coordinator ruling, 16 Oct): lesson 3 asserts only the shipped rule
 * (a dot stops once half its people are ill). This reports its pass share under two other rules,
 * without asserting: "anyone ill stops the dot" (the stand-in for finer-counts' split, where ill people
 * never move) and "illness never stops a dot". Run with LESSON_REPORT=1; it is skipped otherwise.
 */
it.runIf(process.env.LESSON_REPORT === '1')(
	'report: lesson 3 under the other ill-stop rules',
	() => {
		const any = shareOf(SEEDS, (seed) => lesson3(seed, { illStopShare: 0 }));
		const never = shareOf(SEEDS, (seed) => lesson3(seed, { subsystems: { illStopsMovement: false } }));
		console.log(`lesson 3 pass share: anyone ill stops ${any}; illness never stops ${never}`);
	},
	LESSON_TIMEOUT
);
