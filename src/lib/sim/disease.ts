import { Agents } from './agents';
import { PARTIAL_ILL_FACTOR, TICKS_PER_DAY } from './constants';
import { SpatialGrid } from './grid';
import { Rng } from './rng';
import { Protection, State, type DiseaseCalibration, type DiseaseConfig, type DiseaseRuntime } from './types';

/** Convert a disease from config (days) to engine units (ticks), once, at load. */
export function toRuntime(config: DiseaseConfig, calibration: DiseaseCalibration): DiseaseRuntime {
	const days = (d: number) => Math.max(1, Math.round(d * TICKS_PER_DAY));
	return {
		id: config.id,
		r0: config.r0.value,
		// Zero is allowed here: some diseases are not contagious before symptoms (see infect).
		silentTicks: Math.max(0, Math.round(config.silentDays.value * TICKS_PER_DAY)),
		illTicks: days(config.illDays.value),
		asymptomaticFraction: config.asymptomaticFraction.value,
		mortality: config.mortality.value,
		waningMeanTicks: config.waningDays.value === null ? 0 : days(config.waningDays.value / Math.LN2),
		fullEfficacy: config.fullEfficacy.value,
		partialEfficacy: config.partialEfficacy.value,
		hospitalisedShare: config.hospitalisedShare.value,
		beta: calibration.beta,
		transmissionRadius: calibration.transmissionRadius
	};
}

/**
 * Ticks until a dot's protection next drops a level, or -1 when it never fades. Exponential with
 * mean waningDays / ln 2, so half of a cohort has lost protection at waningDays (step 3 uses it).
 */
export function drawWaneTicks(disease: DiseaseRuntime, rng: Rng): number {
	if (disease.waningMeanTicks === 0) return -1;
	return Math.max(1, Math.round(-Math.log(1 - rng.next()) * disease.waningMeanTicks));
}

/** Callbacks the disease step reports to, so the engine can keep its counters. */
export interface DiseaseHooks {
	onInfected(target: number, source: number): void;
	onDeath(dot: number): void;
}

/** Put a dot into the silent phase. */
export function infect(
	agents: Agents,
	i: number,
	source: number,
	tick: number,
	disease: DiseaseRuntime,
	rng: Rng
): void {
	agents.state[i] = State.SILENT;
	agents.infectedTick[i] = tick;
	agents.infectedBy[i] = source;
	const asymptomatic = rng.next() < disease.asymptomaticFraction;
	agents.asymptomatic[i] = asymptomatic ? 1 : 0;
	// No silent phase (e.g. Ebola): symptoms start at once, so the dot is never mobile and contagious.
	if (!asymptomatic && disease.silentTicks === 0) {
		agents.state[i] = State.SYMPTOMATIC;
		agents.stateTicks[i] = illTicksFor(agents, i, disease);
		agents.vx[i] = 0;
		agents.vy[i] = 0;
		return;
	}
	// A case that never shows symptoms stays orange for its whole contagious period.
	agents.stateTicks[i] = asymptomatic
		? disease.silentTicks + illTicksFor(agents, i, disease)
		: disease.silentTicks;
}

function illTicksFor(agents: Agents, i: number, disease: DiseaseRuntime): number {
	return agents.protection[i] === Protection.PARTIAL
		? Math.max(1, Math.round(disease.illTicks * PARTIAL_ILL_FACTOR))
		: disease.illTicks;
}

/**
 * Spread: every infectious dot checks the 3x3 cells around it for susceptible dots in range.
 * Vaccines are all or nothing: a vaccinated dot either cannot catch it, or catches it like anyone.
 * When `secondaryOnly` is set (calibration), newly infected dots are counted and set aside
 * instead of becoming infectious, so each index case's own infections can be measured.
 */
export function transmit(
	agents: Agents,
	grid: SpatialGrid,
	disease: DiseaseRuntime,
	tick: number,
	rng: Rng,
	hooks: DiseaseHooks,
	secondaryOnly: boolean
): void {
	const { x, y, state, infectedTick, region, vaccineWorks } = agents;
	const { cellStart, cellItems } = grid;
	const n = agents.activeCount;
	const r2 = disease.transmissionRadius * disease.transmissionRadius;
	const beta = disease.beta;

	for (let i = 0; i < n; i++) {
		const s = state[i];
		if (s !== State.SILENT && s !== State.SYMPTOMATIC) continue;
		const reg = region[i];
		if (infectedTick[i] >= tick || reg < 0) continue;
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
				for (let k = cellStart[c]; k < end; k++) {
					const j = cellItems[k];
					if (state[j] !== State.SUSCEPTIBLE) continue;
					if (vaccineWorks[j] === 1) continue;
					const dx = x[j] - xi;
					const dy = y[j] - yi;
					if (dx * dx + dy * dy > r2) continue;
					if (rng.next() >= beta) continue;
					if (secondaryOnly) {
						state[j] = State.RECOVERED;
						infectedTick[j] = tick;
						agents.infectedBy[j] = i;
					} else {
						infect(agents, j, i, tick, disease, rng);
					}
					hooks.onInfected(j, i);
				}
			}
		}
	}
}

/**
 * Disease clocks: silent turns red (or recovers, if it never shows symptoms), red ends in
 * recovery or death. `mortalityMultiplier[region]` is 3 where hospitals are overloaded.
 */
export function advanceIllness(
	agents: Agents,
	disease: DiseaseRuntime,
	rng: Rng,
	mortalityMultiplier: Float32Array,
	hooks: DiseaseHooks
): void {
	const { state, stateTicks, vx, vy } = agents;
	const n = agents.activeCount;
	for (let i = 0; i < n; i++) {
		const s = state[i];
		if (s !== State.SILENT && s !== State.SYMPTOMATIC) continue;
		if (--stateTicks[i] > 0) continue;
		if (s === State.SILENT) {
			if (agents.asymptomatic[i] === 1) {
				recover(agents, i, rng);
			} else {
				state[i] = State.SYMPTOMATIC;
				stateTicks[i] = illTicksFor(agents, i, disease);
				vx[i] = 0;
				vy[i] = 0;
			}
			continue;
		}
		// End of the red phase. Partly vaccinated dots get a mild illness and never die.
		const r = agents.region[i];
		const mult = r >= 0 ? mortalityMultiplier[r] : 1;
		if (agents.protection[i] !== Protection.PARTIAL && rng.next() < disease.mortality * mult) {
			state[i] = State.DECEASED;
			vx[i] = 0;
			vy[i] = 0;
			agents.isolated[i] = 0;
			hooks.onDeath(i);
		} else {
			recover(agents, i, rng);
		}
	}
}

function recover(agents: Agents, i: number, rng: Rng): void {
	agents.state[i] = State.RECOVERED;
	agents.isolated[i] = 0;
	const a = rng.next() * Math.PI * 2;
	agents.vx[i] = Math.cos(a) * agents.speed[i];
	agents.vy[i] = Math.sin(a) * agents.speed[i];
}
