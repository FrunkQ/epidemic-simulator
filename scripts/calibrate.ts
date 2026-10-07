/**
 * Finds, for each disease, the per-tick spread chance (beta) at which the simulation's
 * measured R0 matches the research R0. Run with `npm run calibrate`.
 *
 * Method: a fully unvaccinated default city; seed a few index cases; newly infected dots are
 * set aside (they do not spread), so we count exactly how many people each index case infects
 * over its whole illness. Binary search on beta with the same seeds each time.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DISEASES } from '../src/lib/config/diseases';
import { CALIBRATION } from '../src/lib/config/diseases.generated';
import { singleCity } from '../src/lib/config/scenarios';
import { toRuntime } from '../src/lib/sim/disease';
import { createSimulation } from '../src/lib/sim/engine';
import type { DiseaseCalibration, DiseaseId } from '../src/lib/sim/types';

const SEEDS = Number(process.env.CAL_SEEDS ?? 30);
const INDEX_PER_RUN = 4;
const MAX_BETA = 0.9;

export function measureR0(id: DiseaseId, beta: number, radius: number, seeds = SEEDS): number {
	const disease = toRuntime(DISEASES[id], { beta, transmissionRadius: radius, measuredR0: 0 });
	let secondaries = 0;
	let index = 0;
	for (let seed = 1; seed <= seeds; seed++) {
		const sim = createSimulation(singleCity(), { seed: 1000 + seed, disease, secondaryOnly: true });
		const cases = sim.seedNow(0, INDEX_PER_RUN);
		sim.step(disease.silentTicks + disease.illTicks + 2);
		const a = sim.agents;
		const isIndex = new Set(cases);
		for (let i = 0; i < a.activeCount; i++) if (isIndex.has(a.infectedBy[i])) secondaries++;
		index += cases.length;
	}
	return secondaries / index;
}

function calibrate(id: DiseaseId): DiseaseCalibration {
	const target = DISEASES[id].r0.value;
	let radius = 8;
	while (measureR0(id, MAX_BETA, radius) < target * 1.05) radius *= 1.2;
	let lo = Math.log(1e-5);
	let hi = Math.log(MAX_BETA);
	for (let k = 0; k < 18; k++) {
		const mid = (lo + hi) / 2;
		if (measureR0(id, Math.exp(mid), radius) < target) lo = mid;
		else hi = mid;
	}
	const beta = Math.exp((lo + hi) / 2);
	const measuredR0 = measureR0(id, beta, radius, SEEDS * 2);
	const round = (v: number, d: number) => Number(v.toPrecision(d));
	console.log(
		`${id}: target R0 ${target}, beta ${beta.toPrecision(4)}, radius ${radius.toFixed(2)}, measured ${measuredR0.toFixed(2)}`
	);
	return { beta: round(beta, 4), transmissionRadius: round(radius, 4), measuredR0: round(measuredR0, 3) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const only = process.argv[2] as DiseaseId | undefined;
	const ids = (Object.keys(DISEASES) as DiseaseId[]).filter((id) => !only || id === only);
	const out: Record<string, DiseaseCalibration> = { ...CALIBRATION };
	for (const id of ids) out[id] = calibrate(id);
	const body = (Object.keys(out) as DiseaseId[])
		.map(
			(id) =>
				`\t${id}: ${JSON.stringify(out[id])
					.replace(/"(\w+)":/g, '$1: ')
					.replace(/,/g, ', ')
					.replace(/^\{/, '{ ')
					.replace(/\}$/, ' }')}`
		)
		.join(',\n');
	{
		const file = fileURLToPath(new URL('../src/lib/config/diseases.generated.ts', import.meta.url));
		writeFileSync(
			file,
			`// Written by scripts/calibrate.ts. Do not edit by hand; rerun \`npm run calibrate\`.\nimport type { DiseaseCalibration, DiseaseId } from '../sim/types';\n\nexport const CALIBRATION: Record<DiseaseId, DiseaseCalibration> = {\n${body}\n};\n`
		);
		console.log(`wrote ${file}`);
	}
}
