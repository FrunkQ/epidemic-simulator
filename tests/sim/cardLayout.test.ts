import { describe, expect, it } from 'vitest';
import { layoutCards, type Disc } from '../../src/lib/ui/cardLayout';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('card layout', () => {
	// The three cities as framed on a 1366x768 screen (stage 1366 x 444), with closed Black Death cards.
	const discs: Disc[] = [
		{ x: 644, y: 183, r: 23 },
		{ x: 722, y: 228, r: 23 },
		{ x: 672, y: 261, r: 23 }
	];
	const sizes = discs.map(() => ({ w: 210, h: 237 }));
	const stage = { width: 1366, height: 444 };

	it('keeps every card off every city and off the other cards when there is room', () => {
		const { positions, cover } = layoutCards(discs, sizes, stage);
		expect(cover).toBe(0);
		const rects = positions.map((p, i) => ({ ...p, ...sizes[i] }));
		rects.forEach((r, i) => {
			expect(r.x).toBeGreaterThanOrEqual(0);
			expect(r.y + r.h).toBeLessThanOrEqual(stage.height);
			for (const d of discs)
				expect(overlaps(r, { x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r })).toBe(false);
			rects.slice(0, i).forEach((o) => expect(overlaps(r, o)).toBe(false));
		});
	});

	it('puts a card on the side facing away from the other cities when that is clear', () => {
		const wide = { width: 3000, height: 3000 };
		const moved = discs.map((d) => ({ ...d, x: d.x + 1000, y: d.y + 1000 }));
		const { positions } = layoutCards(moved, sizes, wide);
		// Island City is up and left of the middle, so its card sits up and left of it.
		expect(positions[0].x + sizes[0].w).toBeLessThanOrEqual(moved[0].x);
		expect(positions[0].y + sizes[0].h).toBeLessThanOrEqual(moved[0].y);
	});
});
