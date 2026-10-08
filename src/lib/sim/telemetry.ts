import { Agents } from './agents';
import { HISTORY_DAYS } from './constants';
import {
	AGE_CHANNELS,
	HISTORY_CHANNELS,
	Protection,
	State,
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

/** Hospital channels are expected values (6.6), so history stores them in thousandths of a dot. */
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
 * with one sample per region per day: counts by colour, hospital use and pressure, and the same
 * people by age band.
 */
export class TelemetryCounters {
	readonly regionCount: number;
	/** (regionCount + 1) x C_SLOTS: each region, then the in-transit bucket. */
	readonly counts: Int32Array;
	readonly ever: Int32Array;
	/**
	 * regionCount x A_SLOTS. Living travellers are left out; a death on the way counts at its
	 * origin. The in-hospital channel is filled from agesInHospital when sampled.
	 */
	readonly ages: Int32Array;
	/** Expected outbreak patients in a bed per region, in dots; an ill traveller counts at its origin (6.8). */
	readonly patients: Float64Array;
	/** The same patients per region and age band (regionCount x 3). */
	readonly agesInHospital: Float64Array;
	private readonly history: Int32Array;
	private readonly ageHistory: Int32Array;
	private historyLen = 0;
	private historyHead = 0;
	private readonly historyDay: Int32Array;

	constructor(regionCount: number) {
		this.regionCount = regionCount;
		this.counts = new Int32Array((regionCount + 1) * C_SLOTS);
		this.ever = new Int32Array(regionCount);
		this.ages = new Int32Array(regionCount * A_SLOTS);
		this.patients = new Float64Array(regionCount);
		this.agesInHospital = new Float64Array(regionCount * BANDS);
		this.history = new Int32Array(HISTORY_DAYS * regionCount * CHANNELS);
		this.ageHistory = new Int32Array(HISTORY_DAYS * regionCount * A_SLOTS);
		this.historyDay = new Int32Array(HISTORY_DAYS);
	}

	/**
	 * Recount everyone by display colour. Living travellers go in the in-transit bucket; someone
	 * who died on the way counts in the trip's origin, so every dot is counted exactly once.
	 */
	recount(agents: Agents, routes: readonly Route[]): void {
		const { counts, ages, patients, agesInHospital } = this;
		counts.fill(0);
		ages.fill(0);
		patients.fill(0);
		agesInHospital.fill(0);
		const n = agents.activeCount;
		const slots = agents.diseaseCount;
		for (let i = 0; i < n; i++) {
			const s = agents.displayState(i);
			let r = agents.region[i];
			// The region whose hospitals this dot uses: a traveller's is the trip's origin (6.8).
			let home = r;
			if (r < 0) {
				const route = agents.route[i];
				if (route < 0) continue;
				home = originOf(routes[route], agents.routeDir[i]);
				r = s === State.DECEASED ? home : this.regionCount;
			}
			let need = 0;
			for (let d = 0; d < slots; d++) need += agents.bedNeed[agents.offset(d) + i];
			if (need > 0) {
				patients[home] += need;
				agesInHospital[home * BANDS + agents.ageBand[i]] += need;
			}
			const base = r * C_SLOTS;
			const p = agents.protection[i];
			if (s === State.SUSCEPTIBLE) {
				counts[
					base + (p === Protection.FULL ? C_FULL : p === Protection.PARTIAL ? C_PARTIAL : C_UNPROTECTED)
				]++;
			} else if (s === State.SILENT) counts[base + C_SILENT]++;
			else if (s === State.SYMPTOMATIC) counts[base + C_SYMPTOMATIC]++;
			else if (s === State.RECOVERED) counts[base + C_RECOVERED]++;
			else counts[base + C_DECEASED]++;
			if (r === this.regionCount) continue;

			const ab = r * A_SLOTS + agents.ageBand[i];
			const ch =
				s === State.SUSCEPTIBLE
					? A_SUSCEPTIBLE
					: s === State.SILENT || s === State.SYMPTOMATIC
						? A_INFECTED
						: s === State.RECOVERED
							? A_RECOVERED
							: A_DECEASED;
			ages[ab + ch * BANDS]++;
			if (p !== Protection.NONE) ages[ab + A_VACCINATED * BANDS]++;
		}
		for (let r = 0; r < this.regionCount; r++) counts[r * C_SLOTS + C_EVER] = this.ever[r];
	}

	symptomatic(region: number): number {
		return this.counts[region * C_SLOTS + C_SYMPTOMATIC];
	}

	/** Deaths so far in a region, by age band. */
	deathsByAge(region: number): Bands {
		const b = region * A_SLOTS + A_DECEASED * BANDS;
		return [this.ages[b], this.ages[b + 1], this.ages[b + 2]];
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
		const series = Object.fromEntries(HISTORY_CHANNELS.map((ch) => [ch, new Int32Array(len)])) as Record<
			HistoryChannel,
			Int32Array
		>;
		const byAge = Object.fromEntries(
			AGE_CHANNELS.map((ch) => [ch, [new Int32Array(len), new Int32Array(len), new Int32Array(len)]])
		) as Record<AgeChannel, [Int32Array, Int32Array, Int32Array]>;
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
