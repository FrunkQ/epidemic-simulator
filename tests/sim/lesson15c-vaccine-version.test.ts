import { it } from 'vitest';
import { LESSON_TIMEOUT } from './lessonRuns';
import { lesson15 } from './lesson15';

it(
	'lesson 15: Omicron era, same coverage, the updated vaccine gives fewer deaths in a season, seeds 11-15',
	() => lesson15(11, 15),
	LESSON_TIMEOUT
);
