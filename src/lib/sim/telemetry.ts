import { Agents } from './agents';
import { HISTORY_DAYS } from './constants';
import {
	HISTORY_CHANNELS,
	Protection,
	State,
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

/**
 * Running counters per region plus one in-transit bucket (index regionCount), and a ring buffer
 * with one sample per region per day.
 */
export class TelemetryCounters {
	readonly regionCount: number;
	/** (regionCount + 1) x C_SLOTS: each region, then the in-transit bucket. */
	readonly counts: Int32Array;
	readonly ever: Int32Array;
	private readonly history: Int32Array;
	private historyLen = 0;
	private historyHead = 0;
	private readonly historyDay: Int32Array;

	constructor(regionCount: number) {
		this.regionCount = regionCount;
		this.counts = new Int32Array((regionCount + 1) * C_SLOTS);
		this.ever = new Int32Array(regionCount);
		this.history = new Int32Array(HISTORY_DAYS * regionCount * CHANNELS);
		this.historyDay = new Int32Array(HISTORY_DAYS);
	}

	/**
	 * Recount everyone by display colour. Living travellers go in the in-transit bucket; someone
	 * who died on the way counts in the trip's origin, so every dot is counted exactly once.
	 */
	recount(agents: Agents, routes: readonly Route[]): void {
		const { counts } = this;
		counts.fill(0);
		const n = agents.activeCount;
		for (let i = 0; i < n; i++) {
			const s = agents.state[i];
			let r = agents.region[i];
			if (r < 0) {
				const route = agents.route[i];
				if (route < 0) continue;
				r = s === State.DECEASED ? originOf(routes[route], agents.routeDir[i]) : this.regionCount;
			}
			const base = r * C_SLOTS;
			if (s === State.SUSCEPTIBLE) {
				const p = agents.protection[i];
				counts[
					base + (p === Protection.FULL ? C_FULL : p === Protection.PARTIAL ? C_PARTIAL : C_UNPROTECTED)
				]++;
			} else if (s === State.SILENT) counts[base + C_SILENT]++;
			else if (s === State.SYMPTOMATIC) counts[base + C_SYMPTOMATIC]++;
			else if (s === State.RECOVERED) counts[base + C_RECOVERED]++;
			else counts[base + C_DECEASED]++;
		}
		for (let r = 0; r < this.regionCount; r++) counts[r * C_SLOTS + C_EVER] = this.ever[r];
	}

	symptomatic(region: number): number {
		return this.counts[region * C_SLOTS + C_SYMPTOMATIC];
	}

	/** Store today's sample for every region. */
	sample(day: number): void {
		const slot = this.historyHead;
		const { counts, history } = this;
		for (let r = 0; r < this.regionCount; r++) {
			const b = r * C_SLOTS;
			const h = (slot * this.regionCount + r) * CHANNELS;
			history[h] = counts[b + C_SILENT];
			history[h + 1] = counts[b + C_SYMPTOMATIC];
			history[h + 2] = counts[b + C_RECOVERED];
			history[h + 3] = counts[b + C_DECEASED];
			history[h + 4] = counts[b + C_UNPROTECTED] + counts[b + C_PARTIAL];
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
		const start = (this.historyHead - len + HISTORY_DAYS) % HISTORY_DAYS;
		for (let k = 0; k < len; k++) {
			const slot = (start + k) % HISTORY_DAYS;
			days[k] = this.historyDay[slot];
			const h = (slot * this.regionCount + r) * CHANNELS;
			for (let ch = 0; ch < CHANNELS; ch++) series[HISTORY_CHANNELS[ch]][k] = this.history[h + ch];
		}
		return { days, series };
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
