import { describe, expect, it } from 'vitest';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { Exposure, transmit } from '../../src/lib/sim/disease';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import { isKeyWorker, lockdownGroup, Out, outReason } from '../../src/lib/sim/lockdown';
import type { SpatialGrid } from '../../src/lib/sim/grid';
import type { PeopleHooks } from '../../src/lib/sim/people';
import type { Rng } from '../../src/lib/sim/rng';
import type { Scenario } from '../../src/lib/sim/types';

/*
 * The lockdown's mechanics, pinned one by one (6.4): the contact cut on a pair, who may move or
 * leave, where arrivals stop, person-days, the ill-stop share and the key-worker cohort. These read
 * engine internals where a lesson never would, since each checks one rule exactly.
 */

const INDEX_CASES = 200;

interface Internals {
	grid: SpatialGrid;
	hooks: PeopleHooks;
	cohort: Uint8Array;
	caughtAtLock: Int32Array;
	readyToBoard: (i: number) => boolean;
}
const inside = (sim: Simulation) => sim as unknown as Internals;

/**
 * City `c`'s key-worker chart worked out again from its parts, before the clamp at 0: each group's
 * rise in people who have caught it since the stamp, and its people.
 */
function cohortRises(sim: Simulation, c: number) {
	const a = sim.agents;
	const p = sim.people;
	const policy = microcosm(0).regions[c].policy;
	const { cohort, caughtAtLock } = inside(sim);
	const key = { rise: 0, people: 0 };
	const home = { rise: 0, people: 0 };
	for (let i = 0; i < a.activeCount; i++) {
		if (cohort[c * a.capacity + i] === 0 || a.ageBand[i] !== 1) continue;
		const rise = p.everCaught(i) - caughtAtLock[c * a.capacity + i];
		const group =
			a.keyRank[i] < policy.keyWorkerShare.value
				? key
				: a.complyRank[i] < policy.lockdownCompliance.value
					? home
					: null;
		if (!group) continue;
		group.rise += rise;
		group.people += p.perDot;
	}
	return { key, home };
}

/** The 3-city map with every city's travel scaled by `travel`. */
function travelling(travel: number): Scenario {
	const scenario = microcosm(0);
	for (const region of scenario.regions) {
		const p = region.policy;
		region.policy = { ...p, travelFrequency: { ...p.travelFrequency, value: travel } };
	}
	return scenario;
}

describe('the contact cut', () => {
	it.each([false, true])(
		'a pair with someone staying home is cut once by exactly (1 − cut), and two movers not at all (secondary counts: %s)',
		(secondaryOnly) => {
			const sim = createSimulation(microcosm(0), { seed: 4, diseaseId: 'covid19', secondaryOnly });
			sim.seedNow(0, INDEX_CASES);
			sim.step(8 * TICKS_PER_DAY);
			const a = sim.agents;
			const p = sim.people;
			const cut = microcosm(0).regions[0].policy.lockdownContactCut.value;
			// Every third dot as if kept home, so pairs of two held dots, one and none all occur.
			for (let i = 0; i < a.activeCount; i++) a.contact[i] = i % 3 === 0 ? 1 - cut : 1;
			const reach = p.disease.transmissionRadius ** 2;
			const logq = Math.log(1 - Math.min(p.disease.beta, 0.999999) / p.perDot);
			const pairs: number[] = [];
			const byDot = new Map<number, number>();
			for (let k = 0; k < p.activeCount; k++) {
				const j = p.active[k];
				if (a.region[j] < 0) continue;
				const n = p.infectious(j, true);
				if (n <= 0) continue;
				for (let i = 0; i < a.activeCount; i++) {
					if (i === j || a.region[i] !== a.region[j] || p.catchable(i) === 0) continue;
					if ((a.x[i] - a.x[j]) ** 2 + (a.y[i] - a.y[j]) ** 2 > reach) continue;
					const factor = a.contact[i] < 1 || a.contact[j] < 1 ? 1 - cut : 1;
					pairs.push(n * logq * factor);
					byDot.set(i, (byDot.get(i) ?? 0) + n * logq * factor);
				}
			}
			const seen: number[] = [];
			const rng = {
				binomialEscape: (_n: number, logEscape: number) => (seen.push(logEscape), 0),
				binomial: (_n: number, chance: number) => (seen.push(Math.log(1 - chance)), 0)
			} as unknown as Rng;
			const { grid, hooks } = inside(sim);
			transmit(a, grid, [p], [new Exposure(a.capacity)], 0, rng, [hooks], true);
			const want = (secondaryOnly ? pairs : [...byDot.values()]).sort((x, y) => x - y);
			seen.sort((x, y) => x - y);
			expect(want.length).toBeGreaterThan(100);
			expect(seen.length).toBe(want.length);
			for (let k = 0; k < want.length; k++) expect(seen[k]).toBeCloseTo(want[k], 9);
		}
	);
});

describe('dots kept home', () => {
	it('never move or leave, and arrivals walking to their spot never leave either', () => {
		const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
		for (let r = 0; r < 3; r++) sim.seedNow(r, INDEX_CASES);
		sim.step(3 * TICKS_PER_DAY);
		for (let r = 0; r < 3; r++) sim.send({ type: 'lockdown', region: r, on: true });
		const a = sim.agents;
		let held = 0;
		let walked = 0;
		for (let t = 0; t < 20 * TICKS_PER_DAY; t++) {
			const x = a.x.slice(0, a.activeCount);
			const y = a.y.slice(0, a.activeCount);
			const region = a.region.slice(0, a.activeCount);
			sim.step(1);
			for (let i = 0; i < a.activeCount; i++) {
				if (a.held[i] === 1) {
					held++;
					expect(a.region[i]).toBe(region[i]);
					expect(a.x[i]).toBe(x[i]);
					expect(a.y[i]).toBe(y[i]);
				} else if (a.walking[i] === 1) {
					walked++;
					expect(a.region[i]).toBe(region[i]);
				}
			}
		}
		expect(held).toBeGreaterThan(0);
		expect(walked).toBeGreaterThan(0);
	});

	it('never pile up where travellers land: arrivals walk to a spot of their own first', () => {
		// One city locked, so travellers from the others keep arriving into it.
		const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
		sim.send({ type: 'lockdown', region: 0, on: true });
		const a = sim.agents;
		let most = 0;
		for (let d = 0; d < 60; d += 2) {
			sim.step(2 * TICKS_PER_DAY);
			// Held dots counted in cells a tenth of a world unit across: a landing pile shares one.
			const cells = new Map<string, number>();
			for (let i = 0; i < a.activeCount; i++) {
				if (a.held[i] === 0) continue;
				const key = `${Math.round(a.x[i] * 10)},${Math.round(a.y[i] * 10)}`;
				cells.set(key, (cells.get(key) ?? 0) + 1);
			}
			for (const n of cells.values()) most = Math.max(most, n);
		}
		expect(most).toBeLessThanOrEqual(2);
	});
});

it("person-days add up the living people in a locked city's dots, not travellers, each locked day", () => {
	const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(5 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	const a = sim.agents;
	const p = sim.people;
	let ledger = 0;
	let travellers = 0;
	let dead = 0;
	for (let d = 0; d < 60; d++) {
		if (d === 30) sim.send({ type: 'lockdown', region: 0, on: false });
		if (d === 40) sim.send({ type: 'lockdown', region: 0, on: true });
		sim.step(TICKS_PER_DAY);
		const r = sim.snapshot().regions[0];
		if (r.lockedDown)
			for (let i = 0; i < a.activeCount; i++) {
				if (a.region[i] === 0) ledger += p.perDot - p.dead[i];
				else if (a.route[i] >= 0) travellers++;
			}
		expect(r.personDays).toBe(ledger);
		if (r.lockedDown) for (let i = 0; i < a.activeCount; i++) if (a.region[i] === 0) dead += p.dead[i];
	}
	expect(ledger).toBeGreaterThan(0);
	expect(travellers).toBeGreaterThan(0);
	// People died in the locked city, so counting the dead would show.
	expect(dead).toBeGreaterThan(0);
});

it.each([0.2, 0.5])(
	'a dot stops for illness once %s of its people are ill (Scenario.illStopShare)',
	(share) => {
		const sim = createSimulation({ ...microcosm(0), illStopShare: share }, { seed: 2, diseaseId: 'covid19' });
		sim.seedNow(0, INDEX_CASES);
		const a = sim.agents;
		const p = sim.people;
		let between = 0;
		for (let d = 0; d < 40; d++) {
			sim.step(TICKS_PER_DAY);
			for (let i = 0; i < a.activeCount; i++) {
				const ill = p.ill[i];
				expect(a.ill[i]).toBe(ill > 0 && ill >= share * p.perDot ? 1 : 0);
				if (a.ill[i] === 1 && ill < 0.5 * p.perDot) between++;
			}
		}
		if (share < 0.5) expect(between).toBeGreaterThan(0);
	}
);

describe('the key-worker cohort', () => {
	it('is the dots in the city when its lockdown began, never the travellers away', () => {
		const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
		sim.step(10 * TICKS_PER_DAY);
		const a = sim.agents;
		// The command applies at the start of the next tick, before anyone leaves or arrives.
		const region = a.region.slice(0, a.activeCount);
		sim.send({ type: 'lockdown', region: 0, on: true });
		sim.step(1);
		const { cohort } = inside(sim);
		let away = 0;
		for (let i = 0; i < a.activeCount; i++) {
			expect(cohort[i]).toBe(region[i] === 0 ? 1 : 0);
			if (region[i] < 0) away++;
		}
		expect(away).toBeGreaterThan(0);
	});

	it('is not stamped again by a second "on" while the city is still locked down', () => {
		const run = (twice: boolean) => {
			const sim = createSimulation(microcosm(0), { seed: 2, diseaseId: 'covid19' });
			sim.seedNow(0, INDEX_CASES);
			sim.step(5 * TICKS_PER_DAY);
			sim.send({ type: 'lockdown', region: 0, on: true });
			sim.step(15 * TICKS_PER_DAY);
			if (twice) sim.send({ type: 'lockdown', region: 0, on: true });
			sim.step(10 * TICKS_PER_DAY);
			return sim.snapshot().regions[0];
		};
		const once = run(false);
		expect(once.keyWorkersCaught).toBeGreaterThan(0);
		expect(run(true)).toEqual(once);
	});
});

describe('who stays home', () => {
	it('key workers are never held and are all working age; some tire once the fatigue mean has passed; a lift clears every hold', () => {
		const sim = createSimulation(microcosm(0), { seed: 2, diseaseId: 'covid19' });
		sim.seedNow(0, INDEX_CASES);
		sim.send({ type: 'lockdown', region: 0, on: true });
		const a = sim.agents;
		const policy = microcosm(0).regions[0].policy;
		const meanDays = policy.lockdownFatigueMeanDays.value;
		let keyWorkers = 0;
		let tired = 0;
		for (let d = 0; d < meanDays + 20; d++) {
			sim.step(TICKS_PER_DAY);
			for (let i = 0; i < a.activeCount; i++) {
				if (a.region[i] !== 0) continue;
				if (isKeyWorker(a, i, policy)) {
					keyWorkers++;
					expect(a.held[i]).toBe(0);
					expect(a.ageBand[i]).toBe(1);
				}
			}
			if (d > meanDays) tired = Math.max(tired, sim.snapshot().regions[0].out.tired);
		}
		expect(keyWorkers).toBeGreaterThan(0);
		expect(tired).toBeGreaterThan(0);
		// Some dots of other ages exist whose key rank is under the share: they are not key workers.
		let young = 0;
		for (let i = 0; i < a.activeCount; i++)
			if (a.ageBand[i] !== 1 && a.keyRank[i] < policy.keyWorkerShare.value) {
				young++;
				expect(isKeyWorker(a, i, policy)).toBe(false);
			}
		expect(young).toBeGreaterThan(0);
		expect(a.held.some((h) => h === 1)).toBe(true);
		sim.send({ type: 'lockdown', region: 0, on: false });
		sim.step(1);
		for (let i = 0; i < a.activeCount; i++) {
			expect(a.held[i]).toBe(0);
			expect(a.contact[i]).toBe(1);
		}
	});
});

it.each(['covid19omicron', 'flu'] as const)(
	'people who have caught it never fall in a dot as immunity wanes, and add up to everyone ever infected (%s)',
	(diseaseId) => {
		// With vaccinated people, so a count that left out vaccine immunity would show.
		const scenario = singleCity({ population: 200_000, vaccinatedFull: 0.4, vaccinatedPartial: 0.1 });
		const sim = createSimulation(scenario, { seed: 2, diseaseId });
		sim.seedNow(0, INDEX_CASES);
		const a = sim.agents;
		const p = sim.people;
		const last = new Int32Array(a.activeCount);
		let waned = 0;
		for (let d = 0; d < 365; d++) {
			sim.step(TICKS_PER_DAY);
			let sum = 0;
			for (let i = 0; i < a.activeCount; i++) {
				const n = p.everCaught(i);
				expect(n).toBeGreaterThanOrEqual(last[i]);
				last[i] = n;
				sum += n;
				waned += p.susceptibleAgain[i];
			}
			expect(sum).toBe(sim.everInfectedByAge(0).reduce((s, n) => s + n, 0));
		}
		// Immunity did wane back to catchable, so a tally that lost those people would show.
		expect(waned).toBeGreaterThan(0);
	},
	600_000
);

it('walkers on their way home and held dots have the held contact; everyone kept home is exactly who outReason says', () => {
	const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(3 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	const a = sim.agents;
	const policy = microcosm(0).regions[0].policy;
	const cut = policy.lockdownContactCut.value;
	let walkers = 0;
	for (let t = 0; t < 80 * TICKS_PER_DAY; t += 7) {
		sim.step(7);
		const inner = sim as unknown as { lockdown: { ticks: Int32Array }; tick: number };
		const ticks = inner.lockdown.ticks[0];
		for (let i = 0; i < a.activeCount; i++) {
			// Who stays home is worked out at the start of the tick, before this tick's arrivals land.
			if (a.landedTick[i] === inner.tick) continue;
			const home = a.region[i] === 0 && outReason(a, i, policy, ticks) === Out.HOME;
			// A walker that reached its spot this tick is held from the next one.
			const reached = a.held[i] === 0 && a.x[i] === a.goalX[i] && a.y[i] === a.goalY[i];
			if (!reached) expect(a.held[i] + a.walking[i]).toBe(home ? 1 : 0);
			expect(a.contact[i]).toBeCloseTo(home ? 1 - cut : 1, 6);
			walkers += a.walking[i];
		}
	}
	expect(walkers).toBeGreaterThan(0);
});

it('walkers head for spots spread evenly over the city disc, not bunched at its centre', () => {
	const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(3 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	const a = sim.agents;
	const { cx, cy } = (sim as unknown as { scenario: Scenario }).scenario.regions[0];
	const R2 = sim.radiusOf(0) ** 2;
	const lastGoal = new Float32Array(a.capacity).fill(NaN);
	const shares: number[] = [];
	for (let t = 0; t < 30 * TICKS_PER_DAY; t++) {
		sim.step(1);
		for (let i = 0; i < a.activeCount; i++) {
			if (a.walking[i] === 0 || a.goalX[i] === lastGoal[i]) continue;
			lastGoal[i] = a.goalX[i];
			shares.push(((a.goalX[i] - cx) ** 2 + (a.goalY[i] - cy) ** 2) / R2);
		}
	}
	// Even over the disc, the mean squared distance from the centre is half the radius squared.
	expect(shares.length).toBeGreaterThan(200);
	const mean = shares.reduce((s, n) => s + n, 0) / shares.length;
	expect(mean).toBeGreaterThan(0.45);
	expect(mean).toBeLessThan(0.55);
	expect(Math.max(...shares)).toBeLessThanOrEqual(1 + 1e-5);
});

it("a locked city's boarding swap takes a partner from the same group and the same side of the cohort", () => {
	const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(3 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(15 * TICKS_PER_DAY);
	const a = sim.agents;
	const p = sim.people;
	const policy = microcosm(0).regions[0].policy;
	const inner = sim as unknown as { readyToBoard: (i: number) => boolean; cohort: Uint8Array };
	let swaps = 0;
	for (let i = 0; i < a.activeCount && swaps < 40; i++) {
		if (a.region[i] !== 0 || a.route[i] >= 0 || p.ill[i] === 0 || a.held[i] === 1) continue;
		const ill = Array.from(p.ill.subarray(0, a.activeCount));
		if (!inner.readyToBoard(i)) continue;
		const partner = ill.findIndex((n, j) => j !== i && p.ill[j] > n);
		expect(partner).toBeGreaterThanOrEqual(0);
		expect(lockdownGroup(a, partner, policy)).toBe(lockdownGroup(a, i, policy));
		expect(inner.cohort[partner]).toBe(inner.cohort[i]);
		swaps++;
	}
	expect(swaps).toBeGreaterThan(5);
});

it("a city's key-worker chart is exactly its cohort's rise in people who have caught it, group by group", () => {
	const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(5 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	for (let d = 0; d < 60; d += 5) {
		sim.step(5 * TICKS_PER_DAY);
		const { key, home } = cohortRises(sim, 0);
		const shown = sim.snapshot().regions[0];
		expect(key.people).toBeGreaterThan(0);
		expect(home.people).toBeGreaterThan(0);
		expect(shown.keyWorkersCaught).toBe(Math.max(0, key.rise) / key.people);
		expect(shown.stayHomeCaught).toBe(Math.max(0, home.rise) / home.people);
	}
	expect(sim.snapshot().regions[0].keyWorkersCaught).toBeGreaterThan(0);
});

/*
 * The clamp at 0 (engine.ts, keyWorkerChart): after a lockdown is lifted, a swap takes the nearest
 * partner, which can trade someone in the cohort who caught it for someone outside it who hasn't, so
 * a group's rise can fall below 0. Here ill key workers board straight after a 1-tick lockdown.
 */
it.each([1, 2, 3])('a group whose rise falls below 0 shows as 0, not less (seed %i)', (seed) => {
	const sim = createSimulation(microcosm(0), { seed, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(10 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(1);
	sim.send({ type: 'lockdown', region: 0, on: false });
	sim.step(1);
	const a = sim.agents;
	const p = sim.people;
	const policy = microcosm(0).regions[0].policy;
	const { cohort, readyToBoard } = inside(sim);
	for (let i = 0; i < a.activeCount; i++) {
		if (a.region[i] !== 0 || a.route[i] >= 0 || cohort[i] === 0 || p.ill[i] === 0) continue;
		if (isKeyWorker(a, i, policy)) readyToBoard(i);
	}
	const { key } = cohortRises(sim, 0);
	expect(key.rise).toBeLessThan(0);
	expect(sim.snapshot().regions[0].keyWorkersCaught).toBe(0);
});

it("an unlocked city's boarding swap always takes the nearest partner, whatever its group", () => {
	const sim = createSimulation(travelling(3), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(3 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(15 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: false });
	sim.step(1);
	const a = sim.agents;
	const p = sim.people;
	const policy = microcosm(0).regions[0].policy;
	const { readyToBoard } = inside(sim);
	let swaps = 0;
	let otherGroup = 0;
	for (let i = 0; i < a.activeCount && swaps < 40; i++) {
		if (a.region[i] !== 0 || a.route[i] >= 0 || p.ill[i] === 0) continue;
		const k = p.ill[i];
		let nearest = -1;
		let nearestD = Infinity;
		for (let j = 0; j < a.activeCount; j++) {
			if (j === i || a.region[j] !== 0 || a.route[j] >= 0) continue;
			if (a.ageBand[j] !== a.ageBand[i] || a.protection[j] !== a.protection[i]) continue;
			if (p.notIll(j) < k) continue;
			const d = (a.x[j] - a.x[i]) ** 2 + (a.y[j] - a.y[i]) ** 2;
			if (d < nearestD) {
				nearestD = d;
				nearest = j;
			}
		}
		if (nearest < 0) continue;
		const before = p.ill[nearest];
		expect(readyToBoard(i)).toBe(true);
		expect(p.ill[nearest]).toBe(before + k);
		if (lockdownGroup(a, nearest, policy) !== lockdownGroup(a, i, policy)) otherGroup++;
		swaps++;
	}
	expect(swaps).toBeGreaterThan(5);
	// Some of those partners were in another group, which a locked city would have passed over.
	expect(otherGroup).toBeGreaterThan(0);
});
