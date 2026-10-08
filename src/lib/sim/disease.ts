import { Agents } from './agents';
import { TICKS_PER_DAY } from './constants';
import { SpatialGrid } from './grid';
import { Rng } from './rng';
import { BEHAVIOUR } from '../config/behaviour';
import { breakthroughSevereProtection, defaultVaccine, vaccineKey } from '../config/vaccines';
import { perSymptomaticBands } from '../config/diseases';
import {
	Protection,
	State,
	type Bands,
	type DiseaseCalibration,
	type DiseaseConfig,
	type DiseaseRuntime,
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
 * One vaccine for the engine. "Partly vaccinated" means an unfinished course of this vaccine, or,
 * when it has none, of the entry the disease's `partialCourse` names (6.13).
 */
function toVaccineRuntime(config: DiseaseConfig, v: Vaccine): VaccineRuntime {
	const fullInfection = v.full.infection.value;
	const course = v.partial
		? v
		: config.partialCourse
			? config.vaccines?.find((e) => vaccineKey(e) === config.partialCourse)
			: undefined;
	const partial = course?.partial;
	const partialInfection = partial?.infection?.value ?? 0;
	return {
		key: vaccineKey(v),
		fullInfection,
		fullSevere: breakthrough(fullInfection, v.full.severe?.value),
		hasPartialCourse: partial !== undefined,
		partialInfection,
		// No sourced figure for an unfinished course: the existing default, never severe (6.2).
		partialSevere: partial?.severe ? breakthrough(partialInfection, partial.severe.value) : 1,
		partialShortIll: partial !== undefined && partial.severe === undefined,
		waningMeanTicks: halfLifeTicks(v.waningDays.value)
	};
}

/** A disease with no vaccine: being "vaccinated" against it protects nobody. */
function noVaccine(config: DiseaseConfig): VaccineRuntime {
	return {
		key: 'none',
		fullInfection: config.fullEfficacy.value,
		fullSevere: 0,
		hasPartialCourse: config.partialEfficacy !== undefined,
		partialInfection: config.partialEfficacy?.value ?? 0,
		partialSevere: 1,
		partialShortIll: config.partialEfficacy !== undefined,
		waningMeanTicks: 0
	};
}

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
		illTicks: days(config.illDays.value),
		shortIllTicks: days(config.illDays.value * BEHAVIOUR.partialIllFactor.value),
		asymptomaticFraction: config.asymptomaticFraction.value,
		mortality: config.mortality.value,
		mortalityByBand: bands(config, config.mortalityByAge, config.mortality.value),
		hospitalisedShare: config.hospitalisedShare.value,
		hospitalByBand: bands(config, config.hospitalisedByAge, config.hospitalisedShare.value),
		waningMeanTicks: halfLifeTicks(config.waningDays.value),
		afterInfectionSevere: after ? breakthrough(after.infection.value, after.severe.value) : 0,
		vaccines: def ? [def, ...others].map((v) => toVaccineRuntime(config, v)) : [noVaccine(config)],
		beta: calibration.beta,
		transmissionRadius: calibration.transmissionRadius
	};
}

/** The vaccine a population is given: its pick when the disease offers it, else the default. */
export function vaccineFor(disease: DiseaseRuntime, key: string | undefined): VaccineRuntime {
	return disease.vaccines.find((v) => v.key === key) ?? disease.vaccines[0];
}

/**
 * Ticks until protection fades, or -1 when it never does. Exponential with mean
 * halfLife / ln 2, so half of a cohort has lost protection at the half-life (6.3).
 */
export function drawWaneTicks(meanTicks: number, rng: Rng): number {
	if (meanTicks === 0) return -1;
	return Math.max(1, Math.round(-Math.log(1 - rng.next()) * meanTicks));
}

/** Callbacks the disease step reports to, so the engine can keep its counters. */
export interface DiseaseHooks {
	onInfected(target: number, source: number): void;
	onDeath(dot: number): void;
}

/** Subsystem switches the illness rules read (6.14). */
export interface IllnessRules {
	deaths: boolean;
	hospital: boolean;
	ageBands: boolean;
	illStopsMovement: boolean;
}

/** Put a dot into the silent phase of the disease in `slot`. */
export function infect(
	agents: Agents,
	slot: number,
	i: number,
	source: number,
	tick: number,
	disease: DiseaseRuntime,
	rng: Rng,
	rules: IllnessRules
): void {
	const k = agents.offset(slot) + i;
	agents.state[k] = State.SILENT;
	agents.infectedTick[k] = tick;
	agents.infectedBy[k] = source;
	agents.waneTicks[k] = -1;
	const asymptomatic = rng.next() < disease.asymptomaticFraction;
	agents.asymptomatic[k] = asymptomatic ? 1 : 0;
	// No silent phase (e.g. Ebola): symptoms start at once, so the dot is never mobile and contagious.
	if (!asymptomatic && disease.silentTicks === 0) {
		showSymptoms(agents, k, i, disease, rng, rules);
		return;
	}
	// A case that never shows symptoms stays orange for its whole contagious period.
	agents.stateTicks[k] = asymptomatic ? disease.silentTicks + illTicksFor(agents, k, disease) : disease.silentTicks;
}

function illTicksFor(agents: Agents, k: number, disease: DiseaseRuntime): number {
	return agents.shortIll[k] === 1 ? disease.shortIllTicks : disease.illTicks;
}

/** The band's chances, cut by the dot's protection against severe illness. */
function deathChance(agents: Agents, k: number, i: number, disease: DiseaseRuntime, rules: IllnessRules): number {
	const d = rules.ageBands ? disease.mortalityByBand[agents.ageBand[i]] : disease.mortality;
	return d * (1 - agents.severe[k]);
}

function bedChance(agents: Agents, k: number, i: number, disease: DiseaseRuntime, rules: IllnessRules): number {
	const h = rules.ageBands ? disease.hospitalByBand[agents.ageBand[i]] : disease.hospitalisedShare;
	return h * (1 - agents.severe[k]);
}

/** Symptoms start: the dot turns red, stops (unless that subsystem is off) and may need a bed. */
function showSymptoms(
	agents: Agents,
	k: number,
	i: number,
	disease: DiseaseRuntime,
	rng: Rng,
	rules: IllnessRules
): void {
	agents.state[k] = State.SYMPTOMATIC;
	agents.stateTicks[k] = illTicksFor(agents, k, disease);
	agents.ill[i] = 1;
	if (rules.illStopsMovement) {
		agents.vx[i] = 0;
		agents.vy[i] = 0;
	}
	// The bed is drawn now so pressure counts the people actually in a bed (6.6).
	agents.inBed[k] = rng.next() < bedChance(agents, k, i, disease, rules) ? 1 : 0;
}

/**
 * Spread: every infectious dot checks the 3x3 cells around it for susceptible dots in range.
 * Vaccines are all or nothing: a vaccinated dot either cannot catch it, or catches it like anyone.
 * When `secondaryOnly` is set (calibration), newly infected dots are counted and set aside
 * instead of becoming infectious, so each index case's own infections can be measured.
 * With `silentSpread` off, only dots with symptoms spread it.
 */
export function transmit(
	agents: Agents,
	grid: SpatialGrid,
	disease: DiseaseRuntime,
	slot: number,
	tick: number,
	rng: Rng,
	hooks: DiseaseHooks,
	secondaryOnly: boolean,
	silentSpread: boolean,
	rules: IllnessRules
): void {
	const { x, y, state, infectedTick, region, vaccineWorks, dead } = agents;
	const { cellStart, cellItems } = grid;
	const o = agents.offset(slot);
	const n = agents.activeCount;
	const r2 = disease.transmissionRadius * disease.transmissionRadius;
	const beta = disease.beta;

	for (let i = 0; i < n; i++) {
		const s = state[o + i];
		if (s !== State.SYMPTOMATIC && (s !== State.SILENT || !silentSpread)) continue;
		const reg = region[i];
		if (infectedTick[o + i] >= tick || reg < 0 || dead[i] === 1) continue;
		const xi = x[i];
		const yi = y[i];
		const cols = grid.cols[reg];
		const rows = grid.rows[reg];
		const base = grid.offset[reg];
		const cx = grid.col(reg, xi);
		const cy = grid.row(reg, yi);
		const x0 = cx > 0 ? cx - 1 : 0;
		const x1 = cx < cols - 1 ? cx + 1 : cols - 1;
		const y0 = cy > 0 ? cy - 1 : 0;
		const y1 = cy < rows - 1 ? cy + 1 : rows - 1;
		for (let gy = y0; gy <= y1; gy++) {
			for (let gx = x0; gx <= x1; gx++) {
				const c = base + gy * cols + gx;
				const end = cellStart[c + 1];
				for (let m = cellStart[c]; m < end; m++) {
					const j = cellItems[m];
					if (state[o + j] !== State.SUSCEPTIBLE) continue;
					if (vaccineWorks[o + j] === 1) continue;
					const dx = x[j] - xi;
					const dy = y[j] - yi;
					if (dx * dx + dy * dy > r2) continue;
					if (rng.next() >= beta) continue;
					if (secondaryOnly) {
						state[o + j] = State.RECOVERED;
						infectedTick[o + j] = tick;
						agents.infectedBy[o + j] = i;
						agents.waneTicks[o + j] = -1;
					} else {
						infect(agents, slot, j, i, tick, disease, rng, rules);
					}
					hooks.onInfected(j, i);
				}
			}
		}
	}
}

/**
 * Disease clocks: silent turns red (or recovers, if it never shows symptoms), red ends in
 * recovery or death. `strain[region]` multiplies a bedded case's odds of dying (6.6); a dot on a
 * route is in no hospital and feels none. Waning is drawn at recovery when `waning` is on.
 */
export function advanceIllness(
	agents: Agents,
	disease: DiseaseRuntime,
	slot: number,
	rng: Rng,
	strain: Float32Array,
	hooks: DiseaseHooks,
	rules: IllnessRules,
	waning: boolean
): void {
	const { state, stateTicks, dead } = agents;
	const o = agents.offset(slot);
	const n = agents.activeCount;
	for (let i = 0; i < n; i++) {
		const k = o + i;
		const s = state[k];
		if (s !== State.SILENT && s !== State.SYMPTOMATIC) continue;
		if (dead[i] === 1) continue;
		if (--stateTicks[k] > 0) continue;
		if (s === State.SILENT) {
			if (agents.asymptomatic[k] === 1) recover(agents, k, i, disease, rng, waning);
			else showSymptoms(agents, k, i, disease, rng, rules);
			continue;
		}
		// End of the red phase: the two-draw rule of 6.6, with the joint chances it states.
		const bedded = agents.inBed[k] === 1;
		agents.inBed[k] = 0;
		let p = 0;
		if (rules.deaths) {
			const d = deathChance(agents, k, i, disease, rules);
			const h = bedChance(agents, k, i, disease, rules);
			if (bedded) {
				const r = agents.region[i];
				const m = rules.hospital && r >= 0 ? strain[r] : 1;
				// Strain multiplies the odds of dying, as the sources' odds ratios measure (6.6),
				// which also keeps the chance below 1.
				const base = Math.min(d, h) / h;
				p = (m * base) / (1 - base + m * base);
			} else if (h < 1) {
				p = Math.max(0, d - h) / (1 - h);
			}
		}
		if (p > 0 && rng.next() < p) {
			state[k] = State.DECEASED;
			dead[i] = 1;
			agents.vx[i] = 0;
			agents.vy[i] = 0;
			agents.isolated[i] = 0;
			refreshIll(agents, i);
			hooks.onDeath(i);
		} else {
			recover(agents, k, i, disease, rng, waning);
		}
	}
}

/**
 * Waning (6.3), one step per dot: a working vaccine stops working, and a recovered dot becomes
 * catchable again. Both keep their protection against severe illness.
 */
export function wane(agents: Agents, slot: number): void {
	const { state, waneTicks, vaccineWorks, dead } = agents;
	const o = agents.offset(slot);
	const n = agents.activeCount;
	for (let i = 0; i < n; i++) {
		const k = o + i;
		if (waneTicks[k] < 0 || dead[i] === 1) continue;
		if (--waneTicks[k] > 0) continue;
		waneTicks[k] = -1;
		const s = state[k];
		if (s === State.RECOVERED) state[k] = State.SUSCEPTIBLE;
		else if (s === State.SUSCEPTIBLE) vaccineWorks[k] = 0;
	}
}

/** Recompute the per-dot `ill` flag after a dot leaves the red phase of one disease. */
function refreshIll(agents: Agents, i: number): void {
	let ill = 0;
	for (let s = 0; s < agents.diseaseCount; s++) {
		if (agents.state[agents.offset(s) + i] === State.SYMPTOMATIC) ill = 1;
	}
	agents.ill[i] = ill;
}

function recover(agents: Agents, k: number, i: number, disease: DiseaseRuntime, rng: Rng, waning: boolean): void {
	agents.state[k] = State.RECOVERED;
	agents.inBed[k] = 0;
	agents.isolated[i] = 0;
	// Having had it works like a vaccine course: keep the stronger protection, never combined (6.2).
	if (disease.afterInfectionSevere > agents.severe[k]) agents.severe[k] = disease.afterInfectionSevere;
	agents.waneTicks[k] = waning ? drawWaneTicks(disease.waningMeanTicks, rng) : -1;
	refreshIll(agents, i);
	if (agents.ill[i] === 1) return;
	const a = rng.next() * Math.PI * 2;
	agents.vx[i] = Math.cos(a) * agents.speed[i];
	agents.vy[i] = Math.sin(a) * agents.speed[i];
}

/** Spawn-time vaccination for one dot and one disease (all or nothing, 6.1). */
export function vaccinate(
	agents: Agents,
	slot: number,
	i: number,
	vaccine: VaccineRuntime,
	rng: Rng,
	waning: boolean
): void {
	const k = agents.offset(slot) + i;
	const p = agents.protection[i];
	const full = p === Protection.FULL;
	const partial = p === Protection.PARTIAL;
	const efficacy = full ? vaccine.fullInfection : partial ? vaccine.partialInfection : 0;
	agents.vaccineWorks[k] = rng.next() < efficacy ? 1 : 0;
	agents.severe[k] = full ? vaccine.fullSevere : partial ? vaccine.partialSevere : 0;
	agents.shortIll[k] = partial && vaccine.partialShortIll ? 1 : 0;
	agents.waneTicks[k] =
		agents.vaccineWorks[k] === 1 && waning ? drawWaneTicks(vaccine.waningMeanTicks, rng) : -1;
}
