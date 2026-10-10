/** A city disc on screen. */
export interface Disc {
	x: number;
	y: number;
	r: number;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Gap between a disc's edge and its card. */
const GAP = 14;
/** Gap between a card and the stage edge. */
const EDGE = 8;
/** Directions tried after the preferred one: every 22.5 degrees. */
const TRIES = 16;
/** How much further out a card may sit, in pixels, when nothing next to its city is clear. */
const FURTHER = [0, 120, 240, 360];

/** The disc whose centre is nearest the card's centre. */
function nearestDisc(discs: Disc[], r: Rect): number {
	const x = r.x + r.w / 2;
	const y = r.y + r.h / 2;
	let best = 0;
	discs.forEach((d, k) => {
		if (Math.hypot(d.x - x, d.y - y) < Math.hypot(discs[best].x - x, discs[best].y - y)) best = k;
	});
	return best;
}

function overlap(a: Rect, b: Rect): number {
	const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
	const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
	return w > 0 && h > 0 ? w * h : 0;
}

/** The square around the disc: a card clear of it is clear of every dot. */
function discBox(d: Disc): Rect {
	return { x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r };
}

/**
 * Place each city's card just outside its disc. The first choice faces away from the other
 * cities; when that would cover dots (its own or another city's) or another card, for example
 * because the stage clamps it back over the disc, the card goes in whichever direction covers
 * least, so a tall card moves to the side rather than over its city. Only when nothing next to
 * the city is clear does the card sit further out. `cover` is the area, in square pixels, that
 * the cards still cover, and `misplaced` counts cards nearer another city than their own, so the
 * page can zoom out until both are none.
 */
export function layoutCards(
	discs: Disc[],
	sizes: { w: number; h: number }[],
	stage: { width: number; height: number }
): { positions: { x: number; y: number }[]; cover: number; misplaced: number } {
	const cx = discs.reduce((a, d) => a + d.x, 0) / discs.length;
	const cy = discs.reduce((a, d) => a + d.y, 0) / discs.length;
	const placed: Rect[] = [];
	let cover = 0;
	let misplaced = 0;
	const positions = discs.map((d, i) => {
		const { w, h } = sizes[i];
		let dx = d.x - cx;
		let dy = d.y - cy;
		const len = Math.hypot(dx, dy);
		const first = len < 1 ? -Math.PI / 2 : Math.atan2(dy, dx);
		const angles = [
			first,
			...Array.from({ length: TRIES }, (_, k) => first + ((k + 1) * 2 * Math.PI) / TRIES)
		];
		let best: Rect | undefined;
		let bestCost = Infinity;
		let bestCovers = Infinity;
		for (const further of FURTHER) {
			if (bestCost === 0) break;
			for (const a of angles) {
				dx = Math.cos(a);
				dy = Math.sin(a);
				// Distance from the card's centre to its edge in direction (dx, dy).
				const edge = Math.min(w / 2 / Math.max(Math.abs(dx), 1e-6), h / 2 / Math.max(Math.abs(dy), 1e-6));
				const x = d.x + dx * (d.r + GAP + edge + further) - w / 2;
				const y = d.y + dy * (d.r + GAP + edge + further) - h / 2;
				const rect = {
					x: Math.min(Math.max(x, EDGE), stage.width - w - EDGE),
					y: Math.min(Math.max(y, EDGE), stage.height - h - EDGE),
					w,
					h
				};
				const covers =
					discs.reduce((c, o) => c + overlap(rect, discBox(o)), 0) +
					placed.reduce((c, p) => c + overlap(rect, p), 0);
				// Among spots covering the same, prefer one nearer its own city than any other, so it
				// doesn't read as another city's card. Covered areas are whole-pixel scale, so the
				// half never outweighs covering more.
				const cost = covers + (nearestDisc(discs, rect) === i ? 0 : 0.5);
				// Strictly lower only, so the first choice wins ties and cards don't jump about.
				if (cost < bestCost - 0.25) {
					best = rect;
					bestCost = cost;
					bestCovers = covers;
				}
				if (bestCost === 0) break;
			}
		}
		placed.push(best!);
		cover += bestCovers;
		if (bestCost !== bestCovers) misplaced++;
		return { x: best!.x, y: best!.y };
	});
	return { positions, cover, misplaced };
}
