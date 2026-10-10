import type { Agents } from './agents';
import type { People } from './people';
import { State } from './types';

/** Ring (or tint) strength steps for look E: few, so the renderer draws each in one batch. */
export const RING_LEVELS = 4;

/** How one dot looks: its fill, and the ring (or tint) marking some of its people. */
export interface Look {
	/** The state the dot is filled with; SUSCEPTIBLE means its vaccination colour. */
	fill: number;
	/** SILENT or SYMPTOMATIC when some are infected, DECEASED when some died and none are infected, else SUSCEPTIBLE (none). */
	ring: number;
	/** 0 to RING_LEVELS - 1: how many of the dot's people the ring stands for, on a log scale up to half the dot. */
	level: number;
}

/**
 * Look E (finer-counts §5) for a dot of `n` people: filled dead, infected (silent and ill
 * together; red when ill are at least as many as silent) or recovered once half or more of its
 * people are; otherwise its vaccination colour. A dot not filled dead or infected is ringed in the
 * infected colour when anyone is infected, else in grey when anyone has died.
 */
export function lookOf(n: number, dead: number, ill: number, silent: number, recovered: number): Look {
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
	const level =
		count === 0
			? 0
			: Math.min(RING_LEVELS - 1, Math.floor((RING_LEVELS * Math.log1p(count)) / Math.log1p(n / 2)));
	return { fill, ring, level };
}

/** Sets agents.shown, ring and ringLevel for dot i from its people. */
export function setLook(agents: Agents, p: People, i: number): void {
	const l = lookOf(
		p.perDot,
		p.dead[i],
		p.ill[i],
		p.silentSymptomatic[i] + p.silentAsymptomatic[i],
		p.recovered[i]
	);
	agents.shown[i] = l.fill;
	agents.ring[i] = l.ring;
	agents.ringLevel[i] = l.level;
}

/**
 * How wide a ring may be, in CSS pixels, around a dot `size` pixels across whose neighbours sit
 * `spacing` pixels apart on average: its outer edge stays within half the spacing, so it never
 * covers or merges with a neighbour. 0 when that leaves under one device pixel: the dot is then
 * tinted instead.
 */
export function ringWidth(spacing: number, size: number, dpr: number): number {
	const room = spacing / 2 - size / 2;
	const w = Math.min(Math.max(1, size * 0.4), room);
	return w * dpr >= 1 ? w : 0;
}

/**
 * A tinted dot's colour per level: this share of the way from the dark disc to the ring colour.
 * The lowest stands apart from every plain dot colour; the top stays short of a solid fill.
 */
export const TINT = [0.45, 0.55, 0.65, 0.75] as const;
