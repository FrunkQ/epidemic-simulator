import { Agents } from './agents';
import { TICKS_PER_DAY } from './constants';
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
 * held dot's share of its usual contact with other dots.
 */
export class Lockdown {
	readonly on: Uint8Array;
	readonly ticks: Int32Array;
	/** Whether any dot may be held, so a run with no lockdown never scans the dots. */
	private holding = false;

	constructor(regionCount: number) {
		this.on = new Uint8Array(regionCount);
		this.ticks = new Int32Array(regionCount);
	}

	reset(): void {
		this.on.fill(0);
		this.ticks.fill(0);
		this.holding = false;
	}

	advance(a: Agents, regions: Region[]): void {
		let any = false;
		for (let r = 0; r < regions.length; r++) {
			if (this.on[r] === 1) {
				this.ticks[r]++;
				any = true;
			} else if (this.ticks[r] > 0) this.ticks[r]--;
		}
		if (!any && !this.holding) return;
		const { held, region, contact, restless } = a;
		for (let i = 0; i < a.activeCount; i++) {
			const r = region[i];
			const policy = r >= 0 ? regions[r].policy : null;
			held[i] = policy && this.on[r] === 1 && outReason(a, i, policy, this.ticks[r]) === Out.HOME ? 1 : 0;
			contact[i] = held[i] === 1 ? 1 - policy!.lockdownContactCut.value : 1;
			restless[i] =
				held[i] === 1 && this.ticks[r] > (fatigueDays(a, i, policy!) - RESTLESS_DAYS) * TICKS_PER_DAY ? 1 : 0;
		}
		this.holding = any;
	}
}
