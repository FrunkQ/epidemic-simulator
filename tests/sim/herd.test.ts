import { describe, expect, it } from 'vitest';
import { attackRate, shareOf } from './helpers';

describe('lesson 1: herd immunity for measles', () => {
	it('at 98% fully vaccinated (above the herd immunity line), under 5% of the unprotected catch it in at least 80% of seeds', () => {
		expect(shareOf(20, (s) => attackRate(0.98, s) < 0.05)).toBeGreaterThanOrEqual(0.8);
	});

	it('at 85% fully vaccinated, over 30% of the unprotected catch it in at least 80% of seeds', () => {
		expect(shareOf(20, (s) => attackRate(0.85, s) > 0.3)).toBeGreaterThanOrEqual(0.8);
	});
});
