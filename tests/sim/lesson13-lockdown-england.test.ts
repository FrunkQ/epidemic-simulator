import { expect, it } from 'vitest';
import { ENGLAND_POLICY } from '../../src/lib/config/healthPolicy';
import { shareOf } from './helpers';
import { LESSON_TIMEOUT, SEEDS } from './lessonRuns';
import { lockdownRun } from './lockdownRuns';

it(
	'lesson 13: COVID-19 with the England (NHS) preset, an early lockdown (day 5) lowers the hospital pressure peak',
	() => {
		const share = shareOf(SEEDS, (seed) => {
			const policy = () => structuredClone(ENGLAND_POLICY);
			const locked = lockdownRun(seed, { lockdownDay: 5, policy: policy() });
			const open = lockdownRun(seed, { lockdownDay: null, policy: policy() });
			return locked.peakPressure < open.peakPressure;
		});
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);

it(
	'6.6: with no interventions COVID-19 goes over full hospital capacity, and a lockdown from day 5 does so later or never',
	() => {
		const share = shareOf(SEEDS, (seed) => {
			const open = lockdownRun(seed, { lockdownDay: null });
			const locked = lockdownRun(seed, { lockdownDay: 5 });
			return open.overDay < Infinity && locked.overDay > open.overDay;
		});
		expect(share).toBeGreaterThanOrEqual(0.8);
	},
	LESSON_TIMEOUT
);
