import { Agents } from './agents';
import { People, type PeopleHooks } from './people';
import { TICKS_PER_DAY } from './constants';
import { SpatialGrid } from './grid';
import { Rng } from './rng';
import { breakthroughSevereProtection, defaultVaccine, vaccineKey } from '../config/vaccines';
import { perSymptomaticBands } from '../config/diseases';
import { originOf } from './transit';
import {
	type Bands,
	type DiseaseCalibration,
	type DiseaseConfig,
	type DiseaseRuntime,
	type Route,
	type Vaccine,
	type VaccineRuntime
} from './types';

/** Mean ticks of an exponential whose half-life is `halfLifeDays`; 0 when it never fades. */
function halfLifeTicks(halfLifeDays: number | null): number {
	return halfLifeDays === null ? 0 : Math.max(1, Math.round((halfLifeDays / Math.LN2) * TICKS_PER_DAY));
}

/** Severe protection for a breakthrough case; none when the source gives no severe figure. */
function breakthrough(infection: number, severe: number | undefined): number {
	if (severe === undefined) return 0;
	// A vaccine that always stops infection has no breakthrough cases to protect.
	if (infection >= 1) return 1;
	return breakthroughSevereProtection(infection, severe);
}

/**
 * A full course's protection against severe illness, as published. With no figure of its own it
 * takes the larger of its infection figure (no extra protection for breakthroughs) and the
 * unfinished course's sourced figure, because a full course includes the unfinished one (6.2).
 */
export function fullCourseSevere(v: Vaccine): number | undefined {
	if (v.full.severe) return v.full.severe.value;
	const partial = v.partial?.severe?.value;
	return partial === undefined ? undefined : Math.max(v.full.infection.value, partial);
}

/**
 * One vaccine for the engine. "Partly vaccinated" means an unfinished course of this vaccine; a
 * version with none has nobody partly vaccinated (6.13).
 */
function toVaccineRuntime(v: Vaccine): VaccineRuntime {
	const fullInfection = v.full.infection.value;
	const partial = v.partial;
	const partialInfection = partial?.infection?.value ?? 0;
	return {
		key: vaccineKey(v),
		exists: true,
		fullInfection,
		fullSevere: breakthrough(fullInfection, fullCourseSevere(v)),
		hasPartialCourse: partial !== undefined,
		partialInfection,
		partialInfectionSourced: partial?.infection !== undefined,
		// No sourced figure means no severe protection, for either course (6.2).
		partialSevere: partial?.severe ? breakthrough(partialInfection, partial.severe.value) : 0,
		waningMeanTicks: halfLifeTicks(v.waningDays.value)
	};
}

/** A disease with no vaccine: nobody is vaccinated against it (6.13). */
const NO_VACCINE: VaccineRuntime = {
	key: 'none',
	exists: false,
	fullInfection: 0,
	fullSevere: 0,
	hasPartialCourse: false,
	partialInfection: 0,
	partialInfectionSourced: false,
	partialSevere: 0,
	waningMeanTicks: 0
};

function bands(config: DiseaseConfig, banded: DiseaseConfig['mortalityByAge'], allAges: number): Bands {
	return banded ? perSymptomaticBands(banded, config.asymptomaticFraction) : [allAges, allAges, allAges];
}

/** Convert a disease from config (days) to engine units (ticks), once, at load. */
export function toRuntime(config: DiseaseConfig, calibration: DiseaseCalibration): DiseaseRuntime {
	const days = (d: number) => Math.max(1, Math.round(d * TICKS_PER_DAY));
	const def = defaultVaccine(config.vaccines);
	const others = (config.vaccines ?? []).filter((v) => v !== def);
	const after = config.afterInfection;
	return {
		id: config.id,
		r0: config.r0.value,
		// Zero is allowed here: some diseases are not contagious before symptoms (see infect).
		silentTicks: Math.max(0, Math.round(config.silentDays.value * TICKS_PER_DAY)),
		latentTicks: Math.max(0, Math.round((config.latentDays?.value ?? 0) * TICKS_PER_DAY)),
		illTicks: days(config.illDays.value),
		asymptomaticFraction: config.asymptomaticFraction.value,
		mortality: config.mortality.value,
		mortalityByBand: bands(config, config.mortalityByAge, config.mortality.value),
		strainApplies: config.mortalityBasis === 'modern-care',
		hospitalisedShare: config.hospitalisedShare.value,
		hospitalByBand: bands(config, config.hospitalisedByAge, config.hospitalisedShare.value),
		waningMeanTicks: halfLifeTicks(config.waningDays.value),
		afterInfectionSevere: after ? breakthrough(after.infection.value, after.severe.value) : 0,
		vaccines: def ? [def, ...others].map(toVaccineRuntime) : [{ ...NO_VACCINE }],
		beta: calibration.beta,
		transmissionRadius: calibration.transmissionRadius
	};
}

/**
 * Overall protection against serious illness compared with someone unvaccinated: either kept from
 * catching it, or caught it and protected against serious illness (6.2).
 */
export function overallSevere(infection: number, breakthrough: number): number {
	return 1 - (1 - infection) * (1 - breakthrough);
}

/**
 * Share of a population spawned with no vaccine: everyone without a full course, and also those
 * set as partly vaccinated when the chosen version has no unfinished course (6.13).
 */
export function unvaccinatedShare(full: number, partial: number, vaccine: VaccineRuntime): number {
	if (!vaccine.exists) return 1;
	return Math.max(0, 1 - full - (vaccine.hasPartialCourse ? partial : 0));
}

/** The vaccine a population is given: its pick when the disease offers it, else the default. */
export function vaccineFor(disease: DiseaseRuntime, key: string | undefined): VaccineRuntime {
	return disease.vaccines.find((v) => v.key === key) ?? disease.vaccines[0];
}

/** Subsystem switches the illness rules read (6.14). */
export interface IllnessRules {
	deaths: boolean;
	hospital: boolean;
	ageBands: boolean;
	illStopsMovement: boolean;
}

/** Deaths per symptomatic case in a dot's age band, cut by protection against severe illness `severe`. */
export function deathChanceOf(
	disease: DiseaseRuntime,
	band: number,
	severe: number,
	rules: IllnessRules
): number {
	const d = rules.ageBands ? disease.mortalityByBand[band] : disease.mortality;
	return d * (1 - severe);
}

/** Share of symptomatic cases needing a bed in a dot's age band, cut by protection against severe illness. */
export function bedChanceOf(
	disease: DiseaseRuntime,
	band: number,
	severe: number,
	rules: IllnessRules
): number {
	const h = rules.ageBands ? disease.hospitalByBand[band] : disease.hospitalisedShare;
	return h * (1 - severe);
}

/** The region whose hospitals a dot uses: its own, or on a trip, the trip's origin (6.8). */
export function hospitalRegion(agents: Agents, routes: readonly Route[], i: number): number {
	const r = agents.region[i];
	if (r >= 0) return r;
	const route = agents.route[i];
	return route < 0 ? -1 : originOf(routes[route], agents.routeDir[i]);
}

/** s(p, m): strain multiplies the odds of dying, as the sources' odds ratios measure (6.6). */
function strained(p: number, m: number): number {
	return (m * p) / (1 - p + m * p);
}

/**
 * Chance of dying at the end of illness (6.6): h·s(min(d,h)/h, m) + (1-h)·max(0,d-h)/(1-h).
 * The first term is the share of people who had a bed, the second those who didn't (deaths
 * outside hospital, which strain doesn't touch). With m = 1 it is exactly d.
 */
export function deathChanceAtEnd(d: number, h: number, m: number): number {
	const outside = Math.max(0, d - h);
	if (h <= 0) return outside;
	return h * strained(Math.min(d, h) / h, m) + outside;
}

/** Scratch for one transmission pass: the summed log chance of escaping, per dot and disease. */
export class Exposure {
	readonly logEscape: Float64Array;
	readonly touched: Int32Array;
	readonly marked: Uint8Array;
	touchedCount = 0;
	constructor(capacity: number) {
		this.logEscape = new Float64Array(capacity);
		this.touched = new Int32Array(capacity);
		this.marked = new Uint8Array(capacity);
	}
}

/**
 * Spread (4.2 of research/finer-counts.md): every infectious person has the same chance,
 * beta / peoplePerDot, of infecting each catchable person in every other dot within the
 * transmission radius; people in the same dot don't infect each other. So a catchable person in dot
 * i escapes with chance (1 - beta/N)^(infectious people nearby), and each exposed dot takes one
 * binomial draw. One neighbour scan serves every disease (6.12). Travellers neither spread nor
 * catch it. With `silentSpread` off only people with symptoms spread it. In calibration (`people`
 * have `secondaries`), each infectious dot's draws are made in turn and the people it infects are
 * set aside and credited to it, which gives the same chances as the combined draw.
 */
export function transmit(
	agents: Agents,
	grid: SpatialGrid,
	slots: readonly People[],
	exposure: readonly Exposure[],
	tick: number,
	rng: Rng,
	hooks: readonly PeopleHooks[],
	silentSpread: boolean
): void {
	if (slots.length === 1 && !slots[0].secondaries) {
		transmitOne(agents, grid, slots[0], exposure[0], tick, rng, hooks[0], silentSpread);
		return;
	}
	const { x, y, region } = agents;
	const { cellStart, cellItems } = grid;
	const D = slots.length;
	const w = new Float64Array(D);
	const r2 = slots.map((p) => p.disease.transmissionRadius ** 2);
	// Cells to scan either side: enough to cover the widest radius.
	const span = Math.ceil(Math.sqrt(Math.max(...r2)) / grid.cellSize);
	const logq = slots.map((p) => Math.log(1 - Math.min(p.disease.beta, 0.999999) / p.perDot));
	for (const e of exposure) e.touchedCount = 0;

	for (let s0 = 0; s0 < D; s0++) {
		const list = slots[s0];
		for (let k = 0; k < list.activeCount; k++) {
			const j = list.active[k];
			// A dot active in an earlier disease has already been scanned for every disease.
			let seen = false;
			for (let s = 0; s < s0; s++) if (slots[s].infected(j) > 0) seen = true;
			if (seen) continue;
			const reg = region[j];
			if (reg < 0) continue;
			let any = false;
			let reach = 0;
			for (let s = 0; s < D; s++) {
				const n = slots[s].infectious(j, silentSpread);
				w[s] = n > 0 ? n * logq[s] : 0;
				if (n > 0) {
					any = true;
					if (r2[s] > reach) reach = r2[s];
				}
			}
			if (!any) continue;
			const xj = x[j];
			const yj = y[j];
			const cols = grid.cols[reg];
			const rows = grid.rows[reg];
			const base = grid.offset[reg];
			const cx = grid.col(reg, xj);
			const cy = grid.row(reg, yj);
			const x0 = cx > span ? cx - span : 0;
			const x1 = cx < cols - 1 - span ? cx + span : cols - 1;
			const y0 = cy > span ? cy - span : 0;
			const y1 = cy < rows - 1 - span ? cy + span : rows - 1;
			for (let gy = y0; gy <= y1; gy++) {
				for (let gx = x0; gx <= x1; gx++) {
					const c = base + gy * cols + gx;
					const end = cellStart[c + 1];
					for (let m = cellStart[c]; m < end; m++) {
						const i = cellItems[m];
						if (i === j) continue;
						const dx = x[i] - xj;
						const dy = y[i] - yj;
						const d2 = dx * dx + dy * dy;
						if (d2 > reach) continue;
						for (let s = 0; s < D; s++) {
							if (w[s] === 0 || d2 > r2[s]) continue;
							const p = slots[s];
							const open = p.catchable(i);
							if (open === 0) continue;
							if (p.secondaries) {
								const got = rng.binomial(open, 1 - Math.exp(w[s]));
								if (got > 0) {
									p.infect(i, got, tick, rng, hooks[s], true);
									p.secondaries[j] += got;
								}
								continue;
							}
							const e = exposure[s];
							if (e.marked[i] === 0) {
								e.marked[i] = 1;
								e.logEscape[i] = 0;
								e.touched[e.touchedCount++] = i;
							}
							e.logEscape[i] += w[s];
						}
					}
				}
			}
		}
	}
	for (let s = 0; s < D; s++) {
		const e = exposure[s];
		const p = slots[s];
		for (let k = 0; k < e.touchedCount; k++) {
			const i = e.touched[k];
			e.marked[i] = 0;
			const got = rng.binomial(p.catchable(i), 1 - Math.exp(e.logEscape[i]));
			if (got > 0) p.infect(i, got, tick, rng, hooks[s], false);
		}
	}
}

/** transmit() for one disease outside calibration, the usual case, with the per-disease loops taken out. */
function transmitOne(
	agents: Agents,
	grid: SpatialGrid,
	p: People,
	e: Exposure,
	tick: number,
	rng: Rng,
	hooks: PeopleHooks,
	silentSpread: boolean
): void {
	const { x, y, region } = agents;
	const { cellStart, cellItems } = grid;
	const { susceptible, susceptibleAgain, active } = p;
	const { logEscape, touched, marked } = e;
	const reach = p.disease.transmissionRadius ** 2;
	const span = Math.ceil(p.disease.transmissionRadius / grid.cellSize);
	const logq = Math.log(1 - Math.min(p.disease.beta, 0.999999) / p.perDot);
	let touchedCount = 0;
	for (let k = 0; k < p.activeCount; k++) {
		const j = active[k];
		const reg = region[j];
		if (reg < 0) continue;
		const n = p.infectious(j, silentSpread);
		if (n <= 0) continue;
		const w = n * logq;
		const xj = x[j];
		const yj = y[j];
		const cols = grid.cols[reg];
		const rows = grid.rows[reg];
		const base = grid.offset[reg];
		const cx = grid.col(reg, xj);
		const cy = grid.row(reg, yj);
		const x0 = cx > span ? cx - span : 0;
		const x1 = cx < cols - 1 - span ? cx + span : cols - 1;
		const y0 = cy > span ? cy - span : 0;
		const y1 = cy < rows - 1 - span ? cy + span : rows - 1;
		for (let gy = y0; gy <= y1; gy++) {
			const row = base + gy * cols;
			// The cells of one row are next to each other in cellItems.
			const end = cellStart[row + x1 + 1];
			for (let m = cellStart[row + x0]; m < end; m++) {
				const i = cellItems[m];
				if (i === j || susceptible[i] + susceptibleAgain[i] === 0) continue;
				const dx = x[i] - xj;
				const dy = y[i] - yj;
				if (dx * dx + dy * dy > reach) continue;
				if (marked[i] === 0) {
					marked[i] = 1;
					logEscape[i] = w;
					touched[touchedCount++] = i;
				} else logEscape[i] += w;
			}
		}
	}
	e.touchedCount = touchedCount;
	for (let k = 0; k < touchedCount; k++) {
		const i = touched[k];
		marked[i] = 0;
		const got = rng.binomialEscape(susceptible[i] + susceptibleAgain[i], logEscape[i]);
		if (got > 0) p.infect(i, got, tick, rng, hooks, false);
	}
}
