import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../src/lib/config/diseases';
import { microcosm } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import type { DiseaseConfig } from '../../src/lib/sim/types';
import { wordings } from '../../src/lib/ui/charts/scale';
import { harmSeries, harmTitle, harmViews } from '../../src/lib/ui/harmChart';

describe('the lasting harm chart (6.17)', () => {
	it('has a People view for every disease that counts harm, and Babies only where babies are counted', () => {
		for (const d of Object.values(DISEASES) as DiseaseConfig[]) {
			const views = harmViews(d, 100);
			if ((d.lastingHarm?.counted.length ?? 0) === 0) expect(views, d.id).toEqual([]);
			else expect(views, d.id).toEqual(d.babyHarm ? ['people', 'babies'] : ['people']);
		}
		expect(harmViews(DISEASES.smallpox, 100)).toEqual(['people', 'babies']);
		expect(harmViews(DISEASES.covid19, 100)).toEqual(['people']);
		// Like the card, nothing at one person per dot (the guided village).
		expect(harmViews(DISEASES.smallpox, 1)).toEqual([]);
	});

	it('words its title like the card', () => {
		expect(harmTitle('people', true)).toBe('Recovered people who live with lasting harm, in each city');
		expect(harmTitle('people', false)).toBe('People here who live with lasting harm, in each city');
		expect(harmTitle('babies', true)).toBe('Babies harmed or pregnancies lost so far, in each city');
	});

	it('plots the numbers the cards show, in people', () => {
		const sim = createSimulation(microcosm(), { seed: 1, diseaseId: 'smallpox' });
		for (const r of [0, 1, 2]) sim.send({ type: 'seed', region: r, count: 3 });
		sim.step(80 * TICKS_PER_DAY);
		const t = sim.snapshot();
		t.regions.forEach((r, k) => {
			const h = sim.history(k);
			const people = harmSeries(h, 'people');
			const babies = harmSeries(h, 'babies');
			expect(people.length).toBe(h.days.length);
			// The last sample is the day that just ended, which is where the cards are now.
			expect(people[people.length - 1]).toBeCloseTo(Math.max(0, ...r.harmed), 2);
			expect(babies[babies.length - 1]).toBeCloseTo(r.babies, 2);
		});
		expect(Math.max(...t.regions.map((r) => r.harmed[0]))).toBeGreaterThan(100);
	});

	it('tries the caption, then a shorter wording; an empty caption leaves just the controls', () => {
		expect(wordings('Ill right now, in each city', 'Ill now, each city', 'Ill now')).toEqual([
			'Ill now, each city',
			'Ill now'
		]);
		expect(wordings('Title')).toEqual(['Title']);
		expect(wordings('Title', '', 'Short')).toEqual([]);
	});
});
