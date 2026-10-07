import { Agents } from './agents';
import { TICKS_PER_DAY } from './constants';
import { pointAt } from './routes';
import { Rng } from './rng';
import { State, type Region, type Route } from './types';

/** Planes in the air at once, at most. */
export const MAX_PLANES = 128;
/** Seats on each plane. */
export const PLANE_SEATS = 8;
/** Scheduled departures per day in each direction on each air route. */
export const FLIGHTS_PER_DAY = 3;

const scratch = { x: 0, y: 0 };

/**
 * Travel between populations. Road and ferry travellers visibly move along the route; air
 * travellers ride hidden inside a plane. The disease clock keeps running on the way.
 */
export class Transit {
	/** Multiplies every route's trips per day (the Travel slider, a Setup setting). */
	travelScale = 1;
	readonly planeRoute = new Int16Array(MAX_PLANES).fill(-1);
	readonly planeDir = new Int8Array(MAX_PLANES);
	readonly planeS = new Float32Array(MAX_PLANES);
	readonly planeX = new Float32Array(MAX_PLANES);
	readonly planeY = new Float32Array(MAX_PLANES);
	readonly planeLoad = new Int16Array(MAX_PLANES);
	/** Dots sorted by region this tick, for picking travellers. */
	private regionStart: Int32Array;
	private regionItems: Int32Array;
	private regionCursor: Int32Array;

	constructor(capacity: number, regionCount: number) {
		this.regionStart = new Int32Array(regionCount + 1);
		this.regionItems = new Int32Array(capacity);
		this.regionCursor = new Int32Array(regionCount);
	}

	reset(): void {
		this.planeRoute.fill(-1);
		this.planeLoad.fill(0);
	}

	/** Departures: Poisson trips per route per tick, equal both ways so populations stay level. */
	depart(agents: Agents, routes: Route[], regions: Region[], tick: number, rng: Rng): void {
		if (routes.length === 0) return;
		this.indexRegions(agents, regions.length);
		for (let r = 0; r < routes.length; r++) {
			const route = routes[r];
			if (!route.open) continue;
			for (let dir = 1; dir >= -1; dir -= 2) {
				const source = dir > 0 ? route.from : route.to;
				if (route.kind === 'air') {
					const every = Math.max(1, Math.round(TICKS_PER_DAY / FLIGHTS_PER_DAY));
					// Stagger the two directions and different routes.
					if ((tick + r * 7 + (dir > 0 ? 0 : every >> 1)) % every !== 0) continue;
					const mean = (route.tripsPerDay * this.travelScale) / FLIGHTS_PER_DAY;
					this.launchPlane(agents, route, dir, source, Math.min(PLANE_SEATS, rng.poisson(mean)), rng);
				} else {
					const mean = (route.tripsPerDay * this.travelScale) / TICKS_PER_DAY;
					const trips = rng.poisson(mean);
					for (let k = 0; k < trips; k++) {
						const i = this.pickTraveller(agents, source, rng);
						if (i < 0) break;
						agents.region[i] = -1;
						agents.route[i] = route.id;
						agents.routeDir[i] = dir;
						agents.routeS[i] = dir > 0 ? 0 : route.length;
						pointAt(route, agents.routeS[i], scratch);
						agents.x[i] = scratch.x;
						agents.y[i] = scratch.y;
					}
				}
			}
		}
	}

	private launchPlane(
		agents: Agents,
		route: Route,
		dir: number,
		source: number,
		seats: number,
		rng: Rng
	): void {
		let p = -1;
		for (let k = 0; k < MAX_PLANES; k++) {
			if (this.planeRoute[k] < 0) {
				p = k;
				break;
			}
		}
		if (p < 0) return;
		let load = 0;
		for (let k = 0; k < seats; k++) {
			const i = this.pickTraveller(agents, source, rng);
			if (i < 0) break;
			agents.region[i] = -1;
			agents.route[i] = route.id;
			agents.routeDir[i] = dir;
			agents.routeSeg[i] = p;
			load++;
		}
		this.planeRoute[p] = route.id;
		this.planeDir[p] = dir;
		this.planeS[p] = dir > 0 ? 0 : route.length;
		this.planeLoad[p] = load;
		pointAt(route, this.planeS[p], scratch);
		this.planeX[p] = scratch.x;
		this.planeY[p] = scratch.y;
	}

	/** A random dot in the region who can travel: alive, not ill, not isolated. -1 if none found. */
	private pickTraveller(agents: Agents, region: number, rng: Rng): number {
		const start = this.regionStart[region];
		const count = this.regionCursor[region] - start;
		if (count <= 0) return -1;
		for (let tries = 0; tries < 12; tries++) {
			const k = start + rng.int(count);
			const i = this.regionItems[k];
			if (agents.region[i] !== region) continue; // already left this tick
			const s = agents.state[i];
			if (s === State.SYMPTOMATIC || s === State.DECEASED || agents.isolated[i] === 1) continue;
			return i;
		}
		return -1;
	}

	private indexRegions(agents: Agents, regionCount: number): void {
		const { regionStart, regionItems, regionCursor } = this;
		regionStart.fill(0);
		const n = agents.activeCount;
		for (let i = 0; i < n; i++) {
			const r = agents.region[i];
			if (r >= 0) regionStart[r + 1]++;
		}
		for (let r = 0; r < regionCount; r++) regionStart[r + 1] += regionStart[r];
		for (let r = 0; r < regionCount; r++) regionCursor[r] = regionStart[r];
		for (let i = 0; i < n; i++) {
			const r = agents.region[i];
			if (r >= 0) regionItems[regionCursor[r]++] = i;
		}
	}

	/** Move road and ferry travellers and planes; land anyone who has arrived. */
	move(agents: Agents, routes: Route[], regions: Region[], radii: Float32Array, rng: Rng): void {
		if (routes.length === 0) return;
		const n = agents.activeCount;
		for (let i = 0; i < n; i++) {
			const r = agents.route[i];
			if (r < 0) continue;
			const route = routes[r];
			if (route.kind === 'air') continue;
			const s = agents.state[i];
			// Ill or isolated travellers stop where they are; their clock keeps running.
			if (s === State.SYMPTOMATIC || s === State.DECEASED || agents.isolated[i] === 1) continue;
			const speed = route.length / (route.travelDays * TICKS_PER_DAY);
			const dir = agents.routeDir[i];
			const next = agents.routeS[i] + dir * speed;
			if ((dir > 0 && next >= route.length) || (dir < 0 && next <= 0)) {
				this.arrive(agents, i, route, dir > 0 ? route.to : route.from, regions, radii, rng);
				continue;
			}
			agents.routeS[i] = next;
			pointAt(route, next, scratch);
			agents.x[i] = scratch.x;
			agents.y[i] = scratch.y;
		}

		for (let p = 0; p < MAX_PLANES; p++) {
			const r = this.planeRoute[p];
			if (r < 0) continue;
			const route = routes[r];
			const speed = route.length / (route.travelDays * TICKS_PER_DAY);
			const dir = this.planeDir[p];
			const next = this.planeS[p] + dir * speed;
			if ((dir > 0 && next >= route.length) || (dir < 0 && next <= 0)) {
				const dest = dir > 0 ? route.to : route.from;
				if (this.planeLoad[p] > 0) {
					for (let i = 0; i < n; i++) {
						if (agents.route[i] === r && agents.region[i] < 0 && agents.routeSeg[i] === p) {
							this.arrive(agents, i, route, dest, regions, radii, rng);
						}
					}
				}
				this.planeRoute[p] = -1;
				this.planeLoad[p] = 0;
				continue;
			}
			this.planeS[p] = next;
			pointAt(route, next, scratch);
			this.planeX[p] = scratch.x;
			this.planeY[p] = scratch.y;
		}
	}

	/** Place an arriving traveller just inside the destination disc, at the route's end. */
	private arrive(
		agents: Agents,
		i: number,
		route: Route,
		dest: number,
		regions: Region[],
		radii: Float32Array,
		rng: Rng
	): void {
		const reg = regions[dest];
		const end = dest === route.to ? route.points.length - 2 : 0;
		const ex = route.points[end] - reg.cx;
		const ey = route.points[end + 1] - reg.cy;
		const d = Math.hypot(ex, ey) || 1;
		const inside = radii[dest] * 0.9;
		agents.x[i] = reg.cx + (ex / d) * inside;
		agents.y[i] = reg.cy + (ey / d) * inside;
		const h = rng.next() * Math.PI * 2;
		if (agents.state[i] !== State.SYMPTOMATIC && agents.state[i] !== State.DECEASED) {
			agents.vx[i] = Math.cos(h) * agents.speed[i];
			agents.vy[i] = Math.sin(h) * agents.speed[i];
		}
		agents.region[i] = dest;
		agents.route[i] = -1;
		agents.routeSeg[i] = 0;
	}

	/** Travellers currently on the way (for telemetry). */
	travellers(agents: Agents): number {
		let t = 0;
		for (let i = 0; i < agents.activeCount; i++) if (agents.route[i] >= 0) t++;
		return t;
	}
}
