import { describe, expect, it } from 'vitest';
import { Protection } from '../../src/lib/sim/types';
import { cityRun } from './helpers';

/** Dots spawned at each protection level, in a city where half are fully and half partly vaccinated. */
function spawned(id: 'flu' | 'measles') {
	const a = cityRun(id, 1, { vaccinatedFull: 0.5, vaccinatedPartial: 0.5 }).agents;
	const counts = { full: 0, partial: 0, none: 0 };
	for (let i = 0; i < a.activeCount; i++) {
		if (a.protection[i] === Protection.FULL) counts.full++;
		else if (a.protection[i] === Protection.PARTIAL) counts.partial++;
		else counts.none++;
	}
	return { counts, total: a.activeCount };
}

describe('partial course', () => {
	it('spawns partly vaccinated dots unprotected when the vaccine has no unfinished course', () => {
		// Flu is one dose a season, so "partly vaccinated" doesn't exist.
		const { counts, total } = spawned('flu');
		expect(counts.partial).toBe(0);
		expect(counts.none / total).toBeGreaterThan(0.4);
		expect(counts.full / total).toBeGreaterThan(0.4);
	});

	it('keeps partly vaccinated dots where the vaccine has an unfinished course', () => {
		const { counts, total } = spawned('measles');
		expect(counts.partial / total).toBeGreaterThan(0.4);
	});
});
