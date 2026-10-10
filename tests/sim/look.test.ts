import { describe, expect, it } from 'vitest';
import { RING_LEVELS, lookOf, ringWidth } from '../../src/lib/sim/look';
import { State } from '../../src/lib/sim/types';

const NONE = State.SUSCEPTIBLE;

describe('look E', () => {
	it('shows nothing extra for a dot with nobody infected or dead (k = 0)', () => {
		expect(lookOf(100, 0, 0, 0, 0)).toEqual({ fill: NONE, ring: NONE, level: 0 });
		expect(lookOf(100, 0, 0, 0, 30)).toEqual({ fill: NONE, ring: NONE, level: 0 });
	});

	it('rings one infected person at the lowest level, and fills at half the dot', () => {
		expect(lookOf(100, 0, 0, 1, 0)).toEqual({ fill: NONE, ring: State.SILENT, level: 0 });
		expect(lookOf(100, 0, 1, 0, 0)).toEqual({ fill: NONE, ring: State.SYMPTOMATIC, level: 0 });
		expect(lookOf(100, 0, 49, 0, 0).level).toBe(RING_LEVELS - 1);
		// Silent and ill count together: 30 + 20 is half.
		expect(lookOf(100, 0, 20, 30, 0)).toEqual({ fill: State.SILENT, ring: NONE, level: 0 });
		expect(lookOf(100, 0, 25, 25, 0).fill).toBe(State.SYMPTOMATIC);
	});

	it('rings a dot filled as recovered when some of its people are infected', () => {
		expect(lookOf(100, 0, 3, 0, 60)).toEqual({ fill: State.RECOVERED, ring: State.SYMPTOMATIC, level: 1 });
	});

	it('rings a dot with both dead and infected people in the infected colour, and grey only with none infected', () => {
		expect(lookOf(100, 10, 0, 2, 0).ring).toBe(State.SILENT);
		expect(lookOf(100, 10, 0, 0, 0).ring).toBe(State.DECEASED);
		// Half dead fills it dead, with no ring, whoever else is infected.
		expect(lookOf(100, 50, 5, 0, 0)).toEqual({ fill: State.DECEASED, ring: NONE, level: 0 });
	});

	it('works for one person per dot: that person fills it', () => {
		expect(lookOf(1, 0, 0, 1, 0)).toEqual({ fill: State.SILENT, ring: NONE, level: 0 });
		expect(lookOf(1, 1, 0, 0, 0).fill).toBe(State.DECEASED);
		expect(lookOf(1, 0, 0, 0, 1).fill).toBe(State.RECOVERED);
		expect(lookOf(1, 0, 0, 0, 0)).toEqual({ fill: NONE, ring: NONE, level: 0 });
	});

	it('scales the levels to the dot size when it is not 100 people', () => {
		for (const n of [10, 37, 1000]) {
			expect(lookOf(n, 0, 1, 0, 0).level).toBe(n <= 10 ? 1 : 0);
			const justUnderHalf = Math.ceil(n / 2) - 1;
			expect(lookOf(n, 0, justUnderHalf, 0, 0)).toMatchObject({ fill: NONE, level: RING_LEVELS - 1 });
			expect(lookOf(n, 0, Math.ceil(n / 2), 0, 0).fill).toBe(State.SYMPTOMATIC);
			// Levels never fall as more people are infected.
			let last = 0;
			for (let k = 1; k < n / 2; k++) {
				const { level } = lookOf(n, 0, k, 0, 0);
				expect(level).toBeGreaterThanOrEqual(last);
				last = level;
			}
		}
	});

	it('draws a ring only when it fits between neighbours and is a device pixel wide, else tints', () => {
		// Default zoom at 1400x900: 1.5 px dots about 2.6 px apart.
		expect(ringWidth(2.6, 1.5, 1)).toBe(0);
		// The same on a 2x screen: a 0.55 px ring is 1.1 device pixels.
		expect(ringWidth(2.6, 1.5, 2)).toBeCloseTo(0.55);
		// Zoomed in, the ring takes its usual width and stays inside half the spacing.
		expect(ringWidth(20, 6, 1)).toBeCloseTo(2.4);
		// Half a pixel of room on a 1x screen: tint.
		expect(ringWidth(7, 6, 1)).toBe(0);
		for (const [sp, size] of [
			[3, 1.5],
			[8, 3],
			[12, 6]
		]) {
			const w = ringWidth(sp, size, 2);
			expect(size / 2 + w).toBeLessThanOrEqual(sp / 2 + 1e-9);
		}
	});
});
