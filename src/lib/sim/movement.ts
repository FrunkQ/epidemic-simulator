import { Agents, LONG_AGO } from './agents';
import { WANDER_EVERY, WANDER_TURN } from './constants';
import { Rng } from './rng';
import type { Region } from './types';

/** Radius from population (in dots) and density (dots per square world unit). */
export function regionRadius(dots: number, density: number): number {
	return Math.sqrt(dots / (density * Math.PI));
}

/**
 * Wandering inside each population's disc. Dots turn a little now and then and bounce off
 * the edge. Red (with any disease), isolated, dead and lockdown-held dots stay put. A fresh arrival
 * a lockdown would keep home walks straight to its spot (lockdown.ts), then stops there.
 */
export function moveInRegions(
	agents: Agents,
	regions: Region[],
	radii: Float32Array,
	tick: number,
	rng: Rng,
	illStopsMovement: boolean
): void {
	const { x, y, vx, vy, ill, dead, region, isolated, held } = agents;
	const n = agents.activeCount;
	for (let i = 0; i < n; i++) {
		const r = region[i];
		if (r < 0) continue;
		if (dead[i] === 1 || isolated[i] === 1 || held[i] === 1 || (illStopsMovement && ill[i] === 1)) continue;
		if (agents.walking[i] === 1) {
			const gx = agents.goalX[i] - x[i];
			const gy = agents.goalY[i] - y[i];
			const left = Math.hypot(gx, gy);
			const step = agents.speed[i];
			if (left <= step) {
				x[i] = agents.goalX[i];
				y[i] = agents.goalY[i];
				agents.walking[i] = 0;
				agents.landedTick[i] = LONG_AGO;
			} else {
				x[i] += (gx / left) * step;
				y[i] += (gy / left) * step;
			}
			continue;
		}

		let dx = vx[i];
		let dy = vy[i];
		if ((i + tick) % WANDER_EVERY === 0) {
			const turn = (rng.next() * 2 - 1) * WANDER_TURN;
			const c = Math.cos(turn);
			const sn = Math.sin(turn);
			const nx = dx * c - dy * sn;
			dy = dx * sn + dy * c;
			dx = nx;
		}
		let px = x[i] + dx;
		let py = y[i] + dy;

		const reg = regions[r];
		const ox = px - reg.cx;
		const oy = py - reg.cy;
		const rad = radii[r];
		const d2 = ox * ox + oy * oy;
		if (d2 > rad * rad) {
			// Reflect the velocity off the edge and put the dot back inside.
			const d = Math.sqrt(d2);
			const nx = ox / d;
			const ny = oy / d;
			const dot = dx * nx + dy * ny;
			dx -= 2 * dot * nx;
			dy -= 2 * dot * ny;
			px = reg.cx + nx * rad * 0.999;
			py = reg.cy + ny * rad * 0.999;
		}
		x[i] = px;
		y[i] = py;
		vx[i] = dx;
		vy[i] = dy;
	}
}
