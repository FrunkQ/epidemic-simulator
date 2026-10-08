import { describe, expect, it } from 'vitest';
import { MICROCOSM_CITY_RADIUS, microcosm } from '../../src/lib/config/scenarios';
import { START_MAPS } from '../../src/lib/config/startMaps.generated';
import { MAX_FERRY_GAP } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';
import { findMicrocosm, generateWorld, landShareOfDisc } from '../../src/lib/sim/geography';

describe('lesson 8: map generation', () => {
	it('gives an identical map for the same seed', () => {
		const a = generateWorld(4);
		const b = generateWorld(4);
		expect(Array.from(a.land)).toEqual(Array.from(b.land));
		expect(a.coastlines).toEqual(b.coastlines);
	});

	it('gives a different map for a different seed', () => {
		expect(Array.from(generateWorld(4).land)).not.toEqual(Array.from(generateWorld(5).land));
	});
});

describe('lesson 9: every curated start map holds the microcosm', () => {
	for (const map of START_MAPS) {
		it(`seed ${map.seed}: an island city, one ferry-width strait, two mainland cities a road apart`, () => {
			const world = generateWorld(map.seed);
			// The stored layout is still what the finder produces from this seed.
			const found = findMicrocosm(world, MICROCOSM_CITY_RADIUS, MAX_FERRY_GAP);
			expect(found?.sites.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y) }))).toEqual(map.sites);

			const [island, port, inland] = found!.sites;
			expect(island.component).not.toBe(port.component);
			expect(port.component).toBe(inland.component);
			for (const s of found!.sites)
				expect(landShareOfDisc(world, s.x, s.y, MICROCOSM_CITY_RADIUS)).toBeGreaterThan(0.85);

			const index = START_MAPS.indexOf(map);
			const sim = createSimulation(microcosm(index), { seed: 1, diseaseId: 'measles', world });
			const kinds = sim.routes.map((r) => `${r.kind}:${r.from}-${r.to}`);
			expect(kinds).toContain('ferry:0-1');
			expect(kinds).toContain('road:1-2');
			expect(sim.routes.filter((r) => r.kind === 'air')).toHaveLength(3);
			// Nothing but a ferry or a plane reaches the island.
			expect(sim.routes.some((r) => r.kind === 'road' && (r.from === 0 || r.to === 0))).toBe(false);
		});
	}
});
