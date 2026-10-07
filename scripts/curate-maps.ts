/**
 * Finds the 3-city starting microcosm on each curated map seed and writes their positions to
 * src/lib/config/startMaps.generated.ts. Run with `npm run curate-maps` after changing the
 * map generator. Seeds were picked by eye from the ones that pass (see the test).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MICROCOSM_CITY_RADIUS } from '../src/lib/config/scenarios';
import { MAX_FERRY_GAP } from '../src/lib/sim/constants';
import { findMicrocosm, generateWorld } from '../src/lib/sim/geography';

export const CURATED_SEEDS = [4, 5, 7, 3, 10];

const maps = CURATED_SEEDS.map((seed) => {
	const m = findMicrocosm(generateWorld(seed), MICROCOSM_CITY_RADIUS, MAX_FERRY_GAP);
	if (!m) throw new Error(`seed ${seed} has no microcosm`);
	const round = (v: number) => Math.round(v);
	return { seed, sites: m.sites.map((s) => ({ x: round(s.x), y: round(s.y) })) };
});

const file = fileURLToPath(new URL('../src/lib/config/startMaps.generated.ts', import.meta.url));
writeFileSync(
	file,
	`// Written by scripts/curate-maps.ts. Do not edit by hand; rerun \`npm run curate-maps\`.\n` +
		`/** Curated start maps: [island city, mainland city by the strait, second mainland city]. */\n` +
		`export const START_MAPS: { seed: number; sites: { x: number; y: number }[] }[] = ${JSON.stringify(maps, null, '\t')};\n`
);
console.log(`wrote ${maps.length} start maps to ${file}`);
