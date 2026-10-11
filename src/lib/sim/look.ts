import type { Agents } from './agents';
import type { People } from './people';
import { State } from './types';

/** Ring brightness steps for look E: few, so the renderer draws each in one batch. */
export const RING_LEVELS = 4;
/** Tint steps, by the share of the dot's people, up to just under half (where it fills). */
export const TINT_STEPS = 6;
/** The faintest tint (one case) and the strongest (just under half), as shares of the way to the ring colour. */
const TINT_FLOOR = 0.12;
const TINT_TOP = 0.8;

/** How one dot looks: its fill, and the ring (or tint) marking some of its people. */
export interface Look {
	/** The state the dot is filled with; SUSCEPTIBLE means its vaccination colour. */
	fill: number;
	/** SILENT or SYMPTOMATIC when some are infected, DECEASED when some died and none are infected, else SUSCEPTIBLE (none). */
	ring: number;
	/** 0 to RING_LEVELS - 1: how many of the dot's people the ring stands for, on a log scale up to half the dot. */
	level: number;
	/** 0 to TINT_STEPS - 1: the same people as a share of the dot, in even steps up to half, for the tint. */
	tint: number;
}

/**
 * Look E (finer-counts §5) for a dot of `n` people: filled dead, infected (silent and ill
 * together; red when ill are at least as many as silent) or recovered once half or more of its
 * people are; otherwise its vaccination colour. A dot not filled dead or infected is ringed in the
 * infected colour when anyone is infected, else in grey when anyone has died.
 */
export function lookOf(n: number, dead: number, ill: number, silent: number, recovered: number): Look {
	const out = { fill: 0, ring: 0, level: 0, tint: 0 };
	writeLook(n, dead, ill, silent, recovered, out);
	return out;
}

/** lookOf without allocating: the engine calls it for every active dot every tick. */
function writeLook(n: number, dead: number, ill: number, silent: number, recovered: number, out: Look): void {
	const infected = ill + silent;
	const infectedState = ill >= silent ? State.SYMPTOMATIC : State.SILENT;
	let fill: number = State.SUSCEPTIBLE;
	if (2 * dead >= n) fill = State.DECEASED;
	else if (2 * infected >= n) fill = infectedState;
	else if (2 * recovered >= n) fill = State.RECOVERED;
	let ring: number = State.SUSCEPTIBLE;
	let count = 0;
	if (fill !== State.DECEASED && fill !== State.SILENT && fill !== State.SYMPTOMATIC) {
		if (infected > 0) {
			ring = infectedState;
			count = infected;
		} else if (dead > 0) {
			ring = State.DECEASED;
			count = dead;
		}
	}
	out.fill = fill;
	out.ring = ring;
	out.level = count === 0 ? 0 : levelsFor(n)[Math.min(count, n)];
	out.tint = count === 0 ? 0 : Math.min(TINT_STEPS - 1, Math.floor((2 * TINT_STEPS * count) / n));
}

/** Ring level by people counted, for dots of n people (worked out once per dot size). */
let levelsN = -1;
let levels = new Uint8Array(0);
function levelsFor(n: number): Uint8Array {
	if (n !== levelsN) {
		levelsN = n;
		levels = new Uint8Array(n + 1);
		const top = Math.log1p(n / 2);
		for (let k = 1; k <= n; k++)
			levels[k] = Math.min(RING_LEVELS - 1, Math.floor((RING_LEVELS * Math.log1p(k)) / top));
	}
	return levels;
}

const scratch: Look = { fill: 0, ring: 0, level: 0, tint: 0 };

/** Sets agents.shown, ring and ringLevel for dot i from its people. */
export function setLook(agents: Agents, p: People, i: number): void {
	writeLook(
		p.perDot,
		p.dead[i],
		p.ill[i],
		p.silentSymptomatic[i] + p.silentAsymptomatic[i],
		p.recovered[i],
		scratch
	);
	agents.shown[i] = scratch.fill;
	agents.ring[i] = scratch.ring;
	agents.ringLevel[i] = scratch.level;
	agents.tintStep[i] = scratch.tint;
}

/**
 * How wide a ring may be, in CSS pixels, around a dot `size` pixels across whose neighbours sit
 * `spacing` pixels apart on average: its outer edge stays within half the spacing, so it never
 * covers or merges with a neighbour. 0 when that leaves under one device pixel: the dot is then
 * tinted instead.
 */
export function ringWidth(spacing: number, size: number, dpr: number): number {
	const room = spacing / 2 - size / 2;
	// A ring a little under half the dot's width, so its area stays near the dot's own.
	const w = Math.min(size * 0.4, room);
	return w * dpr >= 1 ? w : 0;
}

/**
 * How far a tinted dot's own colour moves toward the ring colour, per tint step: it follows the
 * share of its people (finer-counts §5, "follow the share"), from a faint mark for one case to
 * well short of the solid fill that half or more of them bring.
 */
export const TINT = Array.from(
	{ length: TINT_STEPS },
	(_, k) => TINT_FLOOR + ((TINT_TOP - TINT_FLOOR) * k) / (TINT_STEPS - 1)
);
