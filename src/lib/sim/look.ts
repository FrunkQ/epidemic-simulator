import type { Agents } from './agents';
import type { People } from './people';
import { State } from './types';

/** Ring brightness steps for look E: few, so the renderer draws each in one batch. */
export const RING_LEVELS = 4;

/**
 * Look E (finer-counts §5): a dot's fill, and a ring that brightens with the people infected (or,
 * with nobody infected, dead) and gives way to a solid fill once they are half the dot. Infected
 * counts silent and ill people together. Sets agents.shown, ring and ringLevel for dot i.
 */
export function setLook(agents: Agents, p: People, i: number): void {
	const n = p.perDot;
	const dead = p.dead[i];
	const ill = p.ill[i];
	const silent = p.silentSymptomatic[i] + p.silentAsymptomatic[i];
	const infected = ill + silent;
	const infectedState = ill >= silent ? State.SYMPTOMATIC : State.SILENT;
	let fill: number = State.SUSCEPTIBLE;
	if (2 * dead >= n) fill = State.DECEASED;
	else if (2 * infected >= n) fill = infectedState;
	else if (2 * p.recovered[i] >= n) fill = State.RECOVERED;
	agents.shown[i] = fill;
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
	agents.ring[i] = ring;
	agents.ringLevel[i] =
		count === 0
			? 0
			: Math.min(RING_LEVELS - 1, Math.floor((RING_LEVELS * Math.log1p(count)) / Math.log1p(n / 2)));
}
