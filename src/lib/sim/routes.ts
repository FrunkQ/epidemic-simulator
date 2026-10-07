import { MAX_FERRY_GAP } from './constants';
import { waterAlong, type World } from './geography';
import type { Region, Route, RouteKind } from './types';

/** Travel time per route kind, in days (see docs/ARCHITECTURE.md section 2). */
export const TRAVEL_DAYS: Record<RouteKind, number> = { air: 0.7, ferry: 16, road: 14 };
/** Trips per day each way at the default travel setting. */
export const TRIPS_PER_DAY: Record<RouteKind, number> = { air: 6, ferry: 1.5, road: 2 };

/**
 * Builds the travel links between populations:
 * - ground: each population to its 2 nearest neighbours; a road if the straight line stays on
 *   land, a ferry if it crosses no more than MAX_FERRY_GAP of water, otherwise nothing;
 * - air: between every pair of populations with airports.
 * `radii` are the population disc radii; routes run from disc edge to disc edge.
 */
export function generateRoutes(world: World, regions: Region[], radii: ArrayLike<number>): Route[] {
	const routes: Route[] = [];
	const seen = new Set<string>();
	const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

	for (let i = 0; i < regions.length; i++) {
		const near = regions
			.map((r, j) => ({ j, d: Math.hypot(r.cx - regions[i].cx, r.cy - regions[i].cy) }))
			.filter((n) => n.j !== i)
			.sort((a, b) => a.d - b.d || a.j - b.j)
			.slice(0, 2);
		for (const { j } of near) {
			const k = key(i, j);
			if (seen.has(k)) continue;
			const a = regions[i];
			const b = regions[j];
			const crossing = waterAlong(world, a.cx, a.cy, b.cx, b.cy);
			const kind: RouteKind | null =
				crossing.water === 0 || crossing.longestGap <= world.cell
					? 'road'
					: crossing.water <= MAX_FERRY_GAP
						? 'ferry'
						: null;
			if (kind === null) continue;
			seen.add(k);
			const lo = Math.min(i, j);
			const hi = Math.max(i, j);
			routes.push(makeRoute(routes.length, kind, lo, hi, regions, radii));
		}
	}

	for (let i = 0; i < regions.length; i++) {
		for (let j = i + 1; j < regions.length; j++) {
			if (regions[i].hasAirport && regions[j].hasAirport) {
				routes.push(makeRoute(routes.length, 'air', i, j, regions, radii));
			}
		}
	}
	return routes;
}

function makeRoute(
	id: number,
	kind: RouteKind,
	from: number,
	to: number,
	regions: Region[],
	radii: ArrayLike<number>
): Route {
	const a = regions[from];
	const b = regions[to];
	const dx = b.cx - a.cx;
	const dy = b.cy - a.cy;
	const d = Math.hypot(dx, dy) || 1;
	const ux = dx / d;
	const uy = dy / d;
	const sx = a.cx + ux * radii[from];
	const sy = a.cy + uy * radii[from];
	const ex = b.cx - ux * radii[to];
	const ey = b.cy - uy * radii[to];
	const points: number[] = [];
	if (kind === 'ferry') {
		points.push(sx, sy, ex, ey);
	} else {
		// Roads wind gently; flights arc. Both bow to the same side for a given pair.
		const len = Math.hypot(ex - sx, ey - sy);
		const bow = kind === 'air' ? len * 0.18 : len * 0.06;
		const steps = kind === 'air' ? 24 : 16;
		for (let k = 0; k <= steps; k++) {
			const t = k / steps;
			const wiggle = kind === 'road' ? Math.sin(t * Math.PI * 3) * 0.5 : 0;
			const off = (Math.sin(t * Math.PI) + wiggle * Math.sin(t * Math.PI)) * bow;
			points.push(sx + (ex - sx) * t - uy * off, sy + (ey - sy) * t + ux * off);
		}
	}
	const cumulative = [0];
	for (let k = 2; k < points.length; k += 2) {
		cumulative.push(
			cumulative[cumulative.length - 1] + Math.hypot(points[k] - points[k - 2], points[k + 1] - points[k - 1])
		);
	}
	return {
		id,
		kind,
		from,
		to,
		points,
		cumulative,
		length: cumulative[cumulative.length - 1],
		travelDays: TRAVEL_DAYS[kind],
		tripsPerDay: TRIPS_PER_DAY[kind],
		open: true
	};
}

/** Position at distance `s` along a route, written into `out` (no allocation). */
export function pointAt(route: Route, s: number, out: { x: number; y: number }): void {
	const { points, cumulative } = route;
	if (s <= 0) {
		out.x = points[0];
		out.y = points[1];
		return;
	}
	const n = cumulative.length;
	if (s >= route.length) {
		out.x = points[2 * (n - 1)];
		out.y = points[2 * (n - 1) + 1];
		return;
	}
	let lo = 0;
	let hi = n - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (cumulative[mid] <= s) lo = mid;
		else hi = mid;
	}
	const t = (s - cumulative[lo]) / (cumulative[hi] - cumulative[lo] || 1);
	out.x = points[2 * lo] + (points[2 * hi] - points[2 * lo]) * t;
	out.y = points[2 * lo + 1] + (points[2 * hi + 1] - points[2 * lo + 1]) * t;
}
