import { expect, it } from 'vitest';
import { defaultPolicy } from '../../src/lib/config/healthPolicy';
import { POPULATION } from '../../src/lib/config/population';
import { shareOf } from './helpers';
import { deathsPerInfection, outbreak, SEEDS, withAges } from './lessonRuns';

it('lesson 14: COVID-19, an older population has more deaths per infection than a younger one', () => {
	// Japan (about 30% aged 65+) against Nigeria (about 3%), everything else the same.
	const share = shareOf(SEEDS, (seed) => {
		const older = outbreak('covid19', seed, {
			policy: withAges(defaultPolicy(), POPULATION.oldAgeMix.value)
		});
		const younger = outbreak('covid19', seed, {
			policy: withAges(defaultPolicy(), POPULATION.youngAgeMix.value)
		});
		return deathsPerInfection(older) > deathsPerInfection(younger);
	});
	expect(share).toBeGreaterThanOrEqual(0.8);
});
