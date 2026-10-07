import { MAX_AGENTS } from './constants';

/**
 * The dot pool: one fixed set of typed arrays, allocated once (structure of arrays).
 * Slots [0, activeCount) are in use.
 */
export class Agents {
	readonly capacity: number;
	activeCount = 0;

	readonly x: Float32Array;
	readonly y: Float32Array;
	readonly vx: Float32Array;
	readonly vy: Float32Array;
	/** Each dot's own cruising speed, so it can stop and start again. */
	readonly speed: Float32Array;
	readonly state: Uint8Array;
	readonly protection: Uint8Array;
	/** 1 when this dot's vaccine worked, so it cannot catch the disease. */
	readonly vaccineWorks: Uint8Array;
	readonly asymptomatic: Uint8Array;
	readonly isolated: Uint8Array;
	readonly essential: Uint8Array;
	readonly region: Int16Array;
	readonly stateTicks: Int32Array;
	readonly fatigueTicks: Int32Array;
	readonly route: Int16Array;
	readonly routeS: Float32Array;
	readonly routeDir: Int8Array;
	readonly routeSeg: Int16Array;
	readonly infectedTick: Int32Array;
	readonly infectedBy: Int32Array;
	/** Ticks until this dot's protection or immunity fades one step. */
	readonly waneTicks: Int32Array;

	constructor(capacity = MAX_AGENTS) {
		this.capacity = capacity;
		this.x = new Float32Array(capacity);
		this.y = new Float32Array(capacity);
		this.vx = new Float32Array(capacity);
		this.vy = new Float32Array(capacity);
		this.speed = new Float32Array(capacity);
		this.state = new Uint8Array(capacity);
		this.protection = new Uint8Array(capacity);
		this.vaccineWorks = new Uint8Array(capacity);
		this.asymptomatic = new Uint8Array(capacity);
		this.isolated = new Uint8Array(capacity);
		this.essential = new Uint8Array(capacity);
		this.region = new Int16Array(capacity);
		this.stateTicks = new Int32Array(capacity);
		this.fatigueTicks = new Int32Array(capacity);
		this.route = new Int16Array(capacity);
		this.routeS = new Float32Array(capacity);
		this.routeDir = new Int8Array(capacity);
		this.routeSeg = new Int16Array(capacity);
		this.infectedTick = new Int32Array(capacity);
		this.infectedBy = new Int32Array(capacity);
		this.waneTicks = new Int32Array(capacity);
	}

	reset(): void {
		this.activeCount = 0;
		this.state.fill(0);
		this.protection.fill(0);
		this.vaccineWorks.fill(0);
		this.asymptomatic.fill(0);
		this.isolated.fill(0);
		this.essential.fill(0);
		this.region.fill(-1);
		this.stateTicks.fill(0);
		this.route.fill(-1);
		this.routeS.fill(0);
		this.routeDir.fill(0);
		this.routeSeg.fill(0);
		this.infectedTick.fill(-1);
		this.infectedBy.fill(-1);
		this.waneTicks.fill(0);
		this.vx.fill(0);
		this.vy.fill(0);
	}
}
