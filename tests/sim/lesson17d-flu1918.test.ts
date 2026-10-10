import { it } from 'vitest';
import { LESSON_TIMEOUT } from './lessonRuns';
import { lesson17 } from './lesson17';

it(
	'lesson 17: 1918 flu kills working-age people far more than seasonal flu (UK ages), seeds 16-20',
	() => lesson17(16, 20),
	LESSON_TIMEOUT
);
