/**
 * The two map views (§3) and the drawing rules they share. Both are drawing only: the switch never
 * reaches the simulation, so a run is the same in either view.
 *
 * - Specks (the default): every dot is drawn dimmed in its usual colour, and every infected person
 *   is drawn as their own bright speck in a small patch around their dot, each death as a pale one.
 *   The first cases show at any zoom.
 * - Shading: dots dimmed the same way, and any infected person moves a dot at least SHADE_FLOOR of
 *   the way to orange or red (lifted, INFECTED_LIFT), solid once SHADE_FULL_SHARE of its people are
 *   infected. Until it is solid, a 1 px outline in the lifted colour (SHADE_RING_PX) marks it, so
 *   it reads as infected whatever colour vision a viewer has; a solid dot's fill does that alone.
 */
export type MapLook = 'specks' | 'shading';
export const MAP_LOOKS: readonly MapLook[] = ['specks', 'shading'];
export const DEFAULT_LOOK: MapLook = 'specks';

/**
 * How far each dot keeps its own colour against the land (0 is land), set per colour so that every
 * pair either view draws, under normal vision and protan, deutan and tritan colour blindness, is
 * at least as far apart as the closest pair of full colours on the old map (colours.test.ts).
 */
export const UNPROTECTED_DIM = 0.3;
export const FULL_DIM = 0.53;
export const PARTIAL_DIM = 0.61;
export const RECOVERED_DIM = 0.5;
export const DEAD_DIM = 0.91;
/**
 * How far infected people's specks, and Shading's outline, move from orange and red toward white,
 * so they stand apart from the dimmed dots by lightness as well as colour (same check).
 */
export const INFECTED_LIFT = 0.29;

/** Shading: the least a dot with anyone infected moves toward the infected colour. */
export const SHADE_FLOOR = 0.4;
/** Shading: the outline round a dot with anyone infected that is not yet solid, in CSS pixels. */
export const SHADE_RING_PX = 1;
/** Shading: the share of a dot's people infected at which it is solid. */
export const SHADE_FULL_SHARE = 0.25;
/** Shading strengths are drawn in steps this size, so the styles can be made once. */
export const SHADE_STEP = 0.05;

/** How far a dot's people spread around it, as a share of the average spacing between dots. */
export const SPECK_PATCH = 0.75;
/**
 * The smallest an infected person's speck is drawn, in CSS pixels, so one person can be seen
 * (ruled 19 Oct). Zoomed out, that is more ground than one person's share of a city; the legend
 * says so, and the numbers on the cards stay exact.
 */
export const SPECK_MIN_CSS = 1.5;

/** The smallest speck in device pixels at a device scale: never under SPECK_MIN_CSS CSS pixels. */
export const speckMinSide = (dpr: number) => Math.ceil(SPECK_MIN_CSS * dpr - 1e-9);

/**
 * How many specks a dot's patch can show apart, at most: its area over one speck's, doubled for
 * the overlap of spots. Past that, more specks repaint the same pixels, so they are left out.
 */
export const speckCap = (patchPx: number, side: number) =>
	Math.max(1, Math.ceil((2 * Math.PI * (patchPx + side) * (patchPx + side)) / (side * side)));

export type Rgb = readonly [number, number, number];

export function rgbOf(hex: string): Rgb {
	const v = parseInt(hex.slice(1), 16);
	return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** `colour` kept share `k` of its strength against `ground`. */
export function dimmed(colour: Rgb, k: number, ground: Rgb): Rgb {
	return colour.map((c, j) => Math.round(ground[j] + (c - ground[j]) * k)) as unknown as Rgb;
}

/** `from` moved share `t` of the way to `to`. */
export function mixed(from: Rgb, to: Rgb, t: number): Rgb {
	return from.map((c, j) => Math.round(c + (to[j] - c) * t)) as unknown as Rgb;
}

export const css = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`;

/** An opaque colour packed for a little-endian Uint32 view of ImageData. */
export const packed = ([r, g, b]: Rgb) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

/**
 * Shading: how far a dot moves toward the infected colour, in SHADE_STEP steps: 0 with nobody
 * infected, at least SHADE_FLOOR with anyone, 1 at SHADE_FULL_SHARE of its people or more.
 */
export function shadeStrength(infected: number, people: number): number {
	if (infected <= 0) return 0;
	const t = Math.min(1, SHADE_FLOOR + ((1 - SHADE_FLOOR) * infected) / (SHADE_FULL_SHARE * people));
	return Math.round(t / SHADE_STEP) * SHADE_STEP;
}

const spotCache = new Map<number, Float32Array>();
/**
 * Where each of a dot's `n` people sits in its patch, as offsets in a unit disc (a sunflower
 * spiral, so the patch fills evenly). One person sits on the dot itself.
 */
export function speckSpots(n: number): Float32Array {
	let out = spotCache.get(n);
	if (out) return out;
	out = new Float32Array(2 * n);
	const golden = Math.PI * (3 - Math.sqrt(5));
	if (n > 1)
		for (let k = 0; k < n; k++) {
			const r = Math.sqrt((k + 0.5) / n);
			out[2 * k] = r * Math.cos(k * golden);
			out[2 * k + 1] = r * Math.sin(k * golden);
		}
	spotCache.set(n, out);
	return out;
}

/** A stride coprime with n, so a dot's k-th person lands at a scrambled spot in its patch. */
export function speckStride(n: number): number {
	for (const p of [37, 41, 43, 47, 53, 59, 61]) if (n % p !== 0) return p;
	return 1;
}

/** The counts a speck layer reads, per dot: People's own arrays. */
export interface SpeckPeople {
	readonly perDot: number;
	readonly dead: Int32Array;
	readonly ill: Int32Array;
	readonly silentSymptomatic: Int32Array;
	readonly silentAsymptomatic: Int32Array;
}

/** A pixel box, x0 and y0 inclusive, x1 and y1 exclusive; empty when x1 <= x0. */
export interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface SpeckFrame {
	/** Dots to draw, by index, and how many. */
	list: Int32Array;
	count: number;
	/** Where each dot is drawn, in world units. */
	x: Float32Array;
	y: Float32Array;
	/** The camera: world origin and device pixels per world unit. */
	ox: number;
	oy: number;
	scale: number;
	/** The patch's radius, in world units. */
	patch: number;
	/** The smallest side of an infected person's speck, and the largest of anyone's, in device pixels. */
	minSide: number;
	maxSide: number;
	colours: { dead: number; ill: number; silent: number };
}

let offsets = new Float32Array(0);
/** A reused array of at least n numbers, so a frame allocates nothing. */
function scratch(n: number): Float32Array {
	if (offsets.length < n) offsets = new Float32Array(n);
	return offsets;
}

/**
 * Paints each dot's dead, then over them its infected people, one square each, at least
 * `minSide`, into `buf` (W × H pixels), so a death shows where no case is drawn over it. A dot's
 * ill and silent people are interleaved, so neither colour is painted over the other wholesale.
 * Each pass paints at most speckCap specks a dot: more would repaint the same pixels. Clears
 * `box`, last frame's painted area, first and sets it to this frame's. Returns how many infected
 * people's specks were painted: one that would cross the edge of the layer is left out.
 */
export function paintSpecks(
	buf: Uint32Array,
	W: number,
	H: number,
	people: SpeckPeople,
	f: SpeckFrame,
	box: Box
): number {
	for (let y = box.y0; y < box.y1; y++) buf.fill(0, y * W + box.x0, y * W + box.x1);
	let x0 = W;
	let y0 = H;
	let x1 = 0;
	let y1 = 0;
	const per = people.perDot;
	const spots = speckSpots(per);
	const stride = speckStride(per);
	const rs = f.patch * f.scale;
	// The ground one person's share of the patch covers, 70% of it, at least minSide.
	const natural = Math.min(f.maxSide, Math.max(1, Math.floor(0.7 * rs * Math.sqrt(Math.PI / per))));
	const side = Math.max(natural, f.minSide);
	const half = side / 2;
	const cap = speckCap(rs, side);
	// Each spot's offset in device pixels this frame, and the stride as a step below per.
	const ox = scratch(2 * per);
	for (let k = 0; k < 2 * per; k++) ox[k] = spots[k] * rs;
	const step = stride % per;
	let painted = 0;
	for (let pass = 0; pass < 2; pass++) {
		// A dot whose whole patch is on the layer needs no check per person.
		const reach = rs + side + 1;
		for (let k = 0; k < f.count; k++) {
			const i = f.list[k];
			const dead = people.dead[i];
			const ill = people.ill[i];
			const from = pass === 0 ? 0 : dead;
			const all = pass === 0 ? dead : dead + ill + people.silentSymptomatic[i] + people.silentAsymptomatic[i];
			if (from >= all) continue;
			const to = Math.min(all, from + cap);
			// Bresenham along the infected: ill specks are spread among the silent ones in proportion.
			const infected = all - dead;
			let acc = infected >> 1;
			// Half a pixel added, so truncating below rounds to the nearest pixel.
			const cx = (f.x[i] - f.ox) * f.scale - half + 0.5;
			const cy = (f.y[i] - f.oy) * f.scale - half + 0.5;
			const inside = cx - reach >= 0 && cy - reach >= 0 && cx + reach <= W && cy + reach <= H;
			// Each dot starts its people at its own spot, so neighbours' patches don't line up.
			let slot = (((i * 13) % per) + from * step) % per;
			for (let j = from; j < to; j++, slot = slot + step >= per ? slot + step - per : slot + step) {
				let colour = f.colours.dead;
				if (pass === 1) {
					acc += ill;
					if (acc >= infected) {
						acc -= infected;
						colour = f.colours.ill;
					} else colour = f.colours.silent;
				}
				const px = Math.floor(cx + ox[2 * slot]);
				const py = Math.floor(cy + ox[2 * slot + 1]);
				if (!inside && (px < 0 || py < 0 || px + side > W || py + side > H)) continue;
				// Plain writes: a fill() call per row costs more than the few pixels a speck has.
				for (let row = 0, o = py * W + px; row < side; row++, o += W)
					for (let col = 0; col < side; col++) buf[o + col] = colour;
				if (pass === 1) painted++;
			}
			// The box grows by the whole patch, clipped to the layer: a little more than was painted.
			const bx0 = Math.max(0, Math.floor(cx - rs - 1));
			const by0 = Math.max(0, Math.floor(cy - rs - 1));
			const bx1 = Math.min(W, Math.ceil(cx + rs + side + 1));
			const by1 = Math.min(H, Math.ceil(cy + rs + side + 1));
			if (bx0 < x0) x0 = bx0;
			if (by0 < y0) y0 = by0;
			if (bx1 > x1) x1 = bx1;
			if (by1 > y1) y1 = by1;
		}
	}
	box.x0 = x0;
	box.y0 = y0;
	box.x1 = x1;
	box.y1 = y1;
	return painted;
}
