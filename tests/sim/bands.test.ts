import { describe, expect, it } from 'vitest';
import { DISEASES, perSymptomaticBands } from '../../src/lib/config/diseases';
import { POPULATION } from '../../src/lib/config/population';
import type { Banded, DiseaseConfig } from '../../src/lib/sim/types';

const diseases = Object.values(DISEASES) as DiseaseConfig[];
const banded: [string, Banded][] = [
	...diseases.flatMap((d) =>
		[
			[`${d.id}.mortalityByAge`, d.mortalityByAge],
			[`${d.id}.hospitalisedByAge`, d.hospitalisedByAge]
		].filter((e): e is [string, Banded] => !!e[1])
	),
	['population.backgroundDeathRate', POPULATION.backgroundDeathRate],
	['population.ukBackgroundDeathRate', POPULATION.ukBackgroundDeathRate]
];

describe('age bands', () => {
	it('has reference populations that add up to everyone', () => {
		for (const [key, b] of banded)
			expect(
				b.reference.reduce((a, s) => a + s, 0),
				key
			).toBeCloseTo(1, 3);
		expect(POPULATION.ageMix.value.reduce((a, s) => a + s, 0)).toBeCloseTo(1, 3);
	});

	// Lesson test 16: weighted by the source's own population, the bands give its published total.
	it("reproduces each source's overall rate from its bands", () => {
		for (const [key, b] of banded) {
			const weighted = b.value.reduce((a, v, i) => a + v * b.reference[i], 0);
			expect(Math.abs(weighted / b.overall - 1), key).toBeLessThan(0.02);
		}
	});

	it('only gives disease rates per infection or per case', () => {
		for (const d of diseases) {
			for (const b of [d.mortalityByAge, d.hospitalisedByAge]) {
				if (b)
					expect(perSymptomaticBands(b, d.asymptomaticFraction).every((v) => v >= 0 && v <= 1)).toBe(true);
			}
		}
		expect(() =>
			perSymptomaticBands(POPULATION.backgroundDeathRate, DISEASES.flu.asymptomaticFraction)
		).toThrow();
	});
});
