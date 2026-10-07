import { describe, expect, it } from 'vitest';
import { Agents } from '../../src/lib/sim/agents';
import { SpatialGrid } from '../../src/lib/sim/grid';
import { Rng } from '../../src/lib/sim/rng';

describe('spatial grid', () => {
	it('finds exactly the same neighbours as checking every pair', () => {
		const rng = new Rng(7);
		const a = new Agents(800);
		a.reset();
		for (let i = 0; i < 800; i++) {
			a.x[i] = rng.range(100, 400);
			a.y[i] = rng.range(100, 400);
			a.region[i] = 0;
		}
		a.activeCount = 800;
		const radius = 9;
		const grid = new SpatialGrid(500, 500, radius, a.capacity);
		grid.rebuild(a);
		for (let i = 0; i < 800; i += 37) {
			const brute = new Set<number>();
			for (let j = 0; j < 800; j++) {
				if (j !== i && (a.x[i] - a.x[j]) ** 2 + (a.y[i] - a.y[j]) ** 2 <= radius * radius) brute.add(j);
			}
			const found = new Set<number>();
			const cx = Math.floor(a.x[i] / radius);
			const cy = Math.floor(a.y[i] / radius);
			for (let gy = cy - 1; gy <= cy + 1; gy++) {
				for (let gx = cx - 1; gx <= cx + 1; gx++) {
					const c = gy * grid.cols + gx;
					for (let k = grid.cellStart[c]; k < grid.cellStart[c + 1]; k++) {
						const j = grid.cellItems[k];
						if (j !== i && (a.x[i] - a.x[j]) ** 2 + (a.y[i] - a.y[j]) ** 2 <= radius * radius) found.add(j);
					}
				}
			}
			expect([...found].sort()).toEqual([...brute].sort());
		}
	});
});
