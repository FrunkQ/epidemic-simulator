import { expect, it } from 'vitest';
import { ENGLAND_POLICY } from '../../src/lib/config/healthPolicy';
import { POPULATION } from '../../src/lib/config/population';
import { shareOf } from './helpers';
import { deathsPerInfection, outbreak, roomy, SEEDS, withAges } from './lessonRuns';

it('lesson 5: hospital overload raises deaths per case', () => {
	const share = shareOf(SEEDS, (seed) => {
		const overloaded = outbreak('covid19', seed, { policy: structuredClone(ENGLAND_POLICY) });
		const coping = outbreak('covid19', seed, { policy: withAges(roomy(), POPULATION.ukAgeMix.value) });
		return deathsPerInfection(overloaded) > deathsPerInfection(coping);
	});
	expect(share).toBeGreaterThanOrEqual(0.8);
});
