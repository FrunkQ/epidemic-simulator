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

/**
 * How much of a disc a card covers: the overlap with the disc's square when the card touches the
 * circle itself, so a card past the square's corner, clear of every dot, covers nothing.
 */
export function discCover(r: Rect, d: Disc): number {
	const nx = Math.min(Math.max(d.x, r.x), r.x + r.w);
	const ny = Math.min(Math.max(d.y, r.y), r.y + r.h);
	if (Math.hypot(nx - d.x, ny - d.y) >= d.r) return 0;
	return overlap(r, { x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r });
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
	stage: { width: number; height: number },
	previous?: Offset[]
): Layout {
	// Keep the last layout (each card at the same offset from its city) while it is still clear,
	// so cards don't move without need.
	if (previous?.length === discs.length) {
		const kept = scoreAt(
			previous.map((o, i) => ({ x: discs[i].x + o.dx, y: discs[i].y + o.dy })),
			discs,
			sizes,
			stage
		);
		if (kept && kept.cover === 0 && kept.misplaced === 0) return kept;
	}
	// Cards placed first get first pick, so try every order (a handful of cities) and keep the
	// best: least covered, then fewest misplaced, then cards closest to their cities.
	let best: Layout | undefined;
	for (const order of orders(discs.length)) {
		const l = placeInOrder(order, discs, sizes, stage);
		if (
			!best ||
			l.cover < best.cover - 0.25 ||
			(Math.abs(l.cover - best.cover) <= 0.25 &&
				(l.misplaced < best.misplaced || (l.misplaced === best.misplaced && l.spread < best.spread - 1)))
		)
			best = l;
	}
	return best!;
}

/** A card's top-left corner relative to its city's centre. */
export interface Offset {
	dx: number;
	dy: number;
}

/** Offsets of a layout's cards from their cities, to pass back as `previous`. */
export function offsetsOf(layout: Layout, discs: Disc[]): Offset[] {
	return layout.positions.map((p, i) => ({ dx: p.x - discs[i].x, dy: p.y - discs[i].y }));
}

/** Score cards at given positions; undefined if any would leave the stage. */
function scoreAt(
	positions: { x: number; y: number }[],
	discs: Disc[],
	sizes: { w: number; h: number }[],
	stage: { width: number; height: number }
): Layout | undefined {
	const rects = positions.map((p, i) => ({ ...p, ...sizes[i] }));
	if (
		rects.some(
			(r) => r.x < EDGE || r.y < EDGE || r.x + r.w > stage.width - EDGE || r.y + r.h > stage.height - EDGE
		)
	)
		return undefined;
	let cover = 0;
	let misplaced = 0;
	let spread = 0;
	rects.forEach((r, i) => {
		cover += discs.reduce((c, o) => c + discCover(r, o), 0);
		cover += rects.slice(0, i).reduce((c, o) => c + overlap(r, o), 0);
		if (nearestDisc(discs, r) !== i) misplaced++;
		spread += Math.hypot(r.x + r.w / 2 - discs[i].x, r.y + r.h / 2 - discs[i].y);
	});
	return { positions, cover, misplaced, spread };
}

export interface Layout {
	positions: { x: number; y: number }[];
	cover: number;
	misplaced: number;
	/** Total distance from each card's centre to its city's centre. */
	spread: number;
}

/** Every order of 0..n-1 (n is the number of cities, so small); one order beyond 5 cities. */
function orders(n: number): number[][] {
	const ids = Array.from({ length: n }, (_, k) => k);
	if (n > 5) return [ids];
	const out: number[][] = [];
	const go = (done: number[], left: number[]) => {
		if (!left.length) out.push(done);
		left.forEach((k, j) => go([...done, k], [...left.slice(0, j), ...left.slice(j + 1)]));
	};
	go([], ids);
	return out;
}

export function placeInOrder(
	order: number[],
	discs: Disc[],
	sizes: { w: number; h: number }[],
	stage: { width: number; height: number }
): Layout {
	const cx = discs.reduce((a, d) => a + d.x, 0) / discs.length;
	const cy = discs.reduce((a, d) => a + d.y, 0) / discs.length;
	const placed: Rect[] = [];
	let cover = 0;
	let misplaced = 0;
	let spread = 0;
	const positions: { x: number; y: number }[] = [];
	for (const i of order) {
		const d = discs[i];
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
					discs.reduce((c, o) => c + discCover(rect, o), 0) +
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
		spread += Math.hypot(best!.x + w / 2 - d.x, best!.y + h / 2 - d.y);
		positions[i] = { x: best!.x, y: best!.y };
	}
	return { positions, cover, misplaced, spread };
}

/**
 * Pick a frame from `tries` (biggest map first): the first whose layout covers nothing with every
 * card by its own city; else the first that covers nothing, accepting a card nearer another city;
 * else the one covering least, then with fewest cards nearer another city.
 */
export function pickFrame<T>(tries: T[], layoutAt: (t: T) => Layout): T {
	let best = tries[0];
	let bestCover = Infinity;
	let bestMisplaced = Infinity;
	let firstClear: T | undefined;
	for (const t of tries) {
		const { cover, misplaced } = layoutAt(t);
		if (cover === 0 && misplaced === 0) return t;
		if (cover === 0 && firstClear === undefined) firstClear = t;
		if (cover < bestCover - 0.25 || (cover <= bestCover + 0.25 && misplaced < bestMisplaced)) {
			best = t;
			bestCover = cover;
			bestMisplaced = misplaced;
		}
	}
	return firstClear ?? best;
}

/** The usual margin around the cities: framing never zooms in closer than this. */
export const FRAME_MARGIN = 150;
/** Framing never zooms out below this share of the usual scale just to place the cards. */
export const FRAME_FLOOR = 0.5;
/** Other side and top margins tried when the usual frame leaves a card badly placed: this many of each. */
const FRAME_STEPS = 6;

export interface FrameTry {
	mx: number;
	my: number;
	scale: number;
}

/**
 * The side and top margins to try when framing cities spanning `spanX` by `spanY` world units on a
 * `width` by `height` stage: the usual margin first, then others, biggest map first. None zooms in
 * past the usual frame or out below FRAME_FLOOR of it; on a stage too short for the usual frame,
 * any frame that fits will do.
 */
export function frameTries(width: number, height: number, spanX: number, spanY: number): FrameTry[] {
	const scaleOf = (mx: number, my: number) =>
		Math.min((width - 2 * mx) / Math.max(1, spanX), (height - 2 * my) / Math.max(1, spanY));
	const usual = { mx: FRAME_MARGIN, my: FRAME_MARGIN, scale: scaleOf(FRAME_MARGIN, FRAME_MARGIN) };
	const steps = (span: number) =>
		Array.from({ length: FRAME_STEPS }, (_, k) => Math.round(((k + 1) * span) / (2 * (FRAME_STEPS + 1))));
	const others: FrameTry[] = [];
	for (const mx of steps(width))
		for (const my of steps(height)) {
			const scale = scaleOf(mx, my);
			const ok =
				scale > 0 && (usual.scale <= 0 || (scale <= usual.scale && scale >= FRAME_FLOOR * usual.scale));
			if (ok) others.push({ mx, my, scale });
		}
	others.sort((a, b) => b.scale - a.scale);
	const tries = usual.scale > 0 ? [usual, ...others] : others;
	return tries.length ? tries : [usual];
}
