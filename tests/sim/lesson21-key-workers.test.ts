import { expect, it } from 'vitest';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lockdownRun } from './lockdownRuns';
import { microcosm } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { createSimulation } from '../../src/lib/sim/engine';

/*
 * Lesson 21 (10, research/lockdown-movers.md §5.6): COVID-19, lockdown from day 5. By day 60 the
 * share who have caught it is higher among people in key-worker dots than among people in non-key
 * 15-64 dots that keep to a lockdown. Both groups are fixed by their ranks, not by who happens to be
 * out, and both are aged 15-64, so age can't explain the gap. The direction is all the narration
 * claims; the ratio is reported, never tuned (§5.7). People who have caught it are counted in the
 * dot they are in now (People.everCaught), so each person counts once.
 */
it(
	'lesson 21: in a lockdown, key workers catch it more often than working-age people who stay home',
	() => {
		const ratios: number[] = [];
		const share = shareOf(SEEDS, (seed) => {
			const { sim } = lockdownRun(seed, { lockdownDay: 5, until: 60 });
			const { key, home } = sim.keyWorkerInfection();
			ratios.push(home > 0 ? key / home : Infinity);
			return key > home;
		});
		const sorted = ratios.slice().sort((a, b) => a - b);
		console.log(
			`lesson 21: key workers / stay-home share caught by day 60, median ${sorted[sorted.length >> 1].toFixed(2)} (range ${sorted[0].toFixed(2)}-${sorted[sorted.length - 1].toFixed(2)}); pass share ${share}`
		);
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);

/*
 * The same direction on the 3-city map, as the card's chart counts it (6.4): city 0 locks down on
 * day 5, and of the people there when it began, followed wherever they go, key workers have caught
 * it more often since than working-age people who stayed home at first, judged on every seed. A
 * day-5 lockdown stops most outbreaks seeded with 10 cases here, so this seeds 200; every seed then
 * has cases after the lockdown.
 */
const INDEX_CASES = 200;

it(
	'lesson 21 on the 3-city map: of the people in a city when its lockdown began, key workers catch it more often since',
	() => {
		const ratios: number[] = [];
		const share = shareOf(SEEDS, (seed) => {
			const sim = createSimulation(microcosm(0), { seed, diseaseId: 'covid19' });
			sim.seedNow(0, INDEX_CASES);
			sim.step(5 * TICKS_PER_DAY);
			sim.send({ type: 'lockdown', region: 0, on: true });
			sim.step(55 * TICKS_PER_DAY);
			const { keyWorkersCaught: key, stayHomeCaught: home } = sim.snapshot().regions[0];
			expect(key + home).toBeGreaterThan(0);
			ratios.push(home > 0 ? key / home : Infinity);
			return key > home;
		});
		const sorted = ratios.slice().sort((a, b) => a - b);
		console.log(
			`lesson 21, 3-city map: key workers / stayed-home share caught since day 5, median ${sorted[sorted.length >> 1].toFixed(2)} (range ${sorted[0].toFixed(2)}-${sorted[sorted.length - 1].toFixed(2)}); pass share ${share}`
		);
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);

it('a city that locks down again counts its key-worker chart from the new start', () => {
	const sim = createSimulation(microcosm(0), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(5 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(40 * TICKS_PER_DAY);
	const first = sim.snapshot().regions[0];
	expect(first.keyWorkersCaught).toBeGreaterThan(0);
	sim.send({ type: 'lockdown', region: 0, on: false });
	sim.step(10 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(1);
	const again = sim.snapshot().regions[0];
	expect(again.keyWorkersCaught).toBeLessThan(first.keyWorkersCaught / 10);
	expect(again.stayHomeCaught).toBeLessThan(first.stayHomeCaught / 10 + 1e-9);
});

/*
 * Each city keeps its own cohort and baseline: another city's lockdown starting never re-stamps them.
 * (Its numbers still move with the epidemic, which that lockdown changes.)
 */
it("another city's lockdown never re-stamps a city's key-worker cohort", () => {
	const sim = createSimulation(microcosm(0), { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, INDEX_CASES);
	sim.step(5 * TICKS_PER_DAY);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(25 * TICKS_PER_DAY);
	const inside = sim as unknown as { cohort: Uint8Array; caughtAtLock: Int32Array };
	const cap = sim.agents.capacity;
	const cohort = inside.cohort.slice(0, cap);
	const base = inside.caughtAtLock.slice(0, cap);
	expect(base.some((n) => n > 0)).toBe(true);
	sim.send({ type: 'lockdown', region: 1, on: true });
	sim.step(1);
	expect(inside.cohort.slice(0, cap)).toEqual(cohort);
	expect(inside.caughtAtLock.slice(0, cap)).toEqual(base);
	expect(inside.cohort.slice(cap, 2 * cap).some((n) => n === 1)).toBe(true);
});

/*
 * The engine review's case where the old per-dot tally passed 100% (1.044 by day 365): Omicron, three
 * times the usual travel, every city locked from day 5, River City seeded. Each person counts once,
 * so no group's share ever passes 1.
 */
it(
	'the key-worker chart never passes 100% for Omicron with much travel and every city locked',
	() => {
		const scenario = microcosm(0);
		for (const region of scenario.regions) {
			const p = region.policy;
			region.policy = { ...p, travelFrequency: { ...p.travelFrequency, value: 3 } };
		}
		const river = scenario.regions.findIndex((r) => r.name === 'River City');
		const sim = createSimulation(scenario, { seed: 2, diseaseId: 'covid19omicron' });
		sim.seedNow(river, INDEX_CASES);
		sim.step(5 * TICKS_PER_DAY);
		for (let r = 0; r < scenario.regions.length; r++) sim.send({ type: 'lockdown', region: r, on: true });
		let most = 0;
		for (let d = 5; d < 365; d += 5) {
			sim.step(5 * TICKS_PER_DAY);
			const regions = sim.snapshot().regions;
			for (const r of regions) {
				expect(r.keyWorkersCaught).toBeLessThanOrEqual(1);
				expect(r.stayHomeCaught).toBeLessThanOrEqual(1);
				most = Math.max(most, r.keyWorkersCaught, r.stayHomeCaught);
			}
			// The direction while most who stayed home still keep to it (fatigue's mean is 60 days).
			// Later both groups are out and both near everyone, so they meet; that is not judged.
			if (d + 5 === 60) for (const r of regions) expect(r.keyWorkersCaught).toBeGreaterThan(r.stayHomeCaught);
		}
		expect(most).toBeGreaterThan(0.05);
	},
	LESSON_TIMEOUT
);

it('a lockdown sent while paused runs exactly as one sent while running, at the same tick', () => {
	const state = (paused: boolean) => {
		const sim = createSimulation(microcosm(0), { seed: 3, diseaseId: 'covid19' });
		sim.seedNow(0, 10);
		// Another city already locked down, so a paused read that counted anything would show.
		sim.send({ type: 'lockdown', region: 1, on: true });
		sim.step(7 * TICKS_PER_DAY + 5);
		// Paused, the page keeps reading snapshots before the next tick.
		if (paused) for (let k = 0; k < 5; k++) sim.snapshot();
		sim.send({ type: 'lockdown', region: 0, on: true });
		if (paused) sim.snapshot();
		sim.step(20 * TICKS_PER_DAY);
		const a = sim.agents;
		return JSON.stringify({
			snap: sim.snapshot(),
			x: Array.from(a.x.subarray(0, a.activeCount)),
			region: Array.from(a.region.subarray(0, a.activeCount)),
			history: sim.history(0)
		});
	};
	expect(state(true)).toBe(state(false));
});

it('a lockdown turned on and off again while paused never ran: no mark, no stamp, the same run', () => {
	const run = (press: boolean) => {
		const sim = createSimulation(microcosm(0), { seed: 3, diseaseId: 'covid19' });
		sim.seedNow(0, INDEX_CASES);
		sim.step(7 * TICKS_PER_DAY + 5);
		if (press) {
			sim.send({ type: 'lockdown', region: 0, on: true });
			sim.snapshot();
			sim.send({ type: 'lockdown', region: 0, on: false });
		}
		sim.step(20 * TICKS_PER_DAY);
		const a = sim.agents;
		return JSON.stringify({
			snap: sim.snapshot(),
			x: Array.from(a.x.subarray(0, a.activeCount)),
			history: sim.history(0)
		});
	};
	const pressed = run(true);
	expect(JSON.parse(pressed).snap.regions[0].lockedSince).toBe(-1);
	expect(pressed).toBe(run(false));
});

it('a restart lifts every lockdown, and its key-worker chart starts again empty', () => {
	const scenario = microcosm(0);
	const sim = createSimulation(scenario, { seed: 2, diseaseId: 'covid19' });
	sim.seedNow(0, 10);
	sim.send({ type: 'lockdown', region: 0, on: true });
	sim.step(10 * TICKS_PER_DAY);
	expect(sim.snapshot().regions[0].lockedDown).toBe(true);
	sim.setup(scenario, 'covid19', 2);
	const r = sim.snapshot().regions[0];
	expect(r.lockedDown).toBe(false);
	expect(r.lockedSince).toBe(-1);
	expect(Number.isNaN(r.keyWorkersCaught)).toBe(true);
});

/*
 * The engine review's case where the old per-dot tally passed 100% (6.4): polio, 3% key workers,
 * three times the usual travel, every city locked down for a year. Each person counts once, so no
 * group's share ever passes 1, and the chart is not empty.
 */
it(
	'the key-worker chart never passes 100% with few key workers, much travel and every city locked',
	() => {
		const scenario = microcosm(0);
		for (const region of scenario.regions) {
			const p = region.policy;
			region.policy = {
				...p,
				keyWorkerShare: { ...p.keyWorkerShare, value: 0.03 },
				travelFrequency: { ...p.travelFrequency, value: 3 }
			};
		}
		const sim = createSimulation(scenario, { seed: 2, diseaseId: 'polio' });
		for (let r = 0; r < scenario.regions.length; r++) sim.seedNow(r, INDEX_CASES);
		for (let r = 0; r < scenario.regions.length; r++) sim.send({ type: 'lockdown', region: r, on: true });
		let most = 0;
		for (let d = 0; d < 365; d += 5) {
			sim.step(5 * TICKS_PER_DAY);
			for (const r of sim.snapshot().regions) {
				expect(r.keyWorkersCaught).toBeLessThanOrEqual(1);
				expect(r.stayHomeCaught).toBeLessThanOrEqual(1);
				most = Math.max(most, r.keyWorkersCaught, r.stayHomeCaught);
			}
		}
		expect(most).toBeGreaterThan(0.05);
	},
	LESSON_TIMEOUT
);
