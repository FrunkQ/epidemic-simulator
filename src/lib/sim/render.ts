import { Agents } from './agents';
import { Camera } from './camera';
import type { World } from './geography';
import { pointAt } from './routes';
import { MAX_PLANES, type Transit } from './transit';
import { RING_LEVELS, TINT, ringWidth } from './look';
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
	/** Dots just seeded by the button, with the time (performance.now) they were seeded. */
	seedMarks: readonly { dot: number; at: number }[];
}

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
const RING_BUCKETS = RINGS.length * RING_LEVELS;
/** Ring opacity per level: even the lowest stands out from the dark disc. */
const RING_ALPHA = [0.6, 0.75, 0.88, 1] as const;
const RING_STYLES = RINGS.flatMap((r) => RING_ALPHA.map((a) => rgba(r.colour, a)));
/**
 * When there's no room for a ring, the dot itself shows the ring colour, dimmed toward the dark
 * disc by level: every level stands apart from every plain dot colour, the top short of solid.
 */
const DISC_UNDER_DOTS = '#0d1827';
const TINT_STYLES = RINGS.flatMap((r) => TINT.map((t) => mix(DISC_UNDER_DOTS, r.colour, t)));
/** A seed marker shows this long at full strength, then fades out over SEED_FADE (real time, ms). */
const SEED_SHOW = 2500;
const SEED_FADE = 1500;

/** Draws the world. Holds scratch buckets so drawing allocates nothing per dot. */
export class Renderer {
	private readonly buckets: Int32Array;
	private readonly bucketLen = new Int32Array(ORDER.length);
	private readonly rings: Int32Array;
	private readonly ringLen = new Int32Array(RING_BUCKETS);
	/** Dots drawn after the rings: ringed dots in their own colour, and dots filled infected or dead. */
	private readonly top: Int32Array;
	private readonly topLen = new Int32Array(ORDER.length);
	private readonly tinted: Int32Array;
	private readonly tintLen = new Int32Array(RING_BUCKETS);
	private readonly capacity: number;
	private landPath: Path2D | null = null;
	private landFor: World | null = null;

	constructor(capacity: number) {
		this.capacity = capacity;
		this.buckets = new Int32Array(capacity * ORDER.length);
		this.rings = new Int32Array(capacity * RING_BUCKETS);
		this.top = new Int32Array(capacity * ORDER.length);
		this.tinted = new Int32Array(capacity * RING_BUCKETS);
	}

	draw(ctx: CanvasRenderingContext2D, viewport: Viewport, camera: Camera, scene: Scene): void {
		const { agents, regions, radii, routes, transit, world, tick, spacing, seedMarks } = scene;
		const { width, height } = viewport;
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
		// dead) gets a ring, brighter the more of them there are; at half or more it is filled instead.
		// The ring stays inside the dot's share of the space, so it never covers a neighbour; when
		// that leaves under a device pixel, the dot itself shows the ring colour, dimmed by level.
		const dpr = ctx.getTransform().a || 1;
		const rw = ringWidth(spacing * s, size, dpr);
		const tint = rw === 0;

		// Sort visible dots into buckets: plain dots, rings, tinted dots, and dots drawn on top.
		this.bucketLen.fill(0);
		this.ringLen.fill(0);
		this.topLen.fill(0);
		this.tintLen.fill(0);
		const n = agents.activeCount;
		const cap = this.capacity;
		const margin = 4;
		for (let i = 0; i < n; i++) {
			// Air passengers ride hidden inside their plane.
			const route = agents.route[i];
			if (route >= 0 && routes[route].kind === 'air') continue;
			const sx = (agents.x[i] - ox) * s;
			const sy = (agents.y[i] - oy) * s;
			if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) continue;
			const b = colourOf(agents, i);
			const ring = ringOf(agents.ring[i]);
			if (ring < 0) {
				if (b === COLOUR_INDEX.silent || b === COLOUR_INDEX.symptomatic || b === COLOUR_INDEX.deceased)
					this.top[b * cap + this.topLen[b]++] = i;
				else this.buckets[b * cap + this.bucketLen[b]++] = i;
				continue;
			}
			const rb = ring * RING_LEVELS + agents.ringLevel[i];
			if (tint) {
				this.tinted[rb * cap + this.tintLen[rb]++] = i;
			} else {
				this.rings[rb * cap + this.ringLen[rb]++] = i;
				this.top[b * cap + this.topLen[b]++] = i;
			}
		}

		const squares = (list: Int32Array, from: number, len: number, h: number) => {
			const d = h * 2;
			ctx.beginPath();
			for (let k = 0; k < len; k++) {
				const i = list[from + k];
				ctx.rect((agents.x[i] - ox) * s - h, (agents.y[i] - oy) * s - h, d, d);
			}
			ctx.fill();
		};
		for (let b = 0; b < ORDER.length; b++) {
			if (this.bucketLen[b] === 0) continue;
			ctx.fillStyle = COLOURS[ORDER[b]];
			squares(this.buckets, b * cap, this.bucketLen[b], half);
		}
		if (tint) {
			for (let tb = 0; tb < this.tintLen.length; tb++) {
				if (this.tintLen[tb] === 0) continue;
				ctx.fillStyle = TINT_STYLES[tb];
				squares(this.tinted, tb * cap, this.tintLen[tb], half);
			}
		} else {
			// Dots are squares, so a ring is a square frame: a larger square, with its dot drawn over it.
			for (let rb = 0; rb < RING_BUCKETS; rb++) {
				if (this.ringLen[rb] === 0) continue;
				ctx.fillStyle = RING_STYLES[rb];
				squares(this.rings, rb * cap, this.ringLen[rb], half + rw);
			}
		}
		for (let b = 0; b < ORDER.length; b++) {
			if (this.topLen[b] === 0) continue;
			ctx.fillStyle = COLOURS[ORDER[b]];
			squares(this.top, b * cap, this.topLen[b], half);
		}

		// A faint pulsing ring around every dot filled as infected.
		const pulse = 0.5 + 0.5 * Math.sin(tick * 0.2);
		ctx.lineWidth = 1;
		for (const key of ['silent', 'symptomatic'] as const) {
			const b = COLOUR_INDEX[key];
			const len = this.topLen[b];
			if (len === 0) continue;
			ctx.strokeStyle =
				key === 'silent'
					? `rgba(255,143,31,${0.25 + 0.3 * pulse})`
					: `rgba(227,59,107,${0.25 + 0.3 * pulse})`;
			ctx.beginPath();
			const rr = size + 1.5 + pulse * 1.5;
			for (let k = 0; k < len; k++) {
				const i = this.top[b * cap + k];
				const sx = (agents.x[i] - ox) * s;
				const sy = (agents.y[i] - oy) * s;
				ctx.moveTo(sx + rr, sy);
				ctx.arc(sx, sy, rr, 0, Math.PI * 2);
			}
			ctx.stroke();
		}

		this.drawPlanes(ctx, camera, routes, transit);
		this.drawSeedMarks(ctx, camera, agents, routes, seedMarks, size);
	}

	/** A one-off ring above everything around each just-seeded dot, so one case can always be found. */
	private drawSeedMarks(
		ctx: CanvasRenderingContext2D,
		camera: Camera,
		agents: Agents,
		routes: readonly Route[],
		marks: Scene['seedMarks'],
		size: number
	): void {
		if (marks.length === 0) return;
		const now = performance.now();
		const s = camera.scale;
		const r = Math.max(7, size * 2.5);
		ctx.lineWidth = 2;
		for (const m of marks) {
			const age = now - m.at;
			if (age < 0 || age > SEED_SHOW + SEED_FADE) continue;
			const route = agents.route[m.dot];
			if (route >= 0 && routes[route].kind === 'air') continue;
			const alpha = age < SEED_SHOW ? 1 : 1 - (age - SEED_SHOW) / SEED_FADE;
			const sx = (agents.x[m.dot] - camera.x) * s;
			const sy = (agents.y[m.dot] - camera.y) * s;
			ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
			ctx.beginPath();
			ctx.arc(sx, sy, r, 0, Math.PI * 2);
			ctx.stroke();
		}
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
			const x = (transit.planeX[p] - camera.x) * s;
			const y = (transit.planeY[p] - camera.y) * s;
			// Heading: a little further along the route.
			const ahead = Math.min(route.length, Math.max(0, transit.planeS[p] + transit.planeDir[p] * 10));
			const hx = pointX(route, ahead) - transit.planeX[p];
			const hy = pointY(route, ahead) - transit.planeY[p];
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
