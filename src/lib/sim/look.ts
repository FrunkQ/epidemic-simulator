import type { Agents } from './agents';
import type { People } from './people';
import { State } from './types';

/**
 * Each dot's shown state, kept by the engine as its people change: what half or more of its people
 * are, and whether some are infected (or dead). The map views (specks.ts) draw from People itself;
 * the seed marker reads these to know when a seeded dot has nobody infected. `step` is the share
 * of those people in SHARE_STEPS even steps up to half (look E's ladder, kept with its tests).
 */
export const SHARE_STEPS = 6;

/** How one dot looks: its fill, and the ring (or tint) marking some of its people. */
export interface Look {
	/** The state the dot is filled with; SUSCEPTIBLE means its vaccination colour. */
	fill: number;
	/** SILENT or SYMPTOMATIC when some are infected, DECEASED when some died and none are infected, else SUSCEPTIBLE (none). */
	ring: number;
	/** 0 to SHARE_STEPS - 1: those people as a share of the dot, in even steps up to half. */
	step: number;
}

/**
 * Look E (finer-counts §5) for a dot of `n` people: filled dead, infected (silent and ill
 * together; red when ill are at least as many as silent) or recovered once half or more of its
 * people are; otherwise its vaccination colour. A dot not filled dead or infected is ringed in the
 * infected colour when anyone is infected, else in grey when anyone has died.
 */
export function lookOf(n: number, dead: number, ill: number, silent: number, recovered: number): Look {
	const out = { fill: 0, ring: 0, step: 0 };
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
	out.step = count === 0 ? 0 : Math.min(SHARE_STEPS - 1, Math.floor((2 * SHARE_STEPS * count) / n));
}

const scratch: Look = { fill: 0, ring: 0, step: 0 };

/** Sets agents.shown, ring and shareStep for dot i from its people. */
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
	agents.shareStep[i] = scratch.step;
}
