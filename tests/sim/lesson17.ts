import { expect } from 'vitest';
import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { POPULATION } from '../../src/lib/config/population';
import { byBand, outbreak, withAges } from './lessonRuns';

/**
 * Lesson 17 on a range of seeds. Its 20 seeds run as four files of 5 so vitest can run them in
 * parallel; each quarter must pass on its own, which is at least as strict as the 20 together.
 */
export function lesson17(firstSeed: number, lastSeed: number): void {
	const policy = withAges(defaultPolicy(), POPULATION.ukAgeMix.value);
	const seeds = lastSeed - firstSeed + 1;
	let higherRate = 0;
	const pooled = { pandemic: [0, 0], seasonal: [0, 0] };
	for (let seed = firstSeed; seed <= lastSeed; seed++) {
		const p = byBand(outbreak('flu1918', seed, { population: 600_000, policy }));
		const s = byBand(outbreak('flu', seed, { population: 600_000, policy }));
		if (p.died[1] / p.infected[1] > s.died[1] / s.infected[1]) higherRate++;
		pooled.pandemic[0] += p.died[1];
		pooled.pandemic[1] += p.died[0] + p.died[1] + p.died[2];
		pooled.seasonal[0] += s.died[1];
		pooled.seasonal[1] += s.died[0] + s.died[1] + s.died[2];
	}
	// The 15-64 death rate per infection is higher under 1918 flu in at least 80% of seeds.
	expect(higherRate / seeds).toBeGreaterThanOrEqual(0.8);
	// The working-age share of deaths, the figure the panel shows, pooled over the seeds (10, #17).
	const share = (d: number[]) => d[0] / d[1];
	expect(share(pooled.pandemic)).toBeGreaterThanOrEqual(3 * share(pooled.seasonal));
}
