import { MAX_AGENTS } from './constants';

/**
 * The dot pool: one fixed set of typed arrays, allocated once (structure of arrays).
 * Slots [0, activeCount) are in use. Movement, age, vaccination level and region are per dot; the
 * dot's people, and their illness, are in People, one per disease (6.12).
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
	/** 1 once half or more of the dot's people have died: it stops and is drawn dead. */
	readonly dead: Uint8Array;
	/** 1 while half or more of the dot's people are ill (with any disease): it stops and doesn't travel. */
	readonly ill: Uint8Array;
	readonly region: Int16Array;
	readonly fatigueTicks: Int32Array;
	readonly route: Int16Array;
	readonly routeS: Float32Array;
	readonly routeDir: Int8Array;
	/** The plane an air traveller rides in, or -1. */
	readonly planeOf: Int16Array;

	/**
	 * How a dot is drawn (look E, finer-counts §5), set by the engine whenever its people change.
	 * `shown` is its fill (a State): dead, infected (silent or ill, whichever is more) or recovered
	 * when half or more of its people are, otherwise SUSCEPTIBLE, drawn in its vaccination colour.
	 * `ring` is the State of a ring around a dot that isn't filled that way, when some of its people
	 * are infected (or, with none infected, dead); SUSCEPTIBLE means no ring. `ringLevel` is how
	 * bright the ring is, 0 to RING_LEVELS - 1, on a log scale of those people, so one person is
	 * faint and half the dot is full. A dot's people live in People.
	 */
	readonly shown: Uint8Array;
	readonly ring: Uint8Array;
	readonly ringLevel: Uint8Array;

	constructor(capacity = MAX_AGENTS) {
		this.capacity = capacity;
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
		this.shown = new Uint8Array(capacity);
		this.ring = new Uint8Array(capacity);
		this.ringLevel = new Uint8Array(capacity);
	}

	/** The state a dot is shown in (see `shown`). */
	displayState(i: number): number {
		return this.shown[i];
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
		this.shown.fill(0);
		this.ring.fill(0);
		this.ringLevel.fill(0);
	}
}
