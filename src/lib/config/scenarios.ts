import { CITY_DENSITY, DEFAULT_PEOPLE_PER_DOT, WORLD_HEIGHT, WORLD_WIDTH } from '../sim/constants';
import { START_MAPS } from './startMaps.generated';
import type { Region, Scenario } from '../sim/types';
import { BEHAVIOUR } from './behaviour';

/** A default city, used by the calibration and by tests. */
export function city(overrides: Partial<Region> = {}): Region {
	return {
		id: 0,
		name: 'City',
		kind: 'city',
		cx: WORLD_WIDTH / 2,
		cy: WORLD_HEIGHT / 2,
		population: 150_000,
		density: CITY_DENSITY,
		hasAirport: true,
		vaccinatedFull: 0,
		vaccinatedPartial: 0,
		hospitalBedsPerThousand: BEHAVIOUR.hospitalBedsPerThousand.value,
		...overrides
	};
}

export function singleCity(overrides: Partial<Region> = {}): Scenario {
	return { mapSeed: 1, regions: [city(overrides)] };
}

/** Radius of a default city's disc, used to find room for the microcosm on a map. */
export const MICROCOSM_CITY_RADIUS = Math.sqrt(150_000 / DEFAULT_PEOPLE_PER_DOT / (CITY_DENSITY * Math.PI));

/**
 * The starting microcosm on a curated map: an island city across a strait from two mainland
 * cities, with the vaccination levels from the mockup (high, medium, low).
 */
export function microcosm(index = 0): Scenario {
	const map = START_MAPS[index % START_MAPS.length];
	const [island, port, inland] = map.sites;
	return {
		mapSeed: map.seed,
		regions: [
			city({
				id: 0,
				name: 'Island City',
				cx: island.x,
				cy: island.y,
				vaccinatedFull: 0.85,
				vaccinatedPartial: 0.1
			}),
			city({
				id: 1,
				name: 'Harbour City',
				cx: port.x,
				cy: port.y,
				vaccinatedFull: 0.45,
				vaccinatedPartial: 0.25
			}),
			city({
				id: 2,
				name: 'River City',
				cx: inland.x,
				cy: inland.y,
				vaccinatedFull: 0.12,
				vaccinatedPartial: 0.05
			})
		]
	};
}

/** Three cities side by side with no map (so no travel), for tests. */
export function threeCities(): Scenario {
	const cy = WORLD_HEIGHT / 2;
	return {
		mapSeed: 1,
		regions: [
			city({
				id: 0,
				name: 'Island City',
				cx: 1500,
				cy: cy - 350,
				vaccinatedFull: 0.85,
				vaccinatedPartial: 0.1
			}),
			city({
				id: 1,
				name: 'Harbour City',
				cx: 1700,
				cy: cy + 350,
				vaccinatedFull: 0.45,
				vaccinatedPartial: 0.25
			}),
			city({ id: 2, name: 'River City', cx: 3100, cy, vaccinatedFull: 0.12, vaccinatedPartial: 0.05 })
		]
	};
}
