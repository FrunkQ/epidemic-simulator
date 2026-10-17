import { Agents, LONG_AGO } from './agents';
import { TICKS_PER_DAY } from './constants';
import { Rng } from './rng';
import type { HealthPolicy, Region } from './types';

/** Why a dot in a locked-down city is out, or that it stays home (6.4). */
export const Out = { KEY: 0, IGNORING: 1, TIRED: 2, HOME: 3 } as const;
export type OutReason = (typeof Out)[keyof typeof Out];

/** A held dot this close to tiring of a lockdown jitters on the map, as a warning (6.4). */
export const RESTLESS_DAYS = 3;

/** Days of lockdown after which dot i tires of it (6.4): mean + its fatigue draw x spread, at least 1. */
export function fatigueDays(a: Agents, i: number, policy: HealthPolicy): number {
	return Math.max(
		1,
		policy.lockdownFatigueMeanDays.value + a.fatigueZ[i] * policy.lockdownFatigueSdDays.value
	);
}

/** A key worker (6.4): aged 15-64, with a key rank under the city's key-worker share. */
export function isKeyWorker(a: Agents, i: number, policy: HealthPolicy): boolean {
	return a.ageBand[i] === 1 && a.keyRank[i] < policy.keyWorkerShare.value;
}

/** A dot's group on the key-worker chart's side of things (6.4): 0 key worker, 1 keeping to it, 2 other. */
export function lockdownGroup(a: Agents, i: number, policy: HealthPolicy): number {
	if (isKeyWorker(a, i, policy)) return 0;
	return a.complyRank[i] < policy.lockdownCompliance.value ? 1 : 2;
}

/**
 * Whether a dot stays home in a lockdown that has run `ticks` ticks, and if not, why it is out:
 * key workers, then people who ignore it from the start, then people who have tired of it.
 */
export function outReason(a: Agents, i: number, policy: HealthPolicy, ticks: number): OutReason {
	if (isKeyWorker(a, i, policy)) return Out.KEY;
	if (a.complyRank[i] >= policy.lockdownCompliance.value) return Out.IGNORING;
	return ticks > fatigueDays(a, i, policy) * TICKS_PER_DAY ? Out.TIRED : Out.HOME;
}

/**
 * Lockdowns, per city (6.4). `ticks` rises while a city is locked down and falls at the same rate
 * once it lifts, so a second lockdown soon after the first tires people sooner. Each tick it sets
 * Agents.held for every dot told to stay home that is still keeping to it, and Agents.contact: a
 * held dot's share of its usual contact with other dots. A dot that has just arrived from a trip
 * (still within radius / speed ticks of landing, the time to walk half across the city) first walks
 * to a spot of its own, drawn uniformly inside the disc, and is held once it gets there; every
 * traveller lands at the same point, and holding them there would pile them up. While walking it has
 * the held contact (it is someone keeping to the lockdown, on the way home), can't leave and isn't
 * out. With no lockdown nothing is drawn, so runs without one are unchanged.
 */
export class Lockdown {
	readonly on: Uint8Array;
	readonly ticks: Int32Array;
	/** Whether any dot may be held, so a run with no lockdown never scans the dots. */
	private holding = false;
	/** Each city's policy values for this tick, read once rather than per dot. */
	private readonly keyShare: Float64Array;
	private readonly comply: Float64Array;
	private readonly fatigueMean: Float64Array;
	private readonly fatigueSd: Float64Array;
	private readonly heldContact: Float64Array;

	constructor(regionCount: number) {
		this.on = new Uint8Array(regionCount);
		this.ticks = new Int32Array(regionCount);
		this.keyShare = new Float64Array(regionCount);
		this.comply = new Float64Array(regionCount);
		this.fatigueMean = new Float64Array(regionCount);
		this.fatigueSd = new Float64Array(regionCount);
		this.heldContact = new Float64Array(regionCount);
	}

	reset(): void {
		this.on.fill(0);
		this.ticks.fill(0);
		this.holding = false;
	}

	advance(a: Agents, regions: Region[], radii: Float32Array, tick: number, rng: Rng): void {
		let any = false;
		for (let r = 0; r < regions.length; r++) {
			if (this.on[r] === 1) {
				this.ticks[r]++;
				any = true;
			} else if (this.ticks[r] > 0) this.ticks[r]--;
		}
		if (!any && !this.holding) return;
		for (let r = 0; r < regions.length; r++) {
			const p = regions[r].policy;
			this.keyShare[r] = p.keyWorkerShare.value;
			this.comply[r] = p.lockdownCompliance.value;
			this.fatigueMean[r] = p.lockdownFatigueMeanDays.value;
			this.fatigueSd[r] = p.lockdownFatigueSdDays.value;
			this.heldContact[r] = 1 - p.lockdownContactCut.value;
		}
		const { held, region, contact, restless, walking, ageBand, keyRank, complyRank, fatigueZ } = a;
		for (let i = 0; i < a.activeCount; i++) {
			const r = region[i];
			// outReason and fatigueDays, worked out here from the hoisted values.
			let stays = false;
			let tiresAt = 0;
			if (r >= 0 && this.on[r] === 1) {
				const key = ageBand[i] === 1 && keyRank[i] < this.keyShare[r];
				if (!key && complyRank[i] < this.comply[r]) {
					tiresAt = Math.max(1, this.fatigueMean[r] + fatigueZ[i] * this.fatigueSd[r]) * TICKS_PER_DAY;
					stays = this.ticks[r] <= tiresAt;
				}
			}
			if (stays && (walking[i] === 1 || tick - a.landedTick[i] < radii[r] / a.speed[i])) {
				if (walking[i] === 0) {
					walking[i] = 1;
					const reg = regions[r];
					const d = radii[r] * Math.sqrt(rng.next());
					const t = rng.next() * Math.PI * 2;
					a.goalX[i] = reg.cx + Math.cos(t) * d;
					a.goalY[i] = reg.cy + Math.sin(t) * d;
				}
			} else {
				walking[i] = 0;
				if (stays) a.landedTick[i] = LONG_AGO;
			}
			held[i] = stays && walking[i] === 0 ? 1 : 0;
			contact[i] = stays ? this.heldContact[r] : 1;
			restless[i] = held[i] === 1 && this.ticks[r] > tiresAt - RESTLESS_DAYS * TICKS_PER_DAY ? 1 : 0;
		}
		this.holding = any;
	}
}
