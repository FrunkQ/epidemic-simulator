import { CITY_DENSITY, WORLD_HEIGHT, WORLD_WIDTH } from '../sim/constants';
import type { Region, Scenario } from '../sim/types';

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
		hospitalCapacity: 60,
		...overrides
	};
}

export function singleCity(overrides: Partial<Region> = {}): Scenario {
	return { mapSeed: 1, regions: [city(overrides)] };
}

/**
 * Stand-in for the 3-city start until the generated map arrives in step 2:
 * three cities with the vaccination levels from the mockup.
 */
export function threeCities(): Scenario {
	const cy = WORLD_HEIGHT / 2;
	return {
		mapSeed: 1,
		regions: [
			city({
				id: 0,
				name: 'Metropolis',
				cx: 1500,
				cy: cy - 350,
				vaccinatedFull: 0.85,
				vaccinatedPartial: 0.1
			}),
			city({
				id: 1,
				name: 'Coastal Hub',
				cx: 1700,
				cy: cy + 350,
				vaccinatedFull: 0.45,
				vaccinatedPartial: 0.25
			}),
			city({ id: 2, name: 'Outside Valley', cx: 3100, cy, vaccinatedFull: 0.12, vaccinatedPartial: 0.05 })
		]
	};
}
