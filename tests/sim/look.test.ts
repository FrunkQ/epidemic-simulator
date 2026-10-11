import { describe, expect, it } from 'vitest';
import { SHARE_STEPS, STEP_STRENGTH, lookOf, ringWidth } from '../../src/lib/sim/look';
import { State } from '../../src/lib/sim/types';

const NONE = State.SUSCEPTIBLE;

describe('look E', () => {
	it('shows nothing extra for a dot with nobody infected or dead (k = 0)', () => {
		expect(lookOf(100, 0, 0, 0, 0)).toMatchObject({ fill: NONE, ring: NONE, step: 0 });
		expect(lookOf(100, 0, 0, 0, 30)).toMatchObject({ fill: NONE, ring: NONE, step: 0 });
	});

	it('marks one infected person at the lowest step, and fills at half the dot', () => {
		expect(lookOf(100, 0, 0, 1, 0)).toMatchObject({ fill: NONE, ring: State.SILENT, step: 0 });
		expect(lookOf(100, 0, 1, 0, 0)).toMatchObject({ fill: NONE, ring: State.SYMPTOMATIC, step: 0 });
		expect(lookOf(100, 0, 49, 0, 0).step).toBe(SHARE_STEPS - 1);
		// Silent and ill count together: 30 + 20 is half.
		expect(lookOf(100, 0, 20, 30, 0)).toMatchObject({ fill: State.SILENT, ring: NONE, step: 0 });
		expect(lookOf(100, 0, 25, 25, 0).fill).toBe(State.SYMPTOMATIC);
	});

	it('rings a dot filled as recovered when some of its people are infected', () => {
		expect(lookOf(100, 0, 9, 0, 60)).toMatchObject({
			fill: State.RECOVERED,
			ring: State.SYMPTOMATIC,
			step: 1
		});
	});

	it('rings a dot with both dead and infected people in the infected colour, and grey only with none infected', () => {
		expect(lookOf(100, 10, 0, 2, 0).ring).toBe(State.SILENT);
		expect(lookOf(100, 10, 0, 0, 0).ring).toBe(State.DECEASED);
		// Half dead fills it dead, with no ring, whoever else is infected.
		expect(lookOf(100, 50, 5, 0, 0)).toMatchObject({ fill: State.DECEASED, ring: NONE, step: 0 });
	});

	it('works for one person per dot: that person fills it', () => {
		expect(lookOf(1, 0, 0, 1, 0)).toMatchObject({ fill: State.SILENT, ring: NONE, step: 0 });
		expect(lookOf(1, 1, 0, 0, 0).fill).toBe(State.DECEASED);
		expect(lookOf(1, 0, 0, 0, 1).fill).toBe(State.RECOVERED);
		expect(lookOf(1, 0, 0, 0, 0)).toMatchObject({ fill: NONE, ring: NONE, step: 0 });
	});

	it('follows the share in even steps up to half, whatever the dot size', () => {
		expect(lookOf(100, 0, 8, 0, 0).step).toBe(0);
		expect(lookOf(100, 0, 9, 0, 0).step).toBe(1);
		expect(lookOf(1000, 0, 1, 0, 0).step).toBe(0);
		expect(lookOf(10, 0, 4, 0, 0).step).toBe(4);
		for (const n of [10, 37, 100, 1000]) {
			const justUnderHalf = Math.ceil(n / 2) - 1;
			// Ten people per dot have too few shares below half to reach the top step.
			expect(lookOf(n, 0, justUnderHalf, 0, 0)).toMatchObject({
				fill: NONE,
				step: n === 10 ? SHARE_STEPS - 2 : SHARE_STEPS - 1
			});
			expect(lookOf(n, 0, Math.ceil(n / 2), 0, 0).fill).toBe(State.SYMPTOMATIC);
			// Steps never fall as more people are infected.
			let last = 0;
			for (let k = 1; k < n / 2; k++) {
				const { step } = lookOf(n, 0, k, 0, 0);
				expect(step).toBeGreaterThanOrEqual(last);
				last = step;
			}
		}
	});

	it('keeps the strongest step well short of solid, and the faintest still visible', () => {
		expect(STEP_STRENGTH).toHaveLength(SHARE_STEPS);
		expect(STEP_STRENGTH[0]).toBeGreaterThan(0);
		expect(STEP_STRENGTH[0]).toBeLessThan(0.2);
		expect(STEP_STRENGTH[SHARE_STEPS - 1]).toBeLessThanOrEqual(0.55);
	});

	it('draws a ring only when it is 2 device pixels wide and fits between neighbours, else tints', () => {
		// At 1x a dot is at most 6 px, so its ring (a fifth of it) is never 2 px: always tint.
		expect(ringWidth(2.6, 1.5, 1)).toBe(0);
		expect(ringWidth(40, 6, 1)).toBe(0);
		// The 1400x900 default on a 2x screen: a 0.3 px ring is 0.6 device pixels.
		expect(ringWidth(2.6, 1.5, 2)).toBe(0);
		// Zoomed in on a 2x screen: 6 px dots 20 px apart get a 1.2 px ring.
		expect(ringWidth(20, 6, 2)).toBeCloseTo(1.2);
		// Too close for it to fit: tint.
		expect(ringWidth(8, 6, 2)).toBe(0);
		for (const [sp, size, dpr] of [
			[9, 6, 2],
			[12, 6, 3],
			[6, 4, 3]
		]) {
			const w = ringWidth(sp, size, dpr);
			expect(w === 0 || (w * dpr >= 2 && size / 2 + w <= sp / 2)).toBe(true);
			// A square frame a fifth of the dot wide has about the dot's own area.
			if (w > 0) expect(((size + 2 * w) ** 2 - size ** 2) / size ** 2).toBeCloseTo(0.96);
		}
	});
});
