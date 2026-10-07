import type { Sourced } from '../sim/types';

/**
 * How people and health systems respond. COVID-19 era research backs the behaviour mechanics
 * only, never another disease's numbers.
 */
export interface BehaviourConfig {
	/** Average days of lockdown before a person starts to drift back out. */
	lockdownFatigueMeanDays: Sourced;
	/** Spread of that point between people, in days. */
	lockdownFatigueSdDays: Sourced;
	/** Default hospital beds per 1,000 people for a new population. */
	hospitalBedsPerThousand: Sourced;
	/** Share of those beds normally free, so only spare beds count as capacity. */
	spareBedShare: Sourced;
}

export const BEHAVIOUR: BehaviourConfig = {
	lockdownFatigueMeanDays: {
		value: 60,
		sources: ['joshi2021-lockdown-mobility', 'goldstein2021-lockdown-fatigue']
	},
	lockdownFatigueSdDays: { value: 20, sources: ['petherick2021-pandemic-fatigue'] },
	hospitalBedsPerThousand: { value: 5.07, sources: ['eurostat-beds-2024'] },
	spareBedShare: { value: 0.1, sources: ['nhs-england-kh03-bed-occupancy-2024'] }
};
