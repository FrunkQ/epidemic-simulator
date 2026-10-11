import type { Agents } from './agents';
import type { People } from './people';
import { State } from './types';

/**
 * Strength steps for look E, by the share of the dot's people, up to just under half (where it
 * fills). One ladder for the ring and the tint, so a city reads the same in either.
 */
export const SHARE_STEPS = 6;
/**
 * The faintest step (one case) and the strongest (just under half), as shares of the way to the
 * ring colour. The top stays at least ΔE 6 from the solid fill, so the step to solid at half reads.
 */
const STEP_FLOOR = 0.12;
const STEP_TOP = 0.55;
/** A ring is drawn only when it is at least this many device pixels wide. */
const RING_MIN_DEVICE_PX = 2;
/** Ring width as a share of the dot's width: a square frame this wide has about the dot's own area. */
const RING_SHARE = 0.2;

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

/**
 * How wide a ring is, in CSS pixels, around a dot `size` pixels across whose neighbours sit
 * `spacing` pixels apart on average: a fifth of the dot, so the frame's area is about the dot's
 * own. 0 when that is under RING_MIN_DEVICE_PX device pixels or reaches past half the average
 * spacing: the dot is then tinted instead. Spacing is an average, so some rings that fit still
 * reach a close neighbour; the red a city shows stays on target all the same (11 Oct).
 */
export function ringWidth(spacing: number, size: number, dpr: number): number {
	const w = size * RING_SHARE;
	return fits(spacing, size, w, dpr) ? w : 0;
}

/**
 * Whether a mark reaching `reach` CSS pixels beyond a dot `size` pixels across fits the ring
 * rule: at least RING_MIN_DEVICE_PX device pixels, and within half the average spacing.
 */
export function fits(spacing: number, size: number, reach: number, dpr: number): boolean {
	return reach * dpr >= RING_MIN_DEVICE_PX && size / 2 + reach <= spacing / 2;
}

/**
 * How far toward the ring colour each share step goes (finer-counts §5, "follow the share"): a
 * tinted dot's own colour moves this far, and a ring is drawn at this opacity. From a faint mark
 * for one case to well short of the solid fill that half or more of them bring.
 */
export const STEP_STRENGTH = Array.from(
	{ length: SHARE_STEPS },
	(_, k) => STEP_FLOOR + ((STEP_TOP - STEP_FLOOR) * k) / (SHARE_STEPS - 1)
);
