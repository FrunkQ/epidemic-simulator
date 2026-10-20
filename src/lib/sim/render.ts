import { Agents } from './agents';
import { Camera } from './camera';
import type { World } from './geography';
import { pointAt } from './routes';
import { MAX_PLANES, type Transit } from './transit';
import type { People } from './people';
import {
	DEAD_DIM,
	FULL_DIM,
	INFECTED_LIFT,
	PARTIAL_DIM,
	RECOVERED_DIM,
	SHADE_FLOOR,
	SHADE_RING_PX,
	SHADE_STEP,
	UNPROTECTED_DIM,
	speckMinSide,
	SPECK_PATCH,
	css,
	dimmed,
	mixed,
	packed,
	paintSpecks,
	rgbOf,
	shadeStrength,
	type Box,
	type MapLook
} from './specks';
import { Protection, State, type Region, type Route, type Viewport } from './types';

export interface Scene {
	agents: Agents;
	/** Each dot's people, which both views draw from. */
	people: People;
	/** Which map view to draw (specks.ts): drawing only, never the simulation. */
	look: MapLook;
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
 * The full colours: the charts and cards draw them as they are, and the map draws them dimmed
 * (BASES) or lifted (LIFTED). Died is pale (10 Oct) so it differs from both infected colours by
 * lightness. Their closest pair under each colour vision is the bar colours.test.ts holds every
 * pair the map draws to.
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

/** The land the dots are dimmed toward. */
const LAND = rgbOf(MAP_COLOURS.land);
/**
 * The dimmed fills both views start from: a dot is drawn dead or recovered when half or more of
 * its people are, else in its vaccination colour.
 */
const BASES = [
	dimmed(rgbOf(COLOURS.deceased), DEAD_DIM, LAND),
	dimmed(rgbOf(COLOURS.recovered), RECOVERED_DIM, LAND),
	dimmed(rgbOf(COLOURS.unprotected), UNPROTECTED_DIM, LAND),
	dimmed(rgbOf(COLOURS.full), FULL_DIM, LAND),
	dimmed(rgbOf(COLOURS.partial), PARTIAL_DIM, LAND)
];
const BASE = { dead: 0, recovered: 1, unprotected: 2, full: 3, partial: 4 } as const;
/** The dimmed colours as the legend shows them, by COLOURS key. */
export const DIMMED_COLOURS = {
	deceased: css(BASES[BASE.dead]),
	recovered: css(BASES[BASE.recovered]),
	unprotected: css(BASES[BASE.unprotected]),
	full: css(BASES[BASE.full]),
	partial: css(BASES[BASE.partial])
} as const;
const WHITE = rgbOf('#ffffff');
/** Infected people's specks, and Shading's infected colours and outlines: orange and red lifted toward white. */
const LIFTED = [
	mixed(rgbOf(COLOURS.silent), WHITE, INFECTED_LIFT),
	mixed(rgbOf(COLOURS.symptomatic), WHITE, INFECTED_LIFT)
];
/** The lifted colours as the legend shows them. */
export const LIFTED_COLOURS = { silent: css(LIFTED[0]), symptomatic: css(LIFTED[1]) } as const;
const RING_STYLES = LIFTED.map(css);
const SHADE_TARGETS = LIFTED;
const SHADE_LEVELS = Math.round(1 / SHADE_STEP) + 1;
/**
 * Fill styles by index: the bases, then for Shading each base moved toward each infected colour
 * by each step of strength, made once so a frame builds no strings.
 */
const FILL_STYLES = [
	...BASES.map(css),
	...BASES.flatMap((b) =>
		SHADE_TARGETS.flatMap((t) =>
			Array.from({ length: SHADE_LEVELS }, (_, l) => css(mixed(b, t, l * SHADE_STEP)))
		)
	)
];
const shadeStyle = (base: number, target: number, strength: number) =>
	BASES.length + (base * SHADE_TARGETS.length + target) * SHADE_LEVELS + Math.round(strength / SHADE_STEP);
/**
 * Every colour the map draws dots in, for the colour check (colours.test.ts): the dimmed dots,
 * the specks and outlines, and each Shading fill a dot with anyone infected can take.
 */
export const MAP_PALETTE = {
	bases: { ...DIMMED_COLOURS },
	lifted: { ...LIFTED_COLOURS },
	shadeFills: Object.entries(BASE).flatMap(([base, b]) =>
		SHADE_TARGETS.map((_, t) => ({
			base,
			target: t === 0 ? 'silent' : 'symptomatic',
			fills: Array.from({ length: SHADE_LEVELS }, (_, l) => l * SHADE_STEP)
				.filter((strength) => strength >= SHADE_FLOOR - 1e-9)
				.map((strength) => ({
					strength,
					fill: FILL_STYLES[shadeStyle(b, t, strength)],
					outline: strength < 1
				}))
		}))
	)
};
/** Speck colours: infected people bright, deaths pale. */
const SPECK_COLOURS = {
	dead: packed(dimmed(rgbOf(COLOURS.deceased), DEAD_DIM, LAND)),
	ill: packed(LIFTED[1]),
	silent: packed(LIFTED[0])
};
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
	private readonly orderStyle: Uint16Array;
	/** Shading: each drawn dot's outline, 0 for none, else 1 + its infected colour's index. */
	private readonly orderRing: Uint8Array;
	/** The specks' own layer, the canvas's size in device pixels, and the area painted last frame. */
	private layer: { img: ImageData; buf: Uint32Array } | null = null;
	/**
	 * Where the painted area is copied to be drawn, only as big as it has needed to be: copying the
	 * whole layer at once costs a 2x screen several ms.
	 */
	private blit: OffscreenCanvas | null = null;
	private readonly painted: Box = { x0: 0, y0: 0, x1: 0, y1: 0 };
	/** How many infected people the last frame drew as specks (0 in Shading), for the tests. */
	specksDrawn = 0;
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
		this.orderStyle = new Uint16Array(capacity);
		this.orderRing = new Uint8Array(capacity);
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
		const { people, look } = scene;
		const per = people.perDot;
		let count = 0;
		const n = agents.activeCount;
		// In Specks a dot's people reach a patch away from it, so a dot just off screen is still drawn.
		const margin = 4 + (look === 'specks' ? spacing * SPECK_PATCH * s : 0);
		for (let i = 0; i < n; i++) {
			// Air passengers ride hidden inside their plane.
			const route = agents.route[i];
			if (route >= 0 && routes[route].kind === 'air') continue;
			const sx = (ax[i] - ox) * s;
			const sy = (ay[i] - oy) * s;
			if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) continue;
			const base = baseOf(agents, people, i);
			let style: number = base;
			let ring = 0;
			if (look === 'shading') {
				const ill = people.ill[i];
				const infected = ill + people.silentSymptomatic[i] + people.silentAsymptomatic[i];
				if (infected > 0) {
					const target = ill >= infected - ill ? 1 : 0;
					const strength = shadeStrength(infected, per);
					style = shadeStyle(base, target, strength);
					// A solid dot reads as infected by its fill; a paler one needs its outline.
					if (strength < 1) ring = 1 + target;
				}
			}
			this.orderRing[count] = ring;
			this.order[count] = i;
			this.orderStyle[count++] = style;
		}

		// Dots in index order, whatever their state, so no colour wins where dots overlap; the style is
		// set only when it changes.
		let last = -1;
		for (let k = 0; k < count; k++) {
			const style = this.orderStyle[k];
			if (style !== last) {
				ctx.fillStyle = FILL_STYLES[style];
				last = style;
			}
			const i = this.order[k];
			ctx.fillRect((ax[i] - ox) * s - half, (ay[i] - oy) * s - half, size, size);
		}

		// Shading: a light outline round each dot with anyone infected that is not yet solid, over
		// its neighbours, so it reads as infected by lightness and not by colour alone.
		if (look === 'shading') {
			const w = SHADE_RING_PX;
			const edge = half + w / 2;
			ctx.lineWidth = w;
			for (let r = 1; r <= RING_STYLES.length; r++) {
				ctx.beginPath();
				let any = false;
				for (let k = 0; k < count; k++) {
					if (this.orderRing[k] !== r) continue;
					const i = this.order[k];
					ctx.rect((ax[i] - ox) * s - edge, (ay[i] - oy) * s - edge, size + w, size + w);
					any = true;
				}
				if (!any) continue;
				ctx.strokeStyle = RING_STYLES[r - 1];
				ctx.stroke();
			}
		}

		this.specksDrawn = 0;
		if (look === 'specks') this.drawSpecks(ctx, camera, people, count, size, spacing);
		else if (this.layer) {
			// Shading: clear what Specks last painted, so switching back starts from an empty layer.
			const { buf, img } = this.layer;
			const p = this.painted;
			for (let y = p.y0; y < p.y1; y++) buf.fill(0, y * img.width + p.x0, y * img.width + p.x1);
			p.x1 = p.x0;
		}

		this.drawPlanes(ctx, camera, routes, transit);
		this.drawSeedMarks(ctx, camera, agents, routes, scene, size);
	}

	/**
	 * Specks: each infected person, and each death, painted one by one into the specks' layer around
	 * where their dot is drawn this frame (so they glide, travel and shake with it), then the painted
	 * area copied onto the map.
	 */
	private drawSpecks(
		ctx: CanvasRenderingContext2D,
		camera: Camera,
		people: People,
		count: number,
		size: number,
		spacing: number
	): void {
		const t = ctx.getTransform();
		const dpr = t.a || 1;
		const W = ctx.canvas.width;
		const H = ctx.canvas.height;
		if (W === 0 || H === 0 || typeof OffscreenCanvas === 'undefined') return;
		if (!this.layer || this.layer.img.width !== W || this.layer.img.height !== H) {
			const img = new ImageData(W, H);
			this.layer = { img, buf: new Uint32Array(img.data.buffer) };
			this.painted.x1 = this.painted.x0;
		}
		const { img, buf } = this.layer;
		this.specksDrawn = paintSpecks(
			buf,
			W,
			H,
			people,
			{
				list: this.order,
				count,
				x: this.atX,
				y: this.atY,
				ox: camera.x,
				oy: camera.y,
				scale: camera.scale * dpr,
				patch: spacing * SPECK_PATCH,
				minSide: speckMinSide(dpr),
				maxSide: Math.max(1, Math.round(size * dpr)),
				colours: SPECK_COLOURS
			},
			this.painted
		);
		const p = this.painted;
		if (p.x1 <= p.x0) return;
		// Only the area painted this frame is copied, to the top left of the blit canvas, then drawn.
		const w = p.x1 - p.x0;
		const h = p.y1 - p.y0;
		if (!this.blit || this.blit.width < w || this.blit.height < h)
			this.blit = new OffscreenCanvas(
				Math.max(w, this.blit?.width ?? 0),
				Math.max(h, this.blit?.height ?? 0)
			);
		this.blit.getContext('2d')!.putImageData(img, -p.x0, -p.y0, p.x0, p.y0, w, h);
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(this.blit, 0, 0, w, h, p.x0, p.y0, w, h);
		ctx.restore();
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

/** A dot's dimmed fill (BASES): dead or recovered when half or more of its people are, else its vaccination colour. */
function baseOf(agents: Agents, people: People, i: number): number {
	const per = people.perDot;
	if (2 * people.dead[i] >= per) return BASE.dead;
	if (2 * people.recovered[i] >= per) return BASE.recovered;
	const p = agents.protection[i];
	if (p === Protection.FULL) return BASE.full;
	if (p === Protection.PARTIAL) return BASE.partial;
	return BASE.unprotected;
}
