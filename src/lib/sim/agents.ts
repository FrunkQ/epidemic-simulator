import { MAX_AGENTS } from './constants';

/**
 * The dot pool: one fixed set of typed arrays, allocated once (structure of arrays).
 * Slots [0, activeCount) are in use. Movement, age, vaccination level and region are per dot; the
 * dot's people, and their illness, are in People, one per disease (6.12).
 */
/** A landedTick for a dot that hasn't just arrived. */
export const LONG_AGO = -0x40000000;

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
	/**
	 * Drawn once at spawn, uniform 0-1, so lockdown sliders apply live without reshuffling anyone
	 * (6.4): a 15-64 dot is a key worker while keyRank < keyWorkerShare, and anyone else ignores a
	 * lockdown from its first day while complyRank >= lockdownCompliance.
	 */
	readonly keyRank: Float32Array;
	readonly complyRank: Float32Array;
	/**
	 * Drawn once at spawn from its own stream, uniform 0-1 (6.18): a dot that isn't a key worker
	 * stays in out of caution while cautionRank < its city's caution level.
	 */
	readonly cautionRank: Float32Array;
	/**
	 * Where this dot's fatigue point sits in the spread, as a standard normal draw (6.4): it tires
	 * of a lockdown after mean + fatigueZ x spread days, so the fatigue sliders apply live too.
	 */
	readonly fatigueZ: Float32Array;
	/** 1 while a lockdown keeps the dot at home: it doesn't move or travel (lockdown.ts). */
	readonly held: Uint8Array;
	/**
	 * How much of its usual contact with other dots this dot has (1 normally; less while a lockdown
	 * keeps it home, HealthPolicy.lockdownContactCut). A pair's infection chance is scaled by the
	 * smaller of the two, so a pair with someone staying home is cut once, never twice.
	 */
	readonly contact: Float32Array;
	/** Display only: 1 for a held dot within RESTLESS_DAYS of tiring of the lockdown; it jitters (6.4). */
	readonly restless: Uint8Array;
	/**
	 * The tick this dot last arrived from a trip (LONG_AGO if it never has, or once it has walked to
	 * its spot). Every traveller lands at the same point, so a lockdown sends a fresh arrival it would
	 * keep home walking to its own spot first (lockdown.ts), never freezing it in a pile there.
	 */
	readonly landedTick: Int32Array;
	/** 1 while a fresh arrival a lockdown would keep home walks to its spot (goalX, goalY). */
	readonly walking: Uint8Array;
	readonly goalX: Float32Array;
	readonly goalY: Float32Array;
	/** 1 once half or more of the dot's people have died: it stops and is drawn dead. */
	readonly dead: Uint8Array;
	/** 1 while half or more of the dot's people are ill (with any disease): it stops and doesn't travel. */
	readonly ill: Uint8Array;
	readonly region: Int16Array;
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
	 * are infected (or, with none infected, dead); SUSCEPTIBLE means no ring. `shareStep` is how
	 * strongly the ring (or, where rings don't fit, the dot's tint) is drawn: those people as a
	 * share of the dot, 0 to SHARE_STEPS - 1, in even steps up to half. A dot's people live in People.
	 */
	readonly shown: Uint8Array;
	readonly ring: Uint8Array;
	readonly shareStep: Uint8Array;

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
		this.keyRank = new Float32Array(capacity);
		this.complyRank = new Float32Array(capacity);
		this.cautionRank = new Float32Array(capacity);
		this.fatigueZ = new Float32Array(capacity);
		this.held = new Uint8Array(capacity);
		this.contact = new Float32Array(capacity).fill(1);
		this.restless = new Uint8Array(capacity);
		this.landedTick = new Int32Array(capacity).fill(LONG_AGO);
		this.walking = new Uint8Array(capacity);
		this.goalX = new Float32Array(capacity);
		this.goalY = new Float32Array(capacity);
		this.dead = new Uint8Array(capacity);
		this.ill = new Uint8Array(capacity);
		this.region = new Int16Array(capacity);
		this.route = new Int16Array(capacity);
		this.routeS = new Float32Array(capacity);
		this.routeDir = new Int8Array(capacity);
		this.planeOf = new Int16Array(capacity);
		this.shown = new Uint8Array(capacity);
		this.ring = new Uint8Array(capacity);
		this.shareStep = new Uint8Array(capacity);
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
		this.keyRank.fill(0);
		this.complyRank.fill(0);
		this.cautionRank.fill(0);
		this.fatigueZ.fill(0);
		this.held.fill(0);
		this.contact.fill(1);
		this.restless.fill(0);
		this.landedTick.fill(LONG_AGO);
		this.walking.fill(0);
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
		this.shareStep.fill(0);
	}
}
