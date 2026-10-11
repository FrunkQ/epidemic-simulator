import { describe, expect, it } from 'vitest';
import { Camera } from '../../src/lib/sim/camera';

describe('camera', () => {
	it('frames a world rectangle inside the margins', () => {
		const c = new Camera();
		c.fit(0, 0, 100, 100, 300, 200, 50);
		expect(c.scale).toBeCloseTo(1, 10);
		expect(c.worldToScreen(0, 0)).toEqual({ x: 100, y: 50 });
	});

	it('keeps its view when the stage has no room inside the margins (a stage not laid out yet)', () => {
		const c = new Camera();
		c.fit(0, 0, 100, 100, 300, 200, 50);
		const before = { scale: c.scale, x: c.x, y: c.y };
		for (const [w, h] of [
			[0, 0],
			[0, 844],
			[80, 600],
			[300, 60]
		]) {
			c.fit(0, 0, 100, 100, w, h, 40);
			expect({ scale: c.scale, x: c.x, y: c.y }, `${w}x${h}`).toEqual(before);
		}
	});
});
