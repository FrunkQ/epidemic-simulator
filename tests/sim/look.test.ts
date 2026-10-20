import { describe, expect, it } from 'vitest';
import { SHARE_STEPS, lookOf } from '../../src/lib/sim/look';
import { State } from '../../src/lib/sim/types';

const NONE = State.SUSCEPTIBLE;

// lookOf still sets each dot's shown and ring states, which the seed marker reads (§3).
describe("a dot's shown state", () => {
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
});
