import { it } from 'vitest';
import { LESSON_TIMEOUT } from './lessonRuns';
import { lesson17 } from './lesson17';

it(
	'lesson 17: 1918 flu kills working-age people far more than seasonal flu (UK ages), seeds 1-5',
	() => lesson17(1, 5),
	LESSON_TIMEOUT
);
