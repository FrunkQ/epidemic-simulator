import { Agents } from './agents';
import { Camera } from './camera';
import type { World } from './geography';
import { pointAt } from './routes';
import { MAX_PLANES, type Transit } from './transit';
import { SHARE_STEPS, STEP_STRENGTH, fits, ringWidth } from './look';
import { Protection, State, type Region, type Route, type Viewport } from './types';

export interface Scene {
	agents: Agents;
	regions: readonly Region[];
	radii: Float32Array;
	routes: readonly Route[];
	transit: Transit;
	world: World | null;
	tick: number;
	/** Average distance between neighbouring dots in the densest city, in world units. */
	spacing: number;
	/** Dots the seed button brought someone into, oldest first; a new array after every setup. */
	seedMarks: readonly number[];
	/** How many marks the seed button has made this run, so a dot seeded again gets a new mark. */
	seedMarkTotal: number;
	/** The frame's time (ms, from requestAnimationFrame), for the seed marker's fade. */
	now: number;
	/**
	 * How far the clock is towards the next tick, 0 to 1, from the canvas. When the map has moved
	 * on by one tick since the last frame, dots are drawn that far between their last two
	 * positions, so slow speeds glide instead of stepping. 1 draws the latest tick.
	 */
	alpha: number;
}

/** A dot that moved further than this in one tick (world units) boarded or landed: drawn there at once. Wandering and road travel move under 2. */
const GLIDE_LIMIT = 4;

export const MAP_COLOURS = {
	sea: '#0b1a2e',
	grid: 'rgba(120,160,210,0.06)',
	land: '#1b3047',
	coast: 'rgba(140,180,220,0.35)',
	road: 'rgba(214,190,140,0.75)',
	ferry: 'rgba(110,200,220,0.8)',
	air: 'rgba(170,200,255,0.55)',
	plane: '#e6edf5'
} as const;

/**
 * Display colours, checked with the dataviz palette validator on the dark map: every pair stays
 * apart under protan, deutan and tritan colour blindness, and infectious dots also get a ring.
 * Died is pale (10 Oct) so it differs from both infected colours by lightness: OKLab ΔE at least
 * 32 from ill and 23 from silent under protan and deutan (the darker grey before was 7 from ill).
 */
export const COLOURS = {
	unprotected: '#3a7bf0',
	full: '#2fbf71',
	partial: '#ecd24a',
	silent: '#ff8f1f',
	symptomatic: '#e33b6b',
	recovered: '#d6b4ff',
	deceased: '#eaecef'
} as const;

const ORDER = ['deceased', 'unprotected', 'partial', 'full', 'recovered', 'silent', 'symptomatic'] as const;
type ColourKey = (typeof ORDER)[number];
const COLOUR_INDEX: Record<ColourKey, number> = Object.fromEntries(ORDER.map((k, i) => [k, i])) as Record<
	ColourKey,
	number
>;

/** Ring colours for look E: the dot colours for infected and died. */
const RINGS = [
	{ state: State.SILENT, colour: COLOURS.silent },
	{ state: State.SYMPTOMATIC, colour: COLOURS.symptomatic },
	{ state: State.DECEASED, colour: COLOURS.deceased }
] as const;
const RING_BUCKETS = RINGS.length * SHARE_STEPS;
/** Ring opacity per share step (look.ts STEP_STRENGTH), the same ladder as the tint. */
const RING_STYLES = RINGS.flatMap((r) => STEP_STRENGTH.map((a) => rgba(r.colour, a)));
/**
 * Fill styles by index: the plain dot colours (ORDER), then, where dots sit too close for a ring,
 * each dot colour tinted toward each ring colour by each share step (look.ts STEP_STRENGTH), so
 * the vaccination colour still shows at low shares.
 */
const TINTS_PER_COLOUR = RINGS.length * SHARE_STEPS;
const FILL_STYLES = [
	...ORDER.map((k) => COLOURS[k]),
	...ORDER.flatMap((k) => RINGS.flatMap((r) => STEP_STRENGTH.map((t) => mix(COLOURS[k], r.colour, t))))
];
/**
 * A seed marker shows this long at full strength, then fades over SEED_FADE (real time, ms) to a
 * thin dim outline that stays until the dot first has nobody infected, so the first case can be watched.
 */
const SEED_SHOW = 2500;
const SEED_FADE = 1500;
const SEED_STAY = 0.35;

/** Draws the world. Holds scratch buckets so drawing allocates nothing per dot. */
/** How far a dot near the end of its patience with a lockdown shakes on screen, in CSS pixels. */
export const JITTER_PX = 1.8;

export class Renderer {
	/** Visible dots in index order, with each one's fill style (FILL_STYLES index). */
	private readonly order: Int32Array;
	private readonly orderStyle: Uint8Array;
	private readonly rings: Int32Array;
	private readonly ringLen = new Int32Array(RING_BUCKETS);
	/** Dots filled silent or ill, for the pulse: [silent..., ill...] by PULSE index. */
	private readonly pulsing: Int32Array;
	private readonly pulseLen = new Int32Array(2);
	/** When this renderer first drew each seed mark, by its number in the run (Scene.now). */
	private markSeen = new Map<number, number>();
	/** Marks whose dot has had nobody infected since; they are not drawn again. */
	private markDone = new Set<number>();
	private marksFor: readonly number[] | null = null;
	private readonly capacity: number;
	private landPath: Path2D | null = null;
	private landFor: World | null = null;
	/** Positions at the latest tick drawn (last) and the tick before it (from), for gliding. */
	private readonly lastX: Float32Array;
	private readonly lastY: Float32Array;
	private readonly fromX: Float32Array;
	private readonly fromY: Float32Array;
	/** Where each dot is drawn this frame, in world units. */
	private readonly atX: Float32Array;
	private readonly atY: Float32Array;
	private readonly planeLast = new Float32Array(MAX_PLANES * 3);
	private readonly planeFrom = new Float32Array(MAX_PLANES * 3);
	/** The tick last drawn: NaN before the first, so a new run never glides from an old one. */
	private lastTick = NaN;
	/** The run the glide positions belong to: Scene.seedMarks is a new array after every setup. */
	private glideRun: readonly number[] | null = null;
	/** True when the map moved on by exactly one tick, so drawing glides between the two. */
	private gliding = false;
	private alpha = 1;

	constructor(capacity: number) {
		this.capacity = capacity;
		this.lastX = new Float32Array(capacity);
		this.lastY = new Float32Array(capacity);
		this.fromX = new Float32Array(capacity);
		this.fromY = new Float32Array(capacity);
		this.atX = new Float32Array(capacity);
		this.atY = new Float32Array(capacity);
		this.order = new Int32Array(capacity);
		this.orderStyle = new Uint8Array(capacity);
		this.rings = new Int32Array(capacity * RING_BUCKETS);
		this.pulsing = new Int32Array(capacity * 2);
	}

	draw(ctx: CanvasRenderingContext2D, viewport: Viewport, camera: Camera, scene: Scene): void {
		const { agents, regions, radii, routes, transit, world, tick, spacing } = scene;
		const { width, height } = viewport;
		// A restart (even one landing on the same tick, while paused) starts the glide afresh.
		if (scene.seedMarks !== this.glideRun) {
			this.glideRun = scene.seedMarks;
			this.lastTick = NaN;
		}
		this.place(agents, transit, tick, scene.alpha);
		this.jitter(agents, scene.now, camera.scale);
		const ax = this.atX;
		const ay = this.atY;
		const s = camera.scale;
		const ox = camera.x;
		const oy = camera.y;

		ctx.fillStyle = MAP_COLOURS.sea;
		ctx.fillRect(0, 0, width, height);
		this.drawGrid(ctx, width, height, camera);

		if (world) {
			if (this.landFor !== world) {
				this.landPath = buildLandPath(world);
				this.landFor = world;
			}
			ctx.save();
			ctx.transform(s, 0, 0, s, -ox * s, -oy * s);
			ctx.fillStyle = MAP_COLOURS.land;
			ctx.fill(this.landPath!, 'evenodd');
			ctx.strokeStyle = MAP_COLOURS.coast;
			ctx.lineWidth = 1.2 / s;
			ctx.stroke(this.landPath!);
			ctx.restore();
		}

		this.drawRoutes(ctx, camera, routes);

		// Population discs.
		ctx.lineWidth = 1.5;
		for (let r = 0; r < regions.length; r++) {
			const reg = regions[r];
			ctx.beginPath();
			ctx.arc((reg.cx - ox) * s, (reg.cy - oy) * s, radii[r] * s + 4, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(8,16,28,0.55)';
			ctx.fill();
			ctx.strokeStyle = 'rgba(180,200,230,0.35)';
			ctx.stroke();
		}

		const size = Math.max(1.5, Math.min(6, 3.2 * s));
		const half = size / 2;
		// Look E (finer-counts §5). A dot some of whose people are infected (or, with none infected,
		// dead) is marked more strongly the larger their share, in the same six steps either way: as a
		// ring where one at least 2 device pixels wide fits within half the spacing, else as a tint of
		// the dot's own colour. At half or more it is filled instead.
		const dpr = ctx.getTransform().a || 1;
		const rw = ringWidth(spacing * s, size, dpr);
		const tint = rw === 0;

		this.ringLen.fill(0);
		this.pulseLen.fill(0);
		let count = 0;
		const n = agents.activeCount;
		const cap = this.capacity;
		const margin = 4;
		for (let i = 0; i < n; i++) {
			// Air passengers ride hidden inside their plane.
			const route = agents.route[i];
			if (route >= 0 && routes[route].kind === 'air') continue;
			const sx = (ax[i] - ox) * s;
			const sy = (ay[i] - oy) * s;
			if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) continue;
			const b = colourOf(agents, i);
			let style = b;
			if (b === COLOUR_INDEX.silent || b === COLOUR_INDEX.symptomatic) {
				const k = b === COLOUR_INDEX.silent ? 0 : 1;
				this.pulsing[k * cap + this.pulseLen[k]++] = i;
			}
			const ring = ringOf(agents.ring[i]);
			if (ring >= 0) {
				const step = agents.shareStep[i];
				if (tint) style = ORDER.length + b * TINTS_PER_COLOUR + ring * SHARE_STEPS + step;
				else {
					const rb = ring * SHARE_STEPS + step;
					this.rings[rb * cap + this.ringLen[rb]++] = i;
				}
			}
			this.order[count] = i;
			this.orderStyle[count++] = style;
		}

		const squares = (list: Int32Array, from: number, len: number, h: number) => {
			const d = h * 2;
			ctx.beginPath();
			for (let k = 0; k < len; k++) {
				const i = list[from + k];
				ctx.rect((ax[i] - ox) * s - h, (ay[i] - oy) * s - h, d, d);
			}
			ctx.fill();
		};
		// Dots are squares, so a ring is a square frame: a larger square, with its dot drawn over it.
		// Rings stay inside half the spacing, so they go first, under every dot.
		if (!tint) {
			for (let rb = 0; rb < RING_BUCKETS; rb++) {
				if (this.ringLen[rb] === 0) continue;
				ctx.fillStyle = RING_STYLES[rb];
				squares(this.rings, rb * cap, this.ringLen[rb], half + rw);
			}
		}
		// Dots in index order, whatever their state, so no colour wins where dots overlap. One fillRect
		// each is as fast as the colour batches were; the style is set only when it changes.
		const d = size;
		let last = -1;
		for (let k = 0; k < count; k++) {
			const style = this.orderStyle[k];
			if (style !== last) {
				ctx.fillStyle = FILL_STYLES[style];
				last = style;
			}
			const i = this.order[k];
			ctx.fillRect((ax[i] - ox) * s - half, (ay[i] - oy) * s - half, d, d);
		}

		// A faint pulsing ring around every dot filled as infected, only where it fits like a ring:
		// where dots sit close, a pulse would cover many neighbours and paint the city red.
		const pulse = 0.5 + 0.5 * Math.sin((this.gliding ? tick - 1 + scene.alpha : tick) * 0.2);
		ctx.lineWidth = 1;
		const showPulse = fits(spacing * s, size, size + 3 - half, dpr);
		for (let k = 0; k < 2 && showPulse; k++) {
			const len = this.pulseLen[k];
			if (len === 0) continue;
			ctx.strokeStyle =
				k === 0 ? `rgba(255,143,31,${0.25 + 0.3 * pulse})` : `rgba(227,59,107,${0.25 + 0.3 * pulse})`;
			ctx.beginPath();
			const rr = size + 1.5 + pulse * 1.5;
			for (let j = 0; j < len; j++) {
				const i = this.pulsing[k * cap + j];
				const sx = (ax[i] - ox) * s;
				const sy = (ay[i] - oy) * s;
				ctx.moveTo(sx + rr, sy);
				ctx.arc(sx, sy, rr, 0, Math.PI * 2);
			}
			ctx.stroke();
		}

		this.drawPlanes(ctx, camera, routes, transit);
		this.drawSeedMarks(ctx, camera, agents, routes, scene, size);
	}

	/**
	 * A ring above everything around each seeded dot: bright at first, then a thin dim outline until
	 * the dot first has nobody infected. The clock is the frame's time from the canvas, from when
	 * this renderer first drew the mark, so the engine stays free of real time.
	 */
	private drawSeedMarks(
		ctx: CanvasRenderingContext2D,
		camera: Camera,
		agents: Agents,
		routes: readonly Route[],
		scene: Scene,
		size: number
	): void {
		const { seedMarks: marks, seedMarkTotal, now } = scene;
		// A new run brings a new array of marks.
		if (marks !== this.marksFor) {
			this.marksFor = marks;
			this.markSeen.clear();
			this.markDone.clear();
		}
		if (marks.length === 0) return;
		const s = camera.scale;
		const r = Math.max(7, size * 2.5);
		// Mark k is number first + k of this run, so a dot seeded twice has two marks and flashes again.
		const first = seedMarkTotal - marks.length;
		for (let k = 0; k < marks.length; k++) {
			const id = first + k;
			if (this.markDone.has(id)) continue;
			const dot = marks[k];
			const infected =
				agents.ring[dot] === State.SILENT ||
				agents.ring[dot] === State.SYMPTOMATIC ||
				agents.shown[dot] === State.SILENT ||
				agents.shown[dot] === State.SYMPTOMATIC;
			if (!infected) {
				this.markDone.add(id);
				this.markSeen.delete(id);
				continue;
			}
			const route = agents.route[dot];
			if (route >= 0 && routes[route].kind === 'air') continue;
			let seen = this.markSeen.get(id);
			if (seen === undefined) this.markSeen.set(id, (seen = now));
			const age = now - seen;
			const fading = age < SEED_SHOW ? 1 : Math.max(0, 1 - (age - SEED_SHOW) / SEED_FADE);
			const alpha = Math.max(fading, SEED_STAY);
			ctx.lineWidth = fading > 0 ? 2 : 1;
			ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
			ctx.beginPath();
			ctx.arc((this.atX[dot] - camera.x) * s, (this.atY[dot] - camera.y) * s, r, 0, Math.PI * 2);
			ctx.stroke();
		}
	}

	/**
	 * Works out where each dot is drawn this frame. A new tick moves the latest positions to `from`,
	 * when it is the next tick; otherwise (a jump of several ticks, or a new run) nothing glides.
	 */
	private place(agents: Agents, transit: Transit, tick: number, alpha: number): void {
		if (tick !== this.lastTick) {
			this.gliding = tick === this.lastTick + 1;
			if (this.gliding) {
				this.fromX.set(this.lastX);
				this.fromY.set(this.lastY);
				this.planeFrom.set(this.planeLast);
			}
			this.lastX.set(agents.x);
			this.lastY.set(agents.y);
			for (let p = 0; p < MAX_PLANES; p++) {
				this.planeLast[p * 3] = transit.planeX[p];
				this.planeLast[p * 3 + 1] = transit.planeY[p];
				this.planeLast[p * 3 + 2] = transit.planeRoute[p];
			}
			this.lastTick = tick;
		}
		this.alpha = alpha;
		const n = agents.activeCount;
		if (!this.gliding) {
			this.atX.set(this.lastX);
			this.atY.set(this.lastY);
			return;
		}
		const k = 1 - alpha;
		for (let i = 0; i < n; i++) {
			const dx = this.lastX[i] - this.fromX[i];
			const dy = this.lastY[i] - this.fromY[i];
			const jump = dx * dx + dy * dy > GLIDE_LIMIT * GLIDE_LIMIT;
			this.atX[i] = jump ? this.lastX[i] : this.lastX[i] - dx * k;
			this.atY[i] = jump ? this.lastY[i] : this.lastY[i] - dy * k;
		}
	}

	/**
	 * Dots close to tiring of a lockdown jitter where they are drawn (6.4): an offset from the frame's
	 * time only, so it uses no random numbers and never changes the simulation. Sized on screen,
	 * JITTER_PX at any zoom, so it shows when zoomed out.
	 */
	private jitter(agents: Agents, now: number, scale: number): void {
		const { restless } = agents;
		const by = JITTER_PX / scale;
		for (let i = 0; i < agents.activeCount; i++) {
			if (restless[i] === 0) continue;
			const t = now * 0.025 + i * 1.7;
			this.atX[i] += Math.sin(t) * by;
			this.atY[i] += Math.cos(t * 1.3) * by;
		}
	}

	/** A plane's drawn x (axis 0) or y (1): gliding like the dots while it stays on the same route. */
	private planeAt(transit: Transit, p: number, axis: number): number {
		const now = axis === 0 ? transit.planeX[p] : transit.planeY[p];
		if (!this.gliding || this.planeFrom[p * 3 + 2] !== transit.planeRoute[p]) return now;
		const from = this.planeFrom[p * 3 + axis];
		return now - (now - from) * (1 - this.alpha);
	}

	private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, camera: Camera): void {
		const spacing = 200;
		const s = camera.scale;
		if (spacing * s < 12) return;
		ctx.strokeStyle = MAP_COLOURS.grid;
		ctx.lineWidth = 1;
		ctx.beginPath();
		const x0 = Math.floor(camera.x / spacing) * spacing;
		for (let x = x0; (x - camera.x) * s < width; x += spacing) {
			const sx = Math.round((x - camera.x) * s) + 0.5;
			ctx.moveTo(sx, 0);
			ctx.lineTo(sx, height);
		}
		const y0 = Math.floor(camera.y / spacing) * spacing;
		for (let y = y0; (y - camera.y) * s < height; y += spacing) {
			const sy = Math.round((y - camera.y) * s) + 0.5;
			ctx.moveTo(0, sy);
			ctx.lineTo(width, sy);
		}
		ctx.stroke();
	}

	private drawRoutes(ctx: CanvasRenderingContext2D, camera: Camera, routes: readonly Route[]): void {
		const s = camera.scale;
		for (const route of routes) {
			ctx.beginPath();
			const p = route.points;
			ctx.moveTo((p[0] - camera.x) * s, (p[1] - camera.y) * s);
			for (let k = 2; k < p.length; k += 2) ctx.lineTo((p[k] - camera.x) * s, (p[k + 1] - camera.y) * s);
			if (route.kind === 'road') {
				ctx.setLineDash([]);
				ctx.lineWidth = 2.5;
				ctx.strokeStyle = MAP_COLOURS.road;
			} else if (route.kind === 'ferry') {
				ctx.setLineDash([6, 5]);
				ctx.lineWidth = 2;
				ctx.strokeStyle = MAP_COLOURS.ferry;
			} else {
				ctx.setLineDash([10, 8]);
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = MAP_COLOURS.air;
			}
			if (!route.open) ctx.globalAlpha = 0.25;
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
		ctx.setLineDash([]);
	}

	private drawPlanes(
		ctx: CanvasRenderingContext2D,
		camera: Camera,
		routes: readonly Route[],
		transit: Transit
	): void {
		const s = camera.scale;
		ctx.fillStyle = MAP_COLOURS.plane;
		for (let p = 0; p < MAX_PLANES; p++) {
			const r = transit.planeRoute[p];
			if (r < 0) continue;
			const route = routes[r];
			const px = this.planeAt(transit, p, 0);
			const py = this.planeAt(transit, p, 1);
			const x = (px - camera.x) * s;
			const y = (py - camera.y) * s;
			// Heading: a little further along the route.
			const ahead = Math.min(route.length, Math.max(0, transit.planeS[p] + transit.planeDir[p] * 10));
			const hx = pointX(route, ahead) - px;
			const hy = pointY(route, ahead) - py;
			const a = Math.atan2(hy, hx);
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(a);
			ctx.beginPath();
			ctx.moveTo(9, 0);
			ctx.lineTo(-6, -6);
			ctx.lineTo(-3, 0);
			ctx.lineTo(-6, 6);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
	}
}

const tmp = { x: 0, y: 0 };
function pointX(route: Route, s: number): number {
	pointAt(route, s, tmp);
	return tmp.x;
}
function pointY(route: Route, s: number): number {
	pointAt(route, s, tmp);
	return tmp.y;
}

function buildLandPath(world: World): Path2D {
	const path = new Path2D();
	for (const ring of world.coastlines) {
		path.moveTo(ring[0], ring[1]);
		for (let k = 2; k < ring.length; k += 2) path.lineTo(ring[k], ring[k + 1]);
		path.closePath();
	}
	return path;
}

/** `#rrggbb` as an rgba() string. */
function rgba(hex: string, alpha: number): string {
	const [r, g, b] = rgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
}

function rgb(hex: string): [number, number, number] {
	const v = parseInt(hex.slice(1), 16);
	return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** `from` moved share `t` of the way to `to`, as #rrggbb. */
function mix(from: string, to: string, t: number): string {
	const a = rgb(from);
	const b = rgb(to);
	return `#${a
		.map((c, k) =>
			Math.round(c + (b[k] - c) * t)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

function ringOf(state: number): number {
	for (let k = 0; k < RINGS.length; k++) if (RINGS[k].state === state) return k;
	return -1;
}

function colourOf(agents: Agents, i: number): number {
	const s = agents.displayState(i);
	if (s === State.DECEASED) return COLOUR_INDEX.deceased;
	if (s === State.SYMPTOMATIC || agents.isolated[i] === 1) return COLOUR_INDEX.symptomatic;
	if (s === State.SILENT) return COLOUR_INDEX.silent;
	if (s === State.RECOVERED) return COLOUR_INDEX.recovered;
	const p = agents.protection[i];
	if (p === Protection.FULL) return COLOUR_INDEX.full;
	if (p === Protection.PARTIAL) return COLOUR_INDEX.partial;
	return COLOUR_INDEX.unprotected;
}
