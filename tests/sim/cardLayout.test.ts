import { describe, expect, it } from 'vitest';
import { discCover, layoutCards, offsetsOf, placeInOrder, type Disc } from '../../src/lib/ui/cardLayout';

type Rect = { x: number; y: number; w: number; h: number };

/** The disc whose centre is nearest the card's centre. */
const nearest = (ds: Disc[], r: Rect) => {
	const d = (k: number) => Math.hypot(ds[k].x - (r.x + r.w / 2), ds[k].y - (r.y + r.h / 2));
	return ds.reduce((b, _, k) => (d(k) < d(b) ? k : b), 0);
};

/** Every card on the stage, off every city and every other card, and nearest its own city. */
function expectClear(
	ds: Disc[],
	sizes: { w: number; h: number }[],
	stage: { width: number; height: number },
	l: ReturnType<typeof layoutCards>
) {
	expect(l.cover).toBe(0);
	expect(l.misplaced).toBe(0);
	const rects = l.positions.map((p, i) => ({ ...p, ...sizes[i] }));
	rects.forEach((r, i) => {
		expect(r.x).toBeGreaterThanOrEqual(0);
		expect(r.y).toBeGreaterThanOrEqual(0);
		expect(r.x + r.w).toBeLessThanOrEqual(stage.width);
		expect(r.y + r.h).toBeLessThanOrEqual(stage.height);
		expect(nearest(ds, r)).toBe(i);
		for (const d of ds) {
			// The point of the card nearest the city's centre is outside its disc.
			const nx = Math.min(Math.max(d.x, r.x), r.x + r.w);
			const ny = Math.min(Math.max(d.y, r.y), r.y + r.h);
			expect(Math.hypot(nx - d.x, ny - d.y)).toBeGreaterThanOrEqual(d.r);
		}
		rects.slice(0, i).forEach((o) => expect(overlaps(r, o)).toBe(false));
	});
}

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
		expectClear(discs, sizes, stage, layoutCards(discs, sizes, stage));
	});

	it('tries other placement orders when cards placed in city order would cover a city', () => {
		const ds: Disc[] = [
			{ x: 463, y: 263, r: 23 },
			{ x: 711, y: 301, r: 23 },
			{ x: 524, y: 219, r: 23 }
		];
		expect(placeInOrder([0, 1, 2], ds, sizes, stage).cover).toBeGreaterThan(0);
		expectClear(ds, sizes, stage, layoutCards(ds, sizes, stage));
	});

	it('counts a card past the corner of a disc’s square, clear of the circle, as covering nothing', () => {
		const d = { x: 100, y: 100, r: 20 };
		// Its corner sits inside the square (at 117, 117) but 24 px from the centre.
		expect(discCover({ x: 117, y: 117, w: 50, h: 50 }, d)).toBe(0);
		// Moved in to touch the circle, it covers dots.
		expect(discCover({ x: 110, y: 110, w: 50, h: 50 }, d)).toBeGreaterThan(0);
	});

	it('leaves the cards where they were when a card grows by a line and they are still clear', () => {
		const first = layoutCards(discs, sizes, stage);
		const taller = sizes.map((s, i) => (i === 1 ? { ...s, h: s.h + 16 } : s));
		const again = layoutCards(discs, taller, stage, offsetsOf(first, discs));
		expectClear(discs, taller, stage, again);
		expect(again.positions).toEqual(first.positions);
		// Panning moves every city alike, and the cards move with them.
		const panned = discs.map((d) => ({ ...d, x: d.x + 30, y: d.y - 5 }));
		const moved = layoutCards(panned, taller, stage, offsetsOf(first, discs));
		expect(moved.positions).toEqual(first.positions.map((p) => ({ x: p.x + 30, y: p.y - 5 })));
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
