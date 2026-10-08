import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { outbreak, SEEDS } from './lessonRuns';

it('lesson 6: polio, at least 90% of infections never turn red', () => {
	const share = shareOf(SEEDS, (seed) => {
		const a = outbreak('polio', seed, {}, 90, 30).agents;
		let infected = 0;
		let silentOnly = 0;
		for (let i = 0; i < a.activeCount; i++) {
			if (a.infectedTick[i] < 0) continue;
			infected++;
			if (a.asymptomatic[i] === 1) silentOnly++;
		}
		return silentOnly / infected >= 0.9;
	});
	expect(share).toBeGreaterThanOrEqual(0.8);
});
