import { describe, expect, it } from 'vitest';
import {
	DOCK_SHARE,
	FRAME_FLOOR,
	fullScale,
	shouldDock,
	discCover,
	frameTries,
	layoutCards,
	offsetsOf,
	openMaxHeight,
	pickFrame,
	placeInOrder,
	type Disc,
	type Layout
} from '../../src/lib/ui/cardLayout';

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

	it('places the cards again when a kept layout would cover something after a card grows', () => {
		const first = layoutCards(discs, sizes, stage);
		// Much taller cards no longer fit where they were: kept, they would leave the stage or overlap.
		const taller = sizes.map((s) => ({ ...s, h: s.h + 140 }));
		const kept = first.positions.map((p, i) => ({ ...p, ...taller[i] }));
		const keptClear =
			kept.every((r) => r.y + r.h <= stage.height - 8) &&
			kept.every((r, i) => kept.slice(0, i).every((o) => !overlaps(r, o)));
		expect(keptClear).toBe(false);
		const again = layoutCards(discs, taller, { width: stage.width, height: 600 }, offsetsOf(first, discs));
		expectClear(discs, taller, { width: stage.width, height: 600 }, again);
		expect(again.positions).not.toEqual(first.positions);
	});
});

describe('framing', () => {
	const layout = (cover: number, misplaced: number): Layout => ({
		positions: [],
		cover,
		misplaced,
		spread: 0
	});

	it('never zooms in past the usual frame or out below the floor', () => {
		for (const [w, h] of [
			[1366, 444],
			[1280, 400],
			[1920, 830],
			[1400, 625]
		]) {
			const tries = frameTries(w, h, 300, 200);
			expect(tries[0].mx).toBe(150);
			for (const t of tries) {
				expect(t.scale).toBeLessThanOrEqual(tries[0].scale);
				expect(t.scale).toBeGreaterThanOrEqual(FRAME_FLOOR * tries[0].scale);
			}
		}
	});

	it('on a stage too short for the usual frame, tries any frame that fits', () => {
		const tries = frameTries(1024, 280, 300, 200);
		expect(tries.length).toBeGreaterThan(0);
		for (const t of tries) expect(t.scale).toBeGreaterThan(0);
	});

	// Stage sizes measured in the browser on #17 and #18 together (11 Oct), and the three start maps' spans.
	const STAGES = [
		[1400, 544],
		[1366, 412],
		[1280, 348],
		[1920, 773]
	];
	const SPANS = [
		[1071, 1071],
		[1407, 783],
		[927, 975]
	];

	it('keeps cards floating at the four target screens, with room to spare', () => {
		for (const [w, h] of STAGES)
			for (const [sx, sy] of SPANS) {
				expect(shouldDock(w, h, sx, sy), `${w}x${h}`).toBe(false);
				// The closest, 1280x720, frames at 0.14 of the full scale: well above the 0.1 line.
				expect(frameTries(w, h, sx, sy)[0].scale).toBeGreaterThanOrEqual(
					1.3 * DOCK_SHARE * fullScale(w, h, sx, sy)
				);
			}
	});

	it('docks the cards on a smaller stage: 1240x720, or a 600 px tall window', () => {
		for (const [w, h] of [
			[1240, 316],
			[1280, 280]
		])
			for (const [sx, sy] of SPANS) expect(shouldDock(w, h, sx, sy), `${w}x${h}`).toBe(true);
	});

	it('never frames floating cards below a twentieth of the full scale', () => {
		for (let h = 300; h <= 900; h += 20)
			for (const w of [760, 1024, 1280, 1920])
				for (const [sx, sy] of SPANS) {
					if (shouldDock(w, h, sx, sy)) continue;
					const full = fullScale(w, h, sx, sy);
					for (const t of frameTries(w, h, sx, sy))
						expect(t.scale, `${w}x${h}`).toBeGreaterThanOrEqual(FRAME_FLOOR * DOCK_SHARE * full - 1e-9);
				}
	});

	it('takes the biggest clear frame, else the biggest with nothing covered, else the least covered', () => {
		expect(pickFrame([0, 1, 2], (t) => [layout(50, 0), layout(0, 1), layout(0, 0)][t])).toBe(2);
		expect(pickFrame([0, 1, 2], (t) => [layout(50, 0), layout(0, 1), layout(0, 2)][t])).toBe(1);
		// The first with nothing covered wins even when a later one has fewer misplaced cards.
		expect(pickFrame([0, 1], (t) => [layout(0, 2), layout(0, 1)][t])).toBe(0);
		expect(pickFrame([0, 1, 2], (t) => [layout(50, 0), layout(10, 2), layout(10, 1)][t])).toBe(2);
	});
});

describe('open cards', () => {
	// Measured in the browser with measles (10 Oct): the stage, the city discs and the closed cards
	// at each of the four screen sizes, and the tallest panel's full height (Health policy).
	const TALLEST_PANEL = 627;
	const screens = {
		'1400x900': {
			stage: { width: 1400, height: 576 },
			discs: [
				{ x: 613.4, y: 201.4, r: 51.4 },
				{ x: 786.6, y: 300.4, r: 51.4 },
				{ x: 675.3, y: 374.6, r: 51.4 }
			]
		},
		'1366x768': {
			stage: { width: 1366, height: 444 },
			discs: [
				{ x: 637.8, y: 176.8, r: 26.8 },
				{ x: 728.2, y: 228.5, r: 26.8 },
				{ x: 670.1, y: 267.2, r: 26.8 }
			]
		},
		'1280x720': {
			stage: { width: 1280, height: 380 },
			discs: [
				{ x: 614.9, y: 164.9, r: 14.9 },
				{ x: 665.1, y: 193.6, r: 14.9 },
				{ x: 632.8, y: 215.1, r: 14.9 }
			]
		},
		'1920x1080': {
			stage: { width: 1920, height: 813 },
			discs: [
				{ x: 799.1, y: 245.6, r: 95.6 },
				{ x: 1120.9, y: 429.5, r: 95.6 },
				{ x: 914, y: 567.4, r: 95.6 }
			]
		}
	};
	const closed = { w: 210, h: 251 };

	for (const [name, { stage, discs: ds }] of Object.entries(screens)) {
		it(`opening any card's tallest panel at ${name} covers no city`, () => {
			const sizes = ds.map(() => closed);
			const { positions } = layoutCards(ds, sizes, stage);
			positions.forEach((p) => {
				const others = positions.filter((q) => q !== p).map((q) => ({ ...q, w: closed.w }));
				const cap = openMaxHeight({ x: p.x, y: p.y, w: closed.w }, closed.h, ds, stage.height, others);
				expect(cap).toBeGreaterThanOrEqual(closed.h);
				const open = { x: p.x, y: p.y, w: closed.w, h: Math.min(TALLEST_PANEL, cap) };
				for (const d of ds) expect(discCover(open, d)).toBe(0);
				// Nor the top of any card below it, where that card's buttons are.
				for (const q of others)
					if (q.y >= p.y + closed.h && q.x < p.x + closed.w && p.x < q.x + closed.w)
						expect(open.y + open.h).toBeLessThanOrEqual(q.y);
				expect(open.y + open.h).toBeLessThanOrEqual(stage.height);
			});
		});
	}

	it('stops above the first city below the card, by the clearance', () => {
		const d = { x: 100, y: 500, r: 50 };
		expect(openMaxHeight({ x: 50, y: 100, w: 210 }, 200, [d], 900)).toBe(500 - 50 - 8 - 100);
		// A city off to the side of the card's width doesn't limit it.
		expect(openMaxHeight({ x: 300, y: 100, w: 210 }, 200, [d], 900)).toBe(900 - 8 - 100);
		// Another card below, under the card's width, stops it too; one off to the side doesn't.
		expect(openMaxHeight({ x: 300, y: 100, w: 210 }, 200, [d], 900, [{ x: 400, y: 400, w: 210 }])).toBe(
			400 - 8 - 100
		);
		expect(openMaxHeight({ x: 300, y: 100, w: 210 }, 200, [d], 900, [{ x: 600, y: 400, w: 210 }])).toBe(
			900 - 8 - 100
		);
		// Never shorter than the closed card, even when it already ends inside the clearance.
		expect(openMaxHeight({ x: 50, y: 300, w: 210 }, 145, [d], 900)).toBe(145);
	});
});
