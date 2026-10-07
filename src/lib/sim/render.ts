import { Agents } from './agents';
import { Camera } from './camera';
import type { World } from './geography';
import { pointAt } from './routes';
import { MAX_PLANES, type Transit } from './transit';
import { Protection, State, type Region, type Route, type Viewport } from './types';

export interface Scene {
	agents: Agents;
	regions: readonly Region[];
	radii: Float32Array;
	routes: readonly Route[];
	transit: Transit;
	world: World | null;
	tick: number;
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
 */
export const COLOURS = {
	unprotected: '#3a7bf0',
	full: '#2fbf71',
	partial: '#ecd24a',
	silent: '#ff8f1f',
	symptomatic: '#e33b6b',
	recovered: '#d6b4ff',
	deceased: '#7a7f87'
} as const;

const ORDER = ['deceased', 'unprotected', 'partial', 'full', 'recovered', 'silent', 'symptomatic'] as const;
type ColourKey = (typeof ORDER)[number];
const COLOUR_INDEX: Record<ColourKey, number> = Object.fromEntries(ORDER.map((k, i) => [k, i])) as Record<
	ColourKey,
	number
>;

/** Draws the world. Holds scratch buckets so drawing allocates nothing per dot. */
export class Renderer {
	private readonly buckets: Int32Array;
	private readonly bucketLen = new Int32Array(ORDER.length);
	private readonly capacity: number;
	private landPath: Path2D | null = null;
	private landFor: World | null = null;

	constructor(capacity: number) {
		this.capacity = capacity;
		this.buckets = new Int32Array(capacity * ORDER.length);
	}

	draw(ctx: CanvasRenderingContext2D, viewport: Viewport, camera: Camera, scene: Scene): void {
		const { agents, regions, radii, routes, transit, world, tick } = scene;
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

		// Sort visible dots into colour buckets.
		this.bucketLen.fill(0);
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
			this.buckets[b * cap + this.bucketLen[b]++] = i;
		}

		const size = Math.max(1.5, Math.min(6, 3.2 * s));
		const half = size / 2;
		for (let b = 0; b < ORDER.length; b++) {
			const len = this.bucketLen[b];
			if (len === 0) continue;
			ctx.fillStyle = COLOURS[ORDER[b]];
			ctx.beginPath();
			for (let k = 0; k < len; k++) {
				const i = this.buckets[b * cap + k];
				ctx.rect((agents.x[i] - ox) * s - half, (agents.y[i] - oy) * s - half, size, size);
			}
			ctx.fill();
		}

		// A faint pulsing ring around every infectious dot.
		const pulse = 0.5 + 0.5 * Math.sin(tick * 0.2);
		ctx.lineWidth = 1;
		for (const key of ['silent', 'symptomatic'] as const) {
			const b = COLOUR_INDEX[key];
			const len = this.bucketLen[b];
			if (len === 0) continue;
			ctx.strokeStyle =
				key === 'silent'
					? `rgba(255,143,31,${0.25 + 0.3 * pulse})`
					: `rgba(227,59,107,${0.25 + 0.3 * pulse})`;
			ctx.beginPath();
			const rr = size + 1.5 + pulse * 1.5;
			for (let k = 0; k < len; k++) {
				const i = this.buckets[b * cap + k];
				const sx = (agents.x[i] - ox) * s;
				const sy = (agents.y[i] - oy) * s;
				ctx.moveTo(sx + rr, sy);
				ctx.arc(sx, sy, rr, 0, Math.PI * 2);
			}
			ctx.stroke();
		}

		this.drawPlanes(ctx, camera, routes, transit);
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

function colourOf(agents: Agents, i: number): number {
	const s = agents.state[i];
	if (s === State.DECEASED) return COLOUR_INDEX.deceased;
	if (s === State.SYMPTOMATIC || agents.isolated[i] === 1) return COLOUR_INDEX.symptomatic;
	if (s === State.SILENT) return COLOUR_INDEX.silent;
	if (s === State.RECOVERED) return COLOUR_INDEX.recovered;
	const p = agents.protection[i];
	if (p === Protection.FULL) return COLOUR_INDEX.full;
	if (p === Protection.PARTIAL) return COLOUR_INDEX.partial;
	return COLOUR_INDEX.unprotected;
}
