import { Agents, LONG_AGO } from './agents';
import { TICKS_PER_DAY } from './constants';
import { Rng } from './rng';
import type { HealthPolicy, Region } from './types';

/**
 * Why a dot in a locked-down city is out, or that it stays home (6.4): HOME is kept home by the
 * lockdown, CAUTION kept in by caution alone (6.18).
 */
export const Out = { KEY: 0, IGNORING: 1, TIRED: 2, HOME: 3, CAUTION: 4 } as const;
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

/** Whether dot i stays in out of caution at this caution level (6.18): never a key worker. */
export function cautious(a: Agents, i: number, policy: HealthPolicy, caution: number): boolean {
	return !isKeyWorker(a, i, policy) && a.cautionRank[i] < caution;
}

/**
 * Whether a dot stays home in a lockdown that has run `ticks` ticks, and if not, why it is out, in
 * one order (6.4, 6.18): key workers go out; then people the lockdown keeps home; then people kept
 * in by caution alone, at the city's caution level; then people who ignore it from the start, then
 * people who have tired of it.
 */
export function outReason(
	a: Agents,
	i: number,
	policy: HealthPolicy,
	ticks: number,
	caution = 0
): OutReason {
	if (isKeyWorker(a, i, policy)) return Out.KEY;
	const complies = a.complyRank[i] < policy.lockdownCompliance.value;
	if (complies && ticks <= fatigueDays(a, i, policy) * TICKS_PER_DAY) return Out.HOME;
	if (a.cautionRank[i] < caution) return Out.CAUTION;
	return complies ? Out.TIRED : Out.IGNORING;
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
 *
 * Caution (6.18) works the same way in every city, locked or not: a dot that isn't a key worker
 * with cautionRank < the city's caution level stays home too, with the caution contact (once, not
 * on top of the lockdown's). The level is the city's cautionShare x `signal`, the deaths signal the
 * engine sets once a day, so a slider change applies at the next tick. Caution never tires, so only
 * a dot the lockdown holds that isn't also cautious shakes. With every level at 0 nothing is drawn.
 */
export class Lockdown {
	readonly on: Uint8Array;
	readonly ticks: Int32Array;
	/** Each city's deaths signal, D / (D + D half), 0 to 1, set by the engine at each day boundary (6.18). */
	readonly signal: Float64Array;
	/** Each city's caution level this tick: cautionShare x signal. */
	readonly caution: Float64Array;
	/** Whether any dot may be held, so a run with no lockdown never scans the dots. */
	private holding = false;
	/** Each city's policy values for this tick, read once rather than per dot. */
	private readonly keyShare: Float64Array;
	private readonly comply: Float64Array;
	private readonly fatigueMean: Float64Array;
	private readonly fatigueSd: Float64Array;
	private readonly heldContact: Float64Array;
	private readonly cautionContact: Float64Array;

	constructor(regionCount: number) {
		this.on = new Uint8Array(regionCount);
		this.ticks = new Int32Array(regionCount);
		this.signal = new Float64Array(regionCount);
		this.caution = new Float64Array(regionCount);
		this.cautionContact = new Float64Array(regionCount);
		this.keyShare = new Float64Array(regionCount);
		this.comply = new Float64Array(regionCount);
		this.fatigueMean = new Float64Array(regionCount);
		this.fatigueSd = new Float64Array(regionCount);
		this.heldContact = new Float64Array(regionCount);
	}

	reset(): void {
		this.on.fill(0);
		this.ticks.fill(0);
		this.signal.fill(0);
		this.caution.fill(0);
		this.holding = false;
	}

	advance(a: Agents, regions: Region[], radii: Float32Array, tick: number, rng: Rng): void {
		let any = false;
		for (let r = 0; r < regions.length; r++) {
			if (this.on[r] === 1) {
				this.ticks[r]++;
				any = true;
			} else if (this.ticks[r] > 0) this.ticks[r]--;
			const c = this.signal[r] > 0 ? regions[r].policy.cautionShare.value * this.signal[r] : 0;
			this.caution[r] = c;
			if (c > 0) any = true;
		}
		if (!any && !this.holding) return;
		for (let r = 0; r < regions.length; r++) {
			const p = regions[r].policy;
			this.cautionContact[r] = 1 - p.cautionContactCut.value;
			this.keyShare[r] = p.keyWorkerShare.value;
			this.comply[r] = p.lockdownCompliance.value;
			this.fatigueMean[r] = p.lockdownFatigueMeanDays.value;
			this.fatigueSd[r] = p.lockdownFatigueSdDays.value;
			this.heldContact[r] = 1 - p.lockdownContactCut.value;
		}
		const { held, region, contact, restless, walking, ageBand, keyRank, complyRank, cautionRank, fatigueZ } =
			a;
		for (let i = 0; i < a.activeCount; i++) {
			const r = region[i];
			// outReason and fatigueDays, worked out here from the hoisted values.
			let locked = false;
			let wary = false;
			let tiresAt = 0;
			if (r >= 0) {
				const key = ageBand[i] === 1 && keyRank[i] < this.keyShare[r];
				if (!key && this.on[r] === 1 && complyRank[i] < this.comply[r]) {
					tiresAt = Math.max(1, this.fatigueMean[r] + fatigueZ[i] * this.fatigueSd[r]) * TICKS_PER_DAY;
					locked = this.ticks[r] <= tiresAt;
				}
				wary = !key && !locked && cautionRank[i] < this.caution[r];
			}
			const stays = locked || wary;
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
			contact[i] = locked ? this.heldContact[r] : wary ? this.cautionContact[r] : 1;
			// Only a dot the lockdown holds can tire of it; one that is also cautious stays in anyway.
			const alsoWary = locked && cautionRank[i] < this.caution[r];
			restless[i] =
				held[i] === 1 && locked && !alsoWary && this.ticks[r] > tiresAt - RESTLESS_DAYS * TICKS_PER_DAY
					? 1
					: 0;
		}
		this.holding = any;
	}
}
