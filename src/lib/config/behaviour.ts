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
	/** Road trips per day each way on one road, at the default travel frequency. */
	roadTripsPerDay: Sourced;
	/** Ferry trips per day each way on one ferry route. */
	ferryTripsPerDay: Sourced;
	/** Air passengers per day each way on one air route. */
	airTripsPerDay: Sourced;
	/** Scheduled departures per day each way on one air route. */
	flightsPerDay: Sourced;
	/** Seats on one plane; a busier flight sends extra planes rather than leaving people behind. */
	planeSeats: Sourced;
}

/** Why the travel numbers are placeholders: they are sized for the sim, not taken from data. */
const TRAVEL_PLACEHOLDER =
	'Sized so a few dots a day travel between the 3 cities; real trip and flight rates per city pair come with country data in step 4.';

export const BEHAVIOUR: BehaviourConfig = {
	lockdownFatigueMeanDays: {
		value: 60,
		sources: ['joshi2021-lockdown-mobility']
	},
	lockdownFatigueSdDays: { value: 20, sources: ['petherick2021-pandemic-fatigue'] },
	hospitalBedsPerThousand: { value: 5.07, sources: ['eurostat-beds-2024'] },
	spareBedShare: { value: 0.1, sources: ['nhs-england-kh03-bed-occupancy-2024'] },
	roadTripsPerDay: { value: 2, sources: [], provisional: TRAVEL_PLACEHOLDER },
	ferryTripsPerDay: { value: 1.5, sources: [], provisional: TRAVEL_PLACEHOLDER },
	airTripsPerDay: { value: 6, sources: [], provisional: TRAVEL_PLACEHOLDER },
	flightsPerDay: { value: 3, sources: [], provisional: TRAVEL_PLACEHOLDER },
	planeSeats: { value: 8, sources: [], provisional: TRAVEL_PLACEHOLDER }
};
