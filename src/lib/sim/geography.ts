import { contours } from 'd3-contour';
import { createNoise2D } from 'simplex-noise';
import { LAND_SHARE, MAP_CELL, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { Rng } from './rng';

/**
 * A procedural world: land and sea from a seeded heightmap. Pure and deterministic from the
 * seed. The land shapes are used for validation, route generation, site suggestions and
 * drawing; dots never test them at runtime.
 */
export interface World {
	seed: number;
	width: number;
	height: number;
	cell: number;
	cols: number;
	rows: number;
	elevation: Float32Array;
	seaLevel: number;
	/** 1 for land cells. */
	land: Uint8Array;
	/** Connected land mass id per cell (-1 for water). */
	component: Int32Array;
	componentSize: number[];
	/** Distance in world units from each land cell to the nearest water (0 for water). */
	coastDist: Float32Array;
	/** Coastline rings in world units: each ring is [x0, y0, x1, y1, ...]. */
	coastlines: number[][];
}

export function generateWorld(seed: number, width = WORLD_WIDTH, height = WORLD_HEIGHT): World {
	const rng = new Rng(seed);
	const noise = createNoise2D(() => rng.next());
	const cell = MAP_CELL;
	const cols = Math.ceil(width / cell);
	const rows = Math.ceil(height / cell);
	const elevation = new Float32Array(cols * rows);
	const ox = rng.range(-1000, 1000);
	const oy = rng.range(-1000, 1000);

	const fbm = (x: number, y: number, octaves: number) => {
		let sum = 0;
		let amp = 1;
		let freq = 1;
		let norm = 0;
		for (let o = 0; o < octaves; o++) {
			sum += amp * noise(x * freq + ox, y * freq + oy);
			norm += amp;
			amp *= 0.45;
			freq *= 2;
		}
		return sum / norm;
	};

	const aspect = width / height;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const nx = (c + 0.5) / cols;
			const ny = (r + 0.5) / rows;
			// Domain warping bends the coastlines into bays and peninsulas.
			const wx = nx * aspect * 1.7 + 0.35 * fbm(nx * 2.5 + 11.7, ny * 2.5 + 3.1, 3);
			const wy = ny * 1.7 + 0.35 * fbm(nx * 2.5 + 7.3, ny * 2.5 + 19.9, 3);
			let e = fbm(wx, wy, 4);
			// Fall off towards the edges so the world is ringed by sea.
			const dx = Math.abs(nx * 2 - 1);
			const dy = Math.abs(ny * 2 - 1);
			const d = Math.max(dx, dy);
			e -= smoothstep(0.72, 1, d) * 1.2;
			elevation[r * cols + c] = e;
		}
	}

	const sorted = Float32Array.from(elevation).sort();
	const seaLevel = sorted[Math.floor(sorted.length * (1 - LAND_SHARE))];
	const land = new Uint8Array(cols * rows);
	for (let i = 0; i < land.length; i++) land[i] = elevation[i] > seaLevel ? 1 : 0;

	const { component, componentSize } = labelComponents(land, cols, rows);
	const coastDist = distanceToWater(land, cols, rows, cell);
	const coastlines = traceCoastlines(elevation, seaLevel, cols, rows, cell);

	return {
		seed,
		width,
		height,
		cell,
		cols,
		rows,
		elevation,
		seaLevel,
		land,
		component,
		componentSize,
		coastDist,
		coastlines
	};
}

function smoothstep(a: number, b: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

export function cellAt(world: World, x: number, y: number): number {
	const c = Math.min(world.cols - 1, Math.max(0, Math.floor(x / world.cell)));
	const r = Math.min(world.rows - 1, Math.max(0, Math.floor(y / world.cell)));
	return r * world.cols + c;
}

export function isLand(world: World, x: number, y: number): boolean {
	if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
	return world.land[cellAt(world, x, y)] === 1;
}

/** Share of a disc that lies on land (sampled). */
export function landShareOfDisc(world: World, cx: number, cy: number, radius: number): number {
	let on = 0;
	let total = 0;
	const step = Math.max(world.cell, radius / 8);
	for (let y = cy - radius; y <= cy + radius; y += step) {
		for (let x = cx - radius; x <= cx + radius; x += step) {
			if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
			total++;
			if (isLand(world, x, y)) on++;
		}
	}
	return total === 0 ? 0 : on / total;
}

/** Length of water crossed by the straight line from a to b, in world units. */
export function waterAlong(
	world: World,
	ax: number,
	ay: number,
	bx: number,
	by: number
): {
	water: number;
	longestGap: number;
} {
	const len = Math.hypot(bx - ax, by - ay);
	const steps = Math.max(1, Math.ceil(len / (world.cell / 2)));
	const ds = len / steps;
	let water = 0;
	let gap = 0;
	let longestGap = 0;
	for (let k = 0; k <= steps; k++) {
		const t = k / steps;
		if (isLand(world, ax + (bx - ax) * t, ay + (by - ay) * t)) {
			gap = 0;
		} else {
			water += ds;
			gap += ds;
			if (gap > longestGap) longestGap = gap;
		}
	}
	return { water, longestGap };
}

function labelComponents(land: Uint8Array, cols: number, rows: number) {
	const component = new Int32Array(land.length).fill(-1);
	const componentSize: number[] = [];
	const stack: number[] = [];
	for (let start = 0; start < land.length; start++) {
		if (land[start] !== 1 || component[start] !== -1) continue;
		const id = componentSize.length;
		let size = 0;
		component[start] = id;
		stack.push(start);
		while (stack.length > 0) {
			const i = stack.pop()!;
			size++;
			const c = i % cols;
			const r = (i - c) / cols;
			if (c > 0) visit(i - 1);
			if (c < cols - 1) visit(i + 1);
			if (r > 0) visit(i - cols);
			if (r < rows - 1) visit(i + cols);
		}
		componentSize.push(size);
		function visit(j: number) {
			if (land[j] === 1 && component[j] === -1) {
				component[j] = id;
				stack.push(j);
			}
		}
	}
	return { component, componentSize };
}

/** Two-pass chamfer distance transform from water cells (approximate Euclidean). */
function distanceToWater(land: Uint8Array, cols: number, rows: number, cell: number): Float32Array {
	const d = new Float32Array(land.length);
	const INF = 1e9;
	for (let i = 0; i < land.length; i++) d[i] = land[i] === 1 ? INF : 0;
	const a = 1;
	const b = Math.SQRT2;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			if (d[i] === 0) continue;
			let v = d[i];
			if (c > 0) v = Math.min(v, d[i - 1] + a);
			if (r > 0) {
				v = Math.min(v, d[i - cols] + a);
				if (c > 0) v = Math.min(v, d[i - cols - 1] + b);
				if (c < cols - 1) v = Math.min(v, d[i - cols + 1] + b);
			}
			d[i] = v;
		}
	}
	for (let r = rows - 1; r >= 0; r--) {
		for (let c = cols - 1; c >= 0; c--) {
			const i = r * cols + c;
			if (d[i] === 0) continue;
			let v = d[i];
			if (c < cols - 1) v = Math.min(v, d[i + 1] + a);
			if (r < rows - 1) {
				v = Math.min(v, d[i + cols] + a);
				if (c < cols - 1) v = Math.min(v, d[i + cols + 1] + b);
				if (c > 0) v = Math.min(v, d[i + cols - 1] + b);
			}
			d[i] = v;
		}
	}
	for (let i = 0; i < d.length; i++) d[i] = d[i] >= INF ? cols * cell : d[i] * cell;
	return d;
}

function traceCoastlines(
	elevation: Float32Array,
	seaLevel: number,
	cols: number,
	rows: number,
	cell: number
): number[][] {
	const [shape] = contours().size([cols, rows]).thresholds([seaLevel])(Array.from(elevation));
	const rings: number[][] = [];
	for (const polygon of shape.coordinates) {
		for (const ring of polygon) {
			const simplified = simplifyRing(ring, 0.6);
			if (simplified.length < 4) continue;
			const flat: number[] = [];
			for (const [x, y] of simplified) flat.push(x * cell, y * cell);
			rings.push(flat);
		}
	}
	return rings;
}

/** Simplify a closed ring by splitting it at its middle point and simplifying both halves. */
function simplifyRing(ring: number[][], epsilon: number): number[][] {
	const open = ring.slice(0, -1);
	if (open.length < 6) return open;
	const mid = Math.floor(open.length / 2);
	const first = simplify(open.slice(0, mid + 1), epsilon);
	const second = simplify(open.slice(mid).concat([open[0]]), epsilon);
	return first.concat(second.slice(1, -1));
}

/** Ramer-Douglas-Peucker line simplification. */
function simplify(points: number[][], epsilon: number): number[][] {
	if (points.length < 3) return points;
	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	const stack: [number, number][] = [[0, points.length - 1]];
	while (stack.length > 0) {
		const [s, e] = stack.pop()!;
		const [ax, ay] = points[s];
		const [bx, by] = points[e];
		const len = Math.hypot(bx - ax, by - ay) || 1;
		let maxD = 0;
		let idx = -1;
		for (let i = s + 1; i < e; i++) {
			const [px, py] = points[i];
			const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
			if (d > maxD) {
				maxD = d;
				idx = i;
			}
		}
		if (idx >= 0 && maxD > epsilon) {
			keep[idx] = 1;
			stack.push([s, idx], [idx, e]);
		}
	}
	return points.filter((_, i) => keep[i] === 1);
}

export interface Site {
	x: number;
	y: number;
	component: number;
}

/** Interior land points at least `clearance` from the sea, on a coarse lattice. */
export function interiorSites(world: World, clearance: number, step = 4): Site[] {
	const out: Site[] = [];
	for (let r = 0; r < world.rows; r += step) {
		for (let c = 0; c < world.cols; c += step) {
			const i = r * world.cols + c;
			if (world.land[i] !== 1 || world.coastDist[i] < clearance) continue;
			out.push({ x: (c + 0.5) * world.cell, y: (r + 0.5) * world.cell, component: world.component[i] });
		}
	}
	return out;
}

export interface Microcosm {
	/** [island city, mainland city by the strait, second mainland city]. */
	sites: [Site, Site, Site];
	/** Bounding box of the three discs. */
	bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Looks for the starting microcosm: an island city facing a mainland city across one strait
 * narrow enough for a ferry, and a second mainland city a road away.
 * `radius` is the city disc radius. Returns null if this world has no such spot.
 */
export function findMicrocosm(world: World, radius: number, maxFerryGap: number): Microcosm | null {
	const clearance = radius * 0.8;
	const sites = interiorSites(world, clearance);
	const byComponent = new Map<number, Site[]>();
	for (const s of sites) {
		const list = byComponent.get(s.component) ?? [];
		list.push(s);
		byComponent.set(s.component, list);
	}
	const minSep = 2 * radius + 120;
	let best: Microcosm | null = null;
	let bestScore = Infinity;
	for (const [islandId, islandSites] of byComponent) {
		for (const a of islandSites) {
			for (const [mainId, mainSites] of byComponent) {
				if (mainId === islandId) continue;
				// A real island: much smaller than the mainland it faces.
				if (world.componentSize[mainId] < world.componentSize[islandId] * 5) continue;
				for (const b of mainSites) {
					const ab = Math.hypot(a.x - b.x, a.y - b.y);
					if (ab < minSep || ab > minSep + maxFerryGap + 200) continue;
					const crossing = waterAlong(world, a.x, a.y, b.x, b.y);
					// A strait you can see on the map, but narrow enough for a ferry.
					if (crossing.water < 120 || crossing.water > maxFerryGap) continue;
					for (const c of mainSites) {
						const bc = Math.hypot(b.x - c.x, b.y - c.y);
						if (bc < minSep || bc > minSep + 600) continue;
						const ac = Math.hypot(a.x - c.x, a.y - c.y);
						if (ac < minSep) continue;
						if (waterAlong(world, b.x, b.y, c.x, c.y).longestGap > world.cell) continue;
						const minX = Math.min(a.x, b.x, c.x) - radius;
						const maxX = Math.max(a.x, b.x, c.x) + radius;
						const minY = Math.min(a.y, b.y, c.y) - radius;
						const maxY = Math.max(a.y, b.y, c.y) + radius;
						const w = maxX - minX;
						const h = maxY - minY;
						if (w > 2600 || h > 1600) continue;
						// Prefer compact, wide-ish layouts that fit a screen.
						const score = Math.max(w / 16, h / 9) + Math.abs(ab + bc + ac) * 0.05;
						if (score < bestScore) {
							bestScore = score;
							best = { sites: [a, b, c], bounds: { minX, minY, maxX, maxY } };
						}
					}
				}
			}
		}
	}
	if (best === null) return null;
	for (const s of best.sites) if (landShareOfDisc(world, s.x, s.y, radius) < 0.85) return null;
	return best;
}
