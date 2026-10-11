import { Agents } from './agents';
import { bedChanceOf, type IllnessRules } from './disease';
import type { People } from './people';
import { HISTORY_DAYS, MAX_DISEASES } from './constants';
import {
	AGE_CHANNELS,
	HISTORY_CHANNELS,
	Protection,
	type AgeChannel,
	type Bands,
	type Counts,
	type HistoryChannel,
	type RegionHistory,
	type Route
} from './types';
import { originOf } from './transit';

/** Counter slots per region, in a flat Int32Array. */
const C_UNPROTECTED = 0;
const C_FULL = 1;
const C_PARTIAL = 2;
const C_SILENT = 3;
const C_SYMPTOMATIC = 4;
const C_RECOVERED = 5;
const C_DECEASED = 6;
const C_EVER = 7;
const C_SLOTS = 8;
const CHANNELS = HISTORY_CHANNELS.length;

/** Hospital channels are expected values (6.6), so history stores them in thousandths of a person. */
export const HOSPITAL_SCALE = 1000;

/** Age counters per region: AGE_CHANNELS x 3 bands, channel-major. */
const A_SUSCEPTIBLE = 0;
const A_INFECTED = 1;
const A_IN_HOSPITAL = 2;
const A_RECOVERED = 3;
const A_DECEASED = 4;
const A_VACCINATED = 5;
const BANDS = 3;
const A_SLOTS = AGE_CHANNELS.length * BANDS;

/**
 * Running counters per region plus one in-transit bucket (index regionCount), and a ring buffer
 * with one sample per region per day: people by state, hospital use and pressure, and the same
 * people by age band. Every count is whole people.
 */
export class TelemetryCounters {
	readonly regionCount: number;
	/** (regionCount + 1) x C_SLOTS: each region, then the in-transit bucket. */
	readonly counts: Int32Array;
	/** People ever infected per region and age band (regionCount x 3), counted where they caught it. */
	readonly ever: Int32Array;
	/**
	 * regionCount x A_SLOTS. Living travellers are left out; deaths count where they happened (a
	 * traveller's at the trip's origin). The in-hospital channel is filled from agesInHospital.
	 */
	readonly ages: Int32Array;
	/** Expected outbreak patients in a bed per region, in people; an ill traveller counts at their origin (6.8). */
	readonly patients: Float64Array;
	/** The same patients per region and age band (regionCount x 3). */
	readonly agesInHospital: Float64Array;
	/**
	 * Deaths in people per region, disease slot and age band (regionCount x MAX_DISEASES x 3), counted
	 * where they happened: a traveller's at the trip's origin (6.8).
	 */
	readonly died: Int32Array;
	private readonly history: Float64Array;
	private readonly ageHistory: Float64Array;
	private historyLen = 0;
	private historyHead = 0;
	private readonly historyDay: Int32Array;

	constructor(regionCount: number) {
		this.regionCount = regionCount;
		this.counts = new Int32Array((regionCount + 1) * C_SLOTS);
		this.ever = new Int32Array(regionCount * BANDS);
		this.ages = new Int32Array(regionCount * A_SLOTS);
		this.patients = new Float64Array(regionCount);
		this.agesInHospital = new Float64Array(regionCount * BANDS);
		this.died = new Int32Array(regionCount * MAX_DISEASES * BANDS);
		this.history = new Float64Array(HISTORY_DAYS * regionCount * CHANNELS);
		this.ageHistory = new Float64Array(HISTORY_DAYS * regionCount * A_SLOTS);
		this.historyDay = new Int32Array(HISTORY_DAYS);
	}

	/**
	 * Recount everyone by state, in people. Living travellers go in the in-transit bucket. The dead
	 * aren't recounted: they stay counted where they died, so moving dots never carry deaths between
	 * cities and every person is counted exactly once.
	 */
	recount(agents: Agents, people: People): void {
		const { counts, ages } = this;
		counts.fill(0);
		ages.fill(0);
		const n = agents.activeCount;
		for (let i = 0; i < n; i++) {
			let r = agents.region[i];
			if (r < 0) {
				if (agents.route[i] < 0) continue;
				r = this.regionCount;
			}
			const band = agents.ageBand[i];
			const ill = people.ill[i];
			const base = r * C_SLOTS;
			const p = agents.protection[i];
			const silent = people.silentSymptomatic[i] + people.silentAsymptomatic[i];
			const rec = people.recovered[i];
			const well = people.perDot - people.dead[i] - ill - silent - rec;
			counts[
				base + (p === Protection.FULL ? C_FULL : p === Protection.PARTIAL ? C_PARTIAL : C_UNPROTECTED)
			] += well;
			counts[base + C_SILENT] += silent;
			counts[base + C_SYMPTOMATIC] += ill;
			counts[base + C_RECOVERED] += rec;
			if (r === this.regionCount) continue;

			const ab = r * A_SLOTS + band;
			ages[ab + A_SUSCEPTIBLE * BANDS] += well;
			ages[ab + A_INFECTED * BANDS] += silent + ill;
			ages[ab + A_RECOVERED * BANDS] += rec;
			if (p !== Protection.NONE) ages[ab + A_VACCINATED * BANDS] += people.perDot - people.dead[i];
		}
		for (let r = 0; r < this.regionCount; r++) {
			const b = r * C_SLOTS;
			counts[b + C_EVER] = this.everInfected(r);
			counts[b + C_DECEASED] = this.deaths(r);
			const died = this.deathsByAge(r);
			for (let band = 0; band < BANDS; band++) ages[r * A_SLOTS + A_DECEASED * BANDS + band] = died[band];
		}
	}

	/**
	 * Expected outbreak patients per region and age band, in people (6.6), every tick for pressure.
	 * Only dots with someone infected can have anyone ill. A traveller's bed is in the trip's origin (6.8).
	 */
	countPatients(agents: Agents, people: People, routes: readonly Route[], rules: IllnessRules): void {
		const { patients, agesInHospital } = this;
		patients.fill(0);
		agesInHospital.fill(0);
		if (!rules.hospital) return;
		const disease = people.disease;
		for (let k = 0; k < people.activeCount; k++) {
			const i = people.active[k];
			const ill = people.ill[i];
			if (ill === 0) continue;
			let home = agents.region[i];
			if (home < 0) {
				const route = agents.route[i];
				if (route < 0) continue;
				home = originOf(routes[route], agents.routeDir[i]);
			}
			const band = agents.ageBand[i];
			const again = people.illAgain[i];
			const need =
				(ill - again) * bedChanceOf(disease, band, people.severe[i], rules) +
				again * bedChanceOf(disease, band, people.severeAgain(i), rules);
			patients[home] += need;
			agesInHospital[home * BANDS + band] += need;
		}
	}

	/** Count `people` infected in a region's age band. */
	addInfections(region: number, band: number, people: number): void {
		this.ever[region * BANDS + band] += people;
	}

	everInfected(region: number): number {
		const b = region * BANDS;
		return this.ever[b] + this.ever[b + 1] + this.ever[b + 2];
	}

	everByAge(region: number): Bands {
		const b = region * BANDS;
		return [this.ever[b], this.ever[b + 1], this.ever[b + 2]];
	}

	symptomatic(region: number): number {
		return this.counts[region * C_SLOTS + C_SYMPTOMATIC];
	}

	/** Count `people` who died in a region (a traveller's origin), of the disease in `slot`, in an age band. */
	addDeaths(region: number, slot: number, band: number, people: number): void {
		this.died[(region * MAX_DISEASES + slot) * BANDS + band] += people;
	}

	/** Deaths so far in a region, in people, by age band, over every disease. */
	deathsByAge(region: number): Bands {
		const out: Bands = [0, 0, 0];
		for (let s = 0; s < MAX_DISEASES; s++) {
			const b = (region * MAX_DISEASES + s) * BANDS;
			for (let band = 0; band < BANDS; band++) out[band] += this.died[b + band];
		}
		return out;
	}

	/** Deaths so far in a region, in people. */
	deaths(region: number): number {
		const [a, b, c] = this.deathsByAge(region);
		return a + b + c;
	}

	/** Store today's sample for every region; `pressure` is each region's hospital pressure (6.6). */
	sample(day: number, pressure: Float32Array): void {
		const slot = this.historyHead;
		const { counts, history, ageHistory, ages, agesInHospital } = this;
		for (let r = 0; r < this.regionCount; r++) {
			const b = r * C_SLOTS;
			const h = (slot * this.regionCount + r) * CHANNELS;
			history[h] = counts[b + C_SILENT];
			history[h + 1] = counts[b + C_SYMPTOMATIC];
			history[h + 2] = counts[b + C_RECOVERED];
			history[h + 3] = counts[b + C_DECEASED];
			history[h + 4] = counts[b + C_UNPROTECTED] + counts[b + C_PARTIAL];
			history[h + 5] = Math.round(this.patients[r] * HOSPITAL_SCALE);
			history[h + 6] = Math.round(pressure[r] * 1000);
			const a = (slot * this.regionCount + r) * A_SLOTS;
			ageHistory.set(ages.subarray(r * A_SLOTS, (r + 1) * A_SLOTS), a);
			for (let band = 0; band < BANDS; band++) {
				ageHistory[a + A_IN_HOSPITAL * BANDS + band] = Math.round(
					agesInHospital[r * BANDS + band] * HOSPITAL_SCALE
				);
			}
		}
		this.historyDay[slot] = day;
		this.historyHead = (slot + 1) % HISTORY_DAYS;
		if (this.historyLen < HISTORY_DAYS) this.historyLen++;
		this.version++;
	}

	/** Counts for region r; r = regionCount gives the in-transit bucket. */
	regionCounts(r: number): Counts {
		const c = this.counts;
		const b = r * C_SLOTS;
		return {
			unprotected: c[b + C_UNPROTECTED],
			full: c[b + C_FULL],
			partial: c[b + C_PARTIAL],
			silent: c[b + C_SILENT],
			symptomatic: c[b + C_SYMPTOMATIC],
			recovered: c[b + C_RECOVERED],
			deceased: c[b + C_DECEASED],
			everInfected: c[b + C_EVER]
		};
	}

	/** Bumped every time a daily sample is stored. */
	version = 0;

	/** The most recent daily sample for one region. */
	latest(r: number): Record<HistoryChannel, number> {
		const slot = (this.historyHead - 1 + HISTORY_DAYS) % HISTORY_DAYS;
		const h = (slot * this.regionCount + r) * CHANNELS;
		return Object.fromEntries(HISTORY_CHANNELS.map((ch, k) => [ch, this.history[h + k]])) as Record<
			HistoryChannel,
			number
		>;
	}

	/** One region's history as typed arrays, oldest first. */
	regionHistory(r: number): RegionHistory {
		const len = this.historyLen;
		const days = new Int32Array(len);
		const series = Object.fromEntries(HISTORY_CHANNELS.map((ch) => [ch, new Float64Array(len)])) as Record<
			HistoryChannel,
			Float64Array
		>;
		const byAge = Object.fromEntries(
			AGE_CHANNELS.map((ch) => [ch, [new Float64Array(len), new Float64Array(len), new Float64Array(len)]])
		) as Record<AgeChannel, [Float64Array, Float64Array, Float64Array]>;
		const start = (this.historyHead - len + HISTORY_DAYS) % HISTORY_DAYS;
		for (let k = 0; k < len; k++) {
			const slot = (start + k) % HISTORY_DAYS;
			days[k] = this.historyDay[slot];
			const h = (slot * this.regionCount + r) * CHANNELS;
			for (let ch = 0; ch < CHANNELS; ch++) series[HISTORY_CHANNELS[ch]][k] = this.history[h + ch];
			const a = (slot * this.regionCount + r) * A_SLOTS;
			for (let ch = 0; ch < AGE_CHANNELS.length; ch++) {
				const bands = byAge[AGE_CHANNELS[ch]];
				for (let band = 0; band < BANDS; band++) bands[band][k] = this.ageHistory[a + ch * BANDS + band];
			}
		}
		return { days, series, byAge };
	}
}

export function sumCounts(list: Counts[]): Counts {
	const t: Counts = {
		unprotected: 0,
		full: 0,
		partial: 0,
		silent: 0,
		symptomatic: 0,
		recovered: 0,
		deceased: 0,
		everInfected: 0
	};
	for (const c of list) for (const k of Object.keys(t) as (keyof Counts)[]) t[k] += c[k];
	return t;
}
