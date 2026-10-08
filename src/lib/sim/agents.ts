import { MAX_AGENTS, MAX_DISEASES } from './constants';
import { State } from './types';

/**
 * The dot pool: one fixed set of typed arrays, allocated once (structure of arrays).
 * Slots [0, activeCount) are in use.
 *
 * Illness arrays are per disease (6.12): MAX_DISEASES blocks of `capacity`, so disease slot s of
 * dot i is at `s * capacity + i` (`offset(s) + i`). Slot 0 is the first block, so code that only
 * knows one disease can index slot 0 with `i` alone. Movement, age and region are per dot.
 */
export class Agents {
	readonly capacity: number;
	activeCount = 0;
	/** Diseases circulating in this run (1 until step 3c). */
	diseaseCount = 1;

	readonly x: Float32Array;
	readonly y: Float32Array;
	readonly vx: Float32Array;
	readonly vy: Float32Array;
	/** Each dot's own cruising speed, so it can stop and start again. */
	readonly speed: Float32Array;
	readonly protection: Uint8Array;
	/** 0 = aged 0-14, 1 = 15-64, 2 = 65+, drawn at spawn from the region's age mix. */
	readonly ageBand: Uint8Array;
	readonly isolated: Uint8Array;
	readonly essential: Uint8Array;
	/** 1 once the dot has died of any disease. */
	readonly dead: Uint8Array;
	/** 1 while the dot has symptoms of any disease, so it stops moving and doesn't travel. */
	readonly ill: Uint8Array;
	readonly region: Int16Array;
	readonly fatigueTicks: Int32Array;
	readonly route: Int16Array;
	readonly routeS: Float32Array;
	readonly routeDir: Int8Array;
	/** The plane an air traveller rides in, or -1. */
	readonly planeOf: Int16Array;

	// Per disease slot (MAX_DISEASES x capacity).
	readonly state: Uint8Array;
	readonly stateTicks: Int32Array;
	readonly asymptomatic: Uint8Array;
	/** 1 when this dot's vaccine against this disease works, so it cannot catch it. */
	readonly vaccineWorks: Uint8Array;
	/** Ticks until this dot's vaccine protection or immunity fades; -1 when it won't. */
	readonly waneTicks: Int32Array;
	readonly infectedTick: Int32Array;
	/** Who infected this dot (-1 for none or an index case), so the wizard can draw the chain. */
	readonly infectedBy: Int32Array;
	/** Protection against severe illness if this dot is infected despite its vaccine (6.2), 0 to 1. */
	readonly severe: Float32Array;
	/**
	 * Hospital beds this case fills while it has symptoms, in dots: its band's share needing a bed,
	 * cut by its severe protection (6.6). A dot stands for many people, so this is the expected
	 * share of them in a bed, not a draw; 0 when not ill or when hospitals are switched off.
	 */
	readonly bedNeed: Float32Array;

	constructor(capacity = MAX_AGENTS) {
		this.capacity = capacity;
		const perSlot = capacity * MAX_DISEASES;
		this.x = new Float32Array(capacity);
		this.y = new Float32Array(capacity);
		this.vx = new Float32Array(capacity);
		this.vy = new Float32Array(capacity);
		this.speed = new Float32Array(capacity);
		this.protection = new Uint8Array(capacity);
		this.ageBand = new Uint8Array(capacity);
		this.isolated = new Uint8Array(capacity);
		this.essential = new Uint8Array(capacity);
		this.dead = new Uint8Array(capacity);
		this.ill = new Uint8Array(capacity);
		this.region = new Int16Array(capacity);
		this.fatigueTicks = new Int32Array(capacity);
		this.route = new Int16Array(capacity);
		this.routeS = new Float32Array(capacity);
		this.routeDir = new Int8Array(capacity);
		this.planeOf = new Int16Array(capacity);
		this.state = new Uint8Array(perSlot);
		this.stateTicks = new Int32Array(perSlot);
		this.asymptomatic = new Uint8Array(perSlot);
		this.vaccineWorks = new Uint8Array(perSlot);
		this.waneTicks = new Int32Array(perSlot);
		this.infectedTick = new Int32Array(perSlot);
		this.infectedBy = new Int32Array(perSlot);
		this.severe = new Float32Array(perSlot);
		this.bedNeed = new Float32Array(perSlot);
	}

	/**
	 * The state a dot is shown in: the most serious across its diseases (8): dead, then ill, then
	 * silent, then recovered, else susceptible.
	 */
	displayState(i: number): number {
		if (this.dead[i] === 1) return State.DECEASED;
		let best: number = State.SUSCEPTIBLE;
		for (let s = 0; s < this.diseaseCount; s++) {
			const v = this.state[s * this.capacity + i];
			if (v === State.SYMPTOMATIC) return v;
			if (v === State.SILENT || (v === State.RECOVERED && best === State.SUSCEPTIBLE)) best = v;
		}
		return best;
	}

	/** Start of disease slot s in the per-disease arrays. */
	offset(slot: number): number {
		return slot * this.capacity;
	}

	reset(): void {
		this.activeCount = 0;
		this.protection.fill(0);
		this.ageBand.fill(0);
		this.isolated.fill(0);
		this.essential.fill(0);
		this.dead.fill(0);
		this.ill.fill(0);
		this.region.fill(-1);
		this.route.fill(-1);
		this.routeS.fill(0);
		this.routeDir.fill(0);
		this.planeOf.fill(-1);
		this.vx.fill(0);
		this.vy.fill(0);
		this.state.fill(0);
		this.stateTicks.fill(0);
		this.asymptomatic.fill(0);
		this.vaccineWorks.fill(0);
		this.waneTicks.fill(-1);
		this.infectedTick.fill(-1);
		this.infectedBy.fill(-1);
		this.severe.fill(0);
		this.bedNeed.fill(0);
	}
}
