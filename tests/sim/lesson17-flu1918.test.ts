import { expect, it } from 'vitest';
import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { POPULATION } from '../../src/lib/config/population';
import { byBand, outbreak, SEEDS, withAges } from './lessonRuns';

it('lesson 17: 1918 flu kills working-age people far more than seasonal flu (UK ages)', () => {
	const policy = withAges(defaultPolicy(), POPULATION.ukAgeMix.value);
	let higherRate = 0;
	const pooled = { pandemic: [0, 0], seasonal: [0, 0] };
	for (let seed = 1; seed <= SEEDS; seed++) {
		const p = byBand(outbreak('flu1918', seed, { population: 600_000, policy }));
		const s = byBand(outbreak('flu', seed, { population: 600_000, policy }));
		if (p.died[1] / p.infected[1] > s.died[1] / s.infected[1]) higherRate++;
		pooled.pandemic[0] += p.died[1];
		pooled.pandemic[1] += p.died[0] + p.died[1] + p.died[2];
		pooled.seasonal[0] += s.died[1];
		pooled.seasonal[1] += s.died[0] + s.died[1] + s.died[2];
	}
	// The 15-64 death rate per infection is higher under 1918 flu in at least 80% of seeds.
	expect(higherRate / SEEDS).toBeGreaterThanOrEqual(0.8);
	// The working-age share of deaths, the figure the panel shows, pooled over the seeds because
	// seasonal flu kills only a handful of dots per run.
	const share = (d: number[]) => d[0] / d[1];
	expect(share(pooled.pandemic)).toBeGreaterThanOrEqual(3 * share(pooled.seasonal));
});
