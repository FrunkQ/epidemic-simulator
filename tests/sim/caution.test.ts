import { describe, expect, it } from 'vitest';
import { withCaution } from './helpers';
import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation, type Simulation } from '../../src/lib/sim/engine';
import { cautious, isKeyWorker, Out, outReason } from '../../src/lib/sim/lockdown';
import type { Scenario } from '../../src/lib/sim/types';

/*
 * Voluntary caution's mechanics, pinned one by one (6.18): the deaths signal, who stays in, the
 * contact, the order of reasons with a lockdown, the ranks, and when a slider change applies. These
 * read engine internals where a lesson never would, since each checks one rule exactly.
 */

const INDEX_CASES = 200;

interface Internals {
	lockdown: { on: Uint8Array; signal: Float64Array; caution: Float64Array; ticks: Int32Array };
	tick: number;
	scenario: Scenario;
	recentDeaths: Float64Array;
}
const inside = (sim: Simulation) => sim as unknown as Internals;

/** The 3-city map at three times the usual travel, every city's caution at `share`. */
function busyMap(share: number): Scenario {
	const scenario = withCaution(microcosm(0), share);
	for (const region of scenario.regions) {
		const p = region.policy;
		region.policy = { ...p, travelFrequency: { ...p.travelFrequency, value: 3 } };
	}
	return scenario;
}

function started(scenario: Scenario, seed = 2): Simulation {
	const sim = createSimulation(scenario, { seed, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	return sim;
}

describe('the deaths signal', () => {
	it('is the deaths in the last days per 100,000 simulated people, against a ledger of its own', () => {
		const sim = started(busyMap(BEHAVIOUR.cautionShare.value));
		const window = BEHAVIOUR.cautionWindowDays.value;
		const half = BEHAVIOUR.cautionHalfDeathsPer100k.value;
		const regions = sim.snapshot().regions.length;
		const daily: number[][] = Array.from({ length: regions }, () => []);
		let last = sim.snapshot().regions.map((r) => r.deaths);
		for (let d = 0; d < 150; d++) {
			sim.step(TICKS_PER_DAY);
			const snap = sim.snapshot();
			for (let r = 0; r < regions; r++) {
				const now = snap.regions[r];
				daily[r].push(now.deaths - last[r]);
				const sum = daily[r].slice(-window).reduce((s, n) => s + n, 0);
				const people = now.dots * snap.peoplePerDot;
				const per100k = (sum / people) * 100_000;
				expect(inside(sim).recentDeaths[r], `day ${d + 1}, city ${r}`).toBeCloseTo(per100k, 9);
				const signal = per100k > 0 ? per100k / (per100k + half) : 0;
				expect(inside(sim).lockdown.signal[r]).toBeCloseTo(signal, 12);
			}
			last = snap.regions.map((r) => r.deaths);
		}
		expect(daily.flat().reduce((s, n) => s + n, 0)).toBeGreaterThan(0);
	});

	it("divides by the city's simulated people (dots x peoplePerDot), not its population", () => {
		// 123,457 people make 1,234 dots of 100 (123,400 people), so the two divisors differ.
		const sim = started(withCaution(singleCity({ population: 123_457 }), BEHAVIOUR.cautionShare.value), 4);
		const snap0 = sim.snapshot();
		const simulated = snap0.regions[0].dots * snap0.peoplePerDot;
		const population = inside(sim).scenario.regions[0].population;
		expect(simulated).not.toBe(population);
		const window = BEHAVIOUR.cautionWindowDays.value;
		const daily: number[] = [];
		let last = snap0.regions[0].deaths;
		let seen = 0;
		for (let d = 0; d < 80; d++) {
			sim.step(TICKS_PER_DAY);
			const deaths = sim.snapshot().regions[0].deaths;
			daily.push(deaths - last);
			last = deaths;
			const sum = daily.slice(-window).reduce((s, n) => s + n, 0);
			expect(inside(sim).recentDeaths[0], `day ${d + 1}`).toBeCloseTo((sum / simulated) * 100_000, 9);
			if (sum > 0) seen++;
		}
		expect(seen).toBeGreaterThan(0);
	});

	it('forgets deaths once they leave the window', () => {
		// A small city whose outbreak burns out: once no one is infected, no one dies, and a window
		// later the signal is 0 though people have died.
		const sim = started(withCaution(singleCity({ population: 20_000 }), BEHAVIOUR.cautionShare.value), 1);
		let day = 0;
		while (sim.anyInfected() && day < 600) {
			sim.step(TICKS_PER_DAY);
			day++;
		}
		expect(sim.anyInfected()).toBe(false);
		expect(sim.snapshot().deaths).toBeGreaterThan(0);
		sim.step(BEHAVIOUR.cautionWindowDays.value * TICKS_PER_DAY + 1);
		expect(inside(sim).recentDeaths[0]).toBe(0);
		expect(inside(sim).lockdown.signal[0]).toBe(0);
		expect(sim.snapshot().regions[0].recentDeaths).toBe(0);
	});

	it("keeps each day's window in the daily history, the day it ends", () => {
		const sim = started(busyMap(BEHAVIOUR.cautionShare.value));
		for (let d = 1; d <= 60; d++) {
			sim.step(TICKS_PER_DAY);
			for (let r = 0; r < inside(sim).scenario.regions.length; r++) {
				const row = sim.history(r).series.recentDeaths;
				expect(row[row.length - 1], `day ${d}, city ${r}`).toBe(inside(sim).recentDeaths[r]);
			}
		}
	});

	it("counts every death once across the cities' windows, those on a trip included", () => {
		const sim = started(busyMap(BEHAVIOUR.cautionShare.value));
		const window = BEHAVIOUR.cautionWindowDays.value;
		const totals: number[] = [sim.snapshot().deaths];
		for (let d = 0; d < 80; d++) {
			sim.step(TICKS_PER_DAY);
			const snap = sim.snapshot();
			totals.push(snap.deaths);
			const inWindow = snap.regions.reduce(
				(s, r, i) => s + (inside(sim).recentDeaths[i] * r.dots * snap.peoplePerDot) / 100_000,
				0
			);
			expect(inWindow).toBeCloseTo(
				totals[totals.length - 1] - totals[Math.max(0, totals.length - 1 - window)],
				6
			);
		}
	});

	it('sets the level at the next tick after a slider change, with the signal held for the day', () => {
		const sim = started(singleCity({ population: 200_000 }));
		sim.step(30 * TICKS_PER_DAY + 7);
		const signal = inside(sim).lockdown.signal[0];
		expect(signal).toBeGreaterThan(0);
		const policy = inside(sim).scenario.regions[0].policy;
		sim.send({
			type: 'policy',
			region: 0,
			policy: { ...policy, cautionShare: { ...policy.cautionShare, value: 0.5 } }
		});
		expect(inside(sim).lockdown.caution[0]).toBeCloseTo(BEHAVIOUR.cautionShare.value * signal, 12);
		sim.step(1);
		expect(inside(sim).lockdown.signal[0]).toBe(signal);
		expect(inside(sim).lockdown.caution[0]).toBeCloseTo(0.5 * signal, 12);
	});
});

describe('who stays in', () => {
	it('everyone kept home is exactly who outReason or caution says, and key workers never stay in', () => {
		const sim = started(busyMap(1));
		sim.step(20 * TICKS_PER_DAY);
		sim.send({ type: 'lockdown', region: 0, on: true });
		const a = sim.agents;
		const policies = inside(sim).scenario.regions.map((r) => r.policy);
		let wary = 0;
		let keys = 0;
		for (let t = 0; t < 60 * TICKS_PER_DAY; t += 7) {
			sim.step(7);
			const { lockdown, tick } = inside(sim);
			for (let i = 0; i < a.activeCount; i++) {
				const r = a.region[i];
				if (r < 0 || a.landedTick[i] === tick) continue;
				const policy = policies[r];
				const c = lockdown.caution[r];
				const home =
					lockdown.on[r] === 1
						? [Out.HOME, Out.CAUTION].includes(outReason(a, i, policy, lockdown.ticks[r], c) as 3 | 4)
						: cautious(a, i, policy, c);
				const reached = a.held[i] === 0 && a.x[i] === a.goalX[i] && a.y[i] === a.goalY[i];
				if (!reached) expect(a.held[i] + a.walking[i], `dot ${i}`).toBe(home ? 1 : 0);
				if (isKeyWorker(a, i, policy)) {
					keys++;
					expect(a.held[i] + a.walking[i]).toBe(0);
				}
				if (home && lockdown.on[r] === 0) wary++;
			}
		}
		expect(wary).toBeGreaterThan(0);
		expect(keys).toBeGreaterThan(0);
	});

	it('dots kept in by caution never move or leave', () => {
		const sim = started(busyMap(1));
		sim.step(25 * TICKS_PER_DAY);
		const a = sim.agents;
		let held = 0;
		for (let t = 0; t < 20 * TICKS_PER_DAY; t++) {
			const x = a.x.slice(0, a.activeCount);
			const y = a.y.slice(0, a.activeCount);
			const was = a.held.slice(0, a.activeCount);
			sim.step(1);
			for (let i = 0; i < a.activeCount; i++) {
				if (was[i] === 0 || a.held[i] === 0) continue;
				held++;
				expect(a.x[i]).toBe(x[i]);
				expect(a.y[i]).toBe(y[i]);
				expect(a.route[i]).toBe(-1);
			}
		}
		expect(held).toBeGreaterThan(0);
	});

	it('a dot both locked down and cautious has the cut once, and only lockdown-held dots that are not cautious shake', () => {
		const sim = started(busyMap(1));
		sim.step(25 * TICKS_PER_DAY);
		sim.send({ type: 'lockdown', region: 0, on: true });
		const a = sim.agents;
		const policy = inside(sim).scenario.regions[0].policy;
		const lockCut = 1 - policy.lockdownContactCut.value;
		const cautionCut = 1 - policy.cautionContactCut.value;
		let both = 0;
		let shook = 0;
		for (let t = 0; t < 70 * TICKS_PER_DAY; t += 11) {
			sim.step(11);
			const { lockdown } = inside(sim);
			for (let i = 0; i < a.activeCount; i++) {
				const r = a.region[i];
				if (r < 0 || a.held[i] === 0) {
					expect(a.restless[i]).toBe(0);
					continue;
				}
				const why = lockdown.on[r] === 1 ? outReason(a, i, policy, lockdown.ticks[r], 0) : Out.IGNORING;
				const wary = cautious(a, i, policy, lockdown.caution[r]);
				if (why === Out.HOME && wary) {
					both++;
					expect(a.contact[i]).toBeCloseTo(lockCut, 6);
				} else if (why !== Out.HOME) expect(a.contact[i]).toBeCloseTo(cautionCut, 6);
				if (a.restless[i] === 1) {
					shook++;
					expect(why).toBe(Out.HOME);
					expect(wary).toBe(false);
				}
			}
		}
		expect(both).toBeGreaterThan(0);
		expect(shook).toBeGreaterThan(0);
	});

	it('a locked city counts its people kept in by caution alone apart from those out, and none as tired', () => {
		const sim = started(busyMap(1));
		sim.step(25 * TICKS_PER_DAY);
		sim.send({ type: 'lockdown', region: 0, on: true });
		let kept = 0;
		for (let d = 0; d < 120; d += 10) {
			sim.step(10 * TICKS_PER_DAY);
			const a = sim.agents;
			const p = sim.people;
			const policy = inside(sim).scenario.regions[0].policy;
			const { lockdown } = inside(sim);
			const tally = { key: 0, ignoring: 0, tired: 0, caution: 0 };
			for (let i = 0; i < a.activeCount; i++) {
				if (a.region[i] !== 0) continue;
				const stopped = a.dead[i] === 1 || a.isolated[i] === 1 || a.ill[i] === 1;
				if (stopped) continue;
				const why = outReason(a, i, policy, lockdown.ticks[0], lockdown.caution[0]);
				const alive = p.perDot - p.dead[i];
				if (why === Out.KEY) tally.key += alive;
				if (why === Out.IGNORING) tally.ignoring += alive;
				if (why === Out.TIRED) tally.tired += alive;
				if (why === Out.CAUTION) tally.caution += alive;
			}
			const shown = sim.snapshot().regions[0];
			expect(shown.out).toEqual({ key: tally.key, ignoring: tally.ignoring, tired: tally.tired });
			expect(shown.keptInByCaution).toBe(tally.caution);
			expect(shown.fatiguedShare).toBe(shown.underLockdown > 0 ? tally.tired / shown.underLockdown : 0);
			kept += tally.caution;
		}
		expect(kept).toBeGreaterThan(0);
	});
});

describe('the ranks', () => {
	it("come from caution's own stream: uncorrelated with the other ranks, the same after a restart", () => {
		const scenario = microcosm(0);
		const sim = createSimulation(scenario, { seed: 4, diseaseId: 'covid19' });
		const a = sim.agents;
		const n = a.activeCount;
		const ranks = a.cautionRank.slice(0, n);
		const corr = (x: ArrayLike<number>, y: ArrayLike<number>) => {
			let mx = 0;
			let my = 0;
			for (let i = 0; i < n; i++) {
				mx += x[i] / n;
				my += y[i] / n;
			}
			let sxy = 0;
			let sxx = 0;
			let syy = 0;
			for (let i = 0; i < n; i++) {
				sxy += (x[i] - mx) * (y[i] - my);
				sxx += (x[i] - mx) ** 2;
				syy += (y[i] - my) ** 2;
			}
			return sxy / Math.sqrt(sxx * syy);
		};
		for (const other of [a.keyRank, a.complyRank, a.fatigueZ])
			expect(Math.abs(corr(ranks, other.subarray(0, n)))).toBeLessThan(0.05);
		sim.seedNow(0, 10);
		sim.step(30 * TICKS_PER_DAY);
		sim.setup(scenario);
		expect(a.cautionRank.slice(0, n)).toEqual(ranks);
	});

	it('leave the rest of the spawn as it was, and with caution at 0 nothing is ever held', () => {
		const spawned = (share: number) => {
			const sim = createSimulation(withCaution(microcosm(0), share), { seed: 5, diseaseId: 'covid19' });
			const a = sim.agents;
			return {
				sim,
				state: [a.x, a.y, a.keyRank, a.complyRank, a.fatigueZ, a.protection].map((v) =>
					Array.from(v.subarray(0, a.activeCount))
				)
			};
		};
		expect(spawned(0).state).toEqual(spawned(BEHAVIOUR.cautionShare.value).state);
		const { sim } = spawned(0);
		sim.seedNow(0, INDEX_CASES);
		const a = sim.agents;
		for (let d = 0; d < 90; d++) {
			sim.step(TICKS_PER_DAY);
			expect(a.held.subarray(0, a.activeCount).some((h) => h === 1)).toBe(false);
			expect(a.contact.subarray(0, a.activeCount).every((c) => c === 1)).toBe(true);
		}
		expect(sim.snapshot().deaths).toBeGreaterThan(0);
	});
});

it('a caution slider moved while paused runs exactly as one moved while running, at the same tick', () => {
	const state = (paused: boolean) => {
		const sim = started(microcosm(0), 3);
		sim.step(25 * TICKS_PER_DAY + 5);
		if (paused) for (let k = 0; k < 5; k++) sim.snapshot();
		const policy = inside(sim).scenario.regions[0].policy;
		sim.send({
			type: 'policy',
			region: 0,
			policy: { ...policy, cautionShare: { ...policy.cautionShare, value: 0.6 } }
		});
		if (paused) sim.snapshot();
		sim.step(20 * TICKS_PER_DAY);
		const a = sim.agents;
		return JSON.stringify({
			snap: sim.snapshot(),
			x: Array.from(a.x.subarray(0, a.activeCount)),
			history: sim.history(0)
		});
	};
	expect(state(true)).toBe(state(false));
});

it('the deaths figure shown is the one behind the caution level in use, even paused at a day boundary', () => {
	const sim = started(busyMap(BEHAVIOUR.cautionShare.value));
	const half = BEHAVIOUR.cautionHalfDeathsPer100k.value;
	let boundaryChanges = 0;
	for (let t = 0; t < 60 * TICKS_PER_DAY; t++) {
		const before = Array.from(inside(sim).recentDeaths);
		sim.step(1);
		const snap = sim.snapshot();
		snap.regions.forEach((reg, r) => {
			const share = inside(sim).scenario.regions[r].policy.cautionShare.value;
			const d = reg.recentDeaths;
			expect(reg.cautionLevel, `tick ${t + 1}, city ${r}`).toBeCloseTo(
				d > 0 ? (share * d) / (d + half) : 0,
				12
			);
			if (inside(sim).recentDeaths[r] !== before[r] && d !== inside(sim).recentDeaths[r]) boundaryChanges++;
		});
	}
	// The case the display fix is for: a day boundary that has moved the window but not yet the level.
	expect(boundaryChanges).toBeGreaterThan(0);
});

/** FNV-1a over a run's dots and its cities' counts, the same on main before caution existed. */
function runHash(locked: boolean, share = 0): string {
	const scenario = withCaution(microcosm(0), share);
	const sim = createSimulation(scenario, { seed: 7, diseaseId: 'covid19' });
	sim.seedNow(0, 50);
	sim.step(30 * TICKS_PER_DAY);
	if (locked) sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(60 * TICKS_PER_DAY);
	const a = sim.agents;
	let h = 2166136261;
	const add = (bytes: Uint8Array) => {
		for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619) >>> 0;
	};
	const caution = share > 0 ? [a.cautionRank] : [];
	for (const v of [a.x, a.y, a.held, a.contact, a.dead, a.ill, a.region, a.route, a.routeS, ...caution])
		add(new Uint8Array(v.buffer, v.byteOffset, a.activeCount * v.BYTES_PER_ELEMENT));
	const snap = sim.snapshot();
	add(new TextEncoder().encode(JSON.stringify(snap.regions.map((r) => [r.counts, r.deaths, r.personDays]))));
	return h.toString(16).padStart(8, '0');
}

it('with the caution slider at 0, a run is exactly as on main before caution, unlocked and locked', () => {
	// Recorded on main at 55d7970 (lockdown, slice 1), with the same seed, map and steps.
	expect(runHash(false)).toBe('eac49ecb');
	expect(runHash(true)).toBe('dfc073ad');
});

it('a run with caution on, and its ranks, are pinned too, so a change to the caution stream shows', () => {
	// Recorded on this branch: at slider 0 the ranks never matter, so only a run with caution on
	// can see the stream they come from.
	expect(runHash(true, BEHAVIOUR.cautionShare.value)).toBe('01e23a3d');
});

it('a dot that is both kept home by the lockdown and cautious is counted as kept home by the lockdown', () => {
	const sim = createSimulation(withCaution(microcosm(0), 1), { seed: 3, diseaseId: 'covid19' });
	const a = sim.agents;
	const policy = inside(sim).scenario.regions[0].policy;
	const i = Array.from({ length: a.activeCount }, (_, k) => k).find((k) => a.ageBand[k] === 1)!;
	const ticks = TICKS_PER_DAY;
	const set = (key: number, comply: number, wary: number, fatigueZ = 0) => {
		a.keyRank[i] = key;
		a.complyRank[i] = comply;
		a.cautionRank[i] = wary;
		a.fatigueZ[i] = fatigueZ;
	};
	const lots = 1e6;
	// Written out by hand: key worker, then the lockdown, then caution, then ignoring or tired.
	set(0, 0, 0);
	expect(outReason(a, i, policy, ticks, 0.5)).toBe(Out.KEY);
	set(0.99, 0, 0);
	expect(outReason(a, i, policy, ticks, 0.5)).toBe(Out.HOME);
	set(0.99, 0.99, 0);
	expect(outReason(a, i, policy, ticks, 0.5)).toBe(Out.CAUTION);
	set(0.99, 0.99, 0.99);
	expect(outReason(a, i, policy, ticks, 0.5)).toBe(Out.IGNORING);
	set(0.99, 0, 0, -lots);
	expect(outReason(a, i, policy, lots * TICKS_PER_DAY, 0.5)).toBe(Out.CAUTION);
	set(0.99, 0, 0.99, -lots);
	expect(outReason(a, i, policy, lots * TICKS_PER_DAY, 0.5)).toBe(Out.TIRED);
});

it('a restart empties the deaths window', () => {
	const scenario = singleCity({ population: 200_000 });
	const sim = createSimulation(scenario, { seed: 1, diseaseId: 'covid19' });
	sim.seedNow(0, 10);
	sim.step(40 * TICKS_PER_DAY);
	expect(sim.snapshot().regions[0].recentDeaths).toBeGreaterThan(0);
	sim.setup(scenario);
	sim.seedNow(0, 10);
	// No one has died since the restart, so nothing from before it may count.
	sim.step(TICKS_PER_DAY);
	expect(inside(sim).recentDeaths[0]).toBe(0);
	sim.step(1);
	expect(sim.snapshot().regions[0].recentDeaths).toBe(0);
	expect(inside(sim).lockdown.signal[0]).toBe(0);
});

describe('the papers the caution note names', () => {
	it('links each one where it is named, with the sentence the wording rests on', async () => {
		const { CAUTION_READING } = await import('../../src/lib/ui/cautionReading');
		const { readFileSync } = await import('node:fs');
		const card = readFileSync('src/lib/ui/RegionCard.svelte', 'utf8');
		for (const [key, r] of Object.entries(CAUTION_READING)) {
			expect(r.url, key).toMatch(/^https:\/\//);
			expect(r.name, key).toMatch(/^[A-Z][a-z]+ \d{4}$/);
			expect(r.quote.length, key).toBeGreaterThan(20);
			// Named only through its link, so the name never shows without one.
			expect(card, key).toContain(`href={CAUTION_READING.${key}.url}`);
			expect(card, key).toContain(`{CAUTION_READING.${key}.name}`);
			expect(card, key).not.toContain(r.name);
		}
	});
});
