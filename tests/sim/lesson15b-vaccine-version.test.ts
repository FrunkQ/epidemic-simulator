import { it } from 'vitest';
import { LESSON_TIMEOUT } from './lessonRuns';
import { lesson15 } from './lesson15';

it(
	'lesson 15: Omicron era, same coverage, the updated vaccine gives fewer deaths in a season, seeds 11-20',
	() => lesson15(11, 20),
	LESSON_TIMEOUT
);
