import { CITY_DENSITY, DEFAULT_PEOPLE_PER_DOT, WORLD_HEIGHT, WORLD_WIDTH } from '../sim/constants';
import { START_MAPS } from './startMaps.generated';
import type { Region, Scenario, Sourced } from '../sim/types';
import { defaultPolicy } from './healthPolicy';

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
		policy: defaultPolicy(),
		...overrides
	};
}

export function singleCity(overrides: Partial<Region> = {}): Scenario {
	return { mapSeed: null, regions: [city(overrides)] };
}

/** Radius of a default city's disc, used to find room for the microcosm on a map. */
export const MICROCOSM_CITY_RADIUS = Math.sqrt(
	city().population / DEFAULT_PEOPLE_PER_DOT / (CITY_DENSITY * Math.PI)
);

const MOCKUP_COVERAGE =
	"Chosen to show high, medium and low coverage side by side (Alex's mockup), not real figures; real coverage comes with country data in step 4.";
const coverage = (value: number): Sourced => ({ value, sources: [], provisional: MOCKUP_COVERAGE });

/** Starting vaccination levels of the 3 microcosm cities: high, medium and low. */
export const MICROCOSM_COVERAGE = {
	islandFull: coverage(0.85),
	islandPartial: coverage(0.1),
	harbourFull: coverage(0.45),
	harbourPartial: coverage(0.25),
	riverFull: coverage(0.12),
	riverPartial: coverage(0.05)
};
const C = MICROCOSM_COVERAGE;

/** The microcosm's three cities, placed at `sites` (island, port, inland). */
function microcosmCities(sites: readonly { x: number; y: number }[]): Region[] {
	const [island, port, inland] = sites;
	return [
		city({
			id: 0,
			name: 'Island City',
			cx: island.x,
			cy: island.y,
			vaccinatedFull: C.islandFull.value,
			vaccinatedPartial: C.islandPartial.value
		}),
		city({
			id: 1,
			name: 'Harbour City',
			cx: port.x,
			cy: port.y,
			vaccinatedFull: C.harbourFull.value,
			vaccinatedPartial: C.harbourPartial.value
		}),
		city({
			id: 2,
			name: 'River City',
			cx: inland.x,
			cy: inland.y,
			vaccinatedFull: C.riverFull.value,
			vaccinatedPartial: C.riverPartial.value
		})
	];
}

/**
 * The starting microcosm on a curated map: an island city across a strait from two mainland
 * cities, with high, medium and low vaccination.
 */
export function microcosm(index = 0): Scenario {
	const map = START_MAPS[index % START_MAPS.length];
	return { mapSeed: map.seed, regions: microcosmCities(map.sites) };
}

/** Three cities side by side with no map (so no travel), for tests. */
export function threeCities(): Scenario {
	const cy = WORLD_HEIGHT / 2;
	return {
		mapSeed: null,
		regions: microcosmCities([
			{ x: 1500, y: cy - 350 },
			{ x: 1700, y: cy + 350 },
			{ x: 3100, y: cy }
		])
	};
}
