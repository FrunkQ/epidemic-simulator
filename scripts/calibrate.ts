/**
 * Finds, for each disease, the per-tick spread chance (beta) at which the simulation's
 * measured R0 matches the research R0. Run with `npm run calibrate`.
 *
 * Method: a fully unvaccinated default city; bring in a few index cases, one person each in
 * different dots; newly infected people are set aside (they do not spread), so we count exactly
 * how many people each index case infects over its whole illness (R0 per person). Seeds are added until the standard error is under 2% of the target,
 * then a binary search on beta runs with that same set of seeds.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DISEASES } from '../src/lib/config/diseases';
import { CALIBRATION } from '../src/lib/config/diseases.generated';
import { singleCity } from '../src/lib/config/scenarios';
import { toRuntime } from '../src/lib/sim/disease';
import { createSimulation } from '../src/lib/sim/engine';
import type { DiseaseCalibration, DiseaseId } from '../src/lib/sim/types';

/** Target precision: standard error below this share of the target R0. */
export const MAX_RELATIVE_SE = 0.02;
/** Aim for about this many secondary cases per run, so runs stay comparable across diseases. */
const SECONDARIES_PER_RUN = 60;
const SEED_BATCH = 10;
const MAX_SEEDS = 2000;
const MAX_BETA = 0.9;
/** Calibration uses seeds from here up; the check in tests uses a separate range. */
export const CALIBRATION_SEED_BASE = 1000;

export interface R0Measurement {
	r0: number;
	se: number;
	seeds: number;
	indexCases: number;
}

export function indexPerRun(id: DiseaseId): number {
	return Math.max(4, Math.round(SECONDARIES_PER_RUN / DISEASES[id].r0.value));
}

/** Mean secondary cases per index case over `seeds` runs, with its standard error. */
export function measureR0(
	id: DiseaseId,
	beta: number,
	radius: number,
	seeds: number,
	seedBase = CALIBRATION_SEED_BASE
): R0Measurement {
	const disease = toRuntime(DISEASES[id], {
		beta,
		transmissionRadius: radius,
		measuredR0: 0,
		standardError: 0,
		seeds: 0,
		indexCases: 0
	});
	const perRun = indexPerRun(id);
	let sum = 0;
	let sumSq = 0;
	let n = 0;
	for (let seed = 1; seed <= seeds; seed++) {
		const sim = createSimulation(singleCity(), {
			seed: seedBase + seed,
			diseaseId: id,
			disease,
			secondaryOnly: true
		});
		const cases = sim.seedNow(0, perRun);
		sim.step(disease.silentTicks + disease.illTicks + 2);
		// Each index case is the only infectious person in its dot, so its dot's count is its own.
		const secondaries = sim.people.secondaries!;
		for (const c of cases) {
			const k = secondaries[c];
			sum += k;
			sumSq += k * k;
			n++;
		}
	}
	const mean = sum / n;
	const variance = n > 1 ? (sumSq - n * mean * mean) / (n - 1) : 0;
	return { r0: mean, se: Math.sqrt(variance / n), seeds, indexCases: n };
}

function findRadius(id: DiseaseId, target: number): number {
	let radius = 8;
	while (measureR0(id, MAX_BETA, radius, SEED_BATCH).r0 < target * 1.05) radius *= 1.2;
	return radius;
}

function search(id: DiseaseId, target: number, radius: number, seeds: number): number {
	let lo = Math.log(1e-5);
	let hi = Math.log(MAX_BETA);
	for (let k = 0; k < 20; k++) {
		const mid = (lo + hi) / 2;
		if (measureR0(id, Math.exp(mid), radius, seeds).r0 < target) lo = mid;
		else hi = mid;
	}
	return Math.exp((lo + hi) / 2);
}

export function calibrate(id: DiseaseId): DiseaseCalibration {
	const target = DISEASES[id].r0.value;
	const radius = findRadius(id, target);
	// Rough beta, then grow the seed set until it is precise enough, then search again on it.
	let seeds = SEED_BATCH;
	let beta = search(id, target, radius, seeds);
	let m = measureR0(id, beta, radius, seeds);
	while (m.se >= MAX_RELATIVE_SE * target && seeds < MAX_SEEDS) {
		const need = Math.ceil(seeds * (m.se / (MAX_RELATIVE_SE * target * 0.9)) ** 2);
		seeds = Math.min(MAX_SEEDS, Math.max(seeds + SEED_BATCH, Math.ceil(need / SEED_BATCH) * SEED_BATCH));
		m = measureR0(id, beta, radius, seeds);
	}
	beta = search(id, target, radius, seeds);
	m = measureR0(id, beta, radius, seeds);
	const round = (v: number, d: number) => Number(v.toPrecision(d));
	console.log(
		`${id}: target R0 ${target}, beta ${beta.toPrecision(4)}, radius ${radius.toFixed(2)}, ` +
			`measured ${m.r0.toFixed(3)} ± ${m.se.toFixed(3)} (${m.seeds} seeds, ${m.indexCases} index cases)`
	);
	return {
		beta: round(beta, 4),
		transmissionRadius: round(radius, 4),
		measuredR0: round(m.r0, 4),
		standardError: round(m.se, 3),
		seeds: m.seeds,
		indexCases: m.indexCases
	};
}

/** Write diseases.generated.ts with these calibrations. */
export function writeCalibration(out: Record<string, DiseaseCalibration>): string {
	const all = (Object.keys(DISEASES) as DiseaseId[]).filter((id) => out[id]);
	const header = all
		.map(
			(id) =>
				`//   ${id}: target R0 ${Number(DISEASES[id].r0.value.toPrecision(4))}, measured ${out[id].measuredR0} ± ${out[id].standardError} ` +
				`over ${out[id].seeds} seeds, ${out[id].indexCases} index cases`
		)
		.join('\n');
	const body = all
		.map(
			(id) =>
				`\t${id}: ${JSON.stringify(out[id])
					.replace(/"(\w+)":/g, '$1: ')
					.replace(/,/g, ', ')
					.replace(/^\{/, '{\n\t\t')
					.replace(/, /g, ',\n\t\t')
					.replace(/\}$/, '\n\t}')}`
		)
		.join(',\n');
	const file = fileURLToPath(new URL('../src/lib/config/diseases.generated.ts', import.meta.url));
	writeFileSync(
		file,
		`// Written by scripts/calibrate.ts. Do not edit by hand; rerun \`npm run calibrate\`.\n` +
			`// Seeds start at ${CALIBRATION_SEED_BASE + 1}; each seed runs ${'`indexPerRun`'} index cases.\n${header}\n` +
			`import type { DiseaseCalibration, DiseaseId } from '../sim/types';\n\n` +
			`export const CALIBRATION: Record<DiseaseId, DiseaseCalibration> = {\n${body}\n};\n`
	);
	return file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	// Optional disease ids on the command line limit the run to those; others keep their values.
	const only = process.argv.slice(2) as DiseaseId[];
	const ids = (Object.keys(DISEASES) as DiseaseId[]).filter((id) => only.length === 0 || only.includes(id));
	const out: Record<string, DiseaseCalibration> = { ...CALIBRATION };
	for (const id of ids) out[id] = calibrate(id);
	console.log(`wrote ${writeCalibration(out)}`);
}
