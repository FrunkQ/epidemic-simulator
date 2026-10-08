import type { Sourced } from '../sim/types';
import { EU_CURATIVE_BEDS_PER_1000, EU_CURATIVE_OCCUPANCY, STRAIN } from './derived';

/**
 * How people and health systems respond. COVID-19 era research backs the behaviour mechanics
 * only, never another disease's numbers.
 */
export interface BehaviourConfig {
	/** Average days of lockdown before a person starts to drift back out. */
	lockdownFatigueMeanDays: Sourced;
	/** Spread of that point between people, in days. */
	lockdownFatigueSdDays: Sourced;
	/** Default hospital beds for short-term (curative) care per 1,000 people for a new population. */
	hospitalBedsPerThousand: Sourced;
	/** Share of those beds normally free (1 - normal occupancy), so only spare beds count as capacity. */
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
	/** Hospital pressure (share of beds in use) above which patients start to do worse (6.6). */
	strainThreshold: Sourced;
	/** The most that strain multiplies a hospital patient's chance of dying. */
	strainMaxMultiplier: Sourced;
	/** How fast the multiplier rises per unit of pressure above the threshold. */
	strainSlope: Sourced;
	/**
	 * How long an unfinished vaccine course's breakthrough illness lasts, as a share of the usual,
	 * where the vaccine has no sourced protection against severe illness for it (6.2).
	 */
	partialIllFactor: Sourced;
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
	hospitalBedsPerThousand: { value: EU_CURATIVE_BEDS_PER_1000, sources: ['eurostat-curative-beds-2023'] },
	spareBedShare: { value: 1 - EU_CURATIVE_OCCUPANCY, sources: ['eurostat-curative-occupancy-2023'] },
	roadTripsPerDay: { value: 2, sources: [], provisional: TRAVEL_PLACEHOLDER },
	ferryTripsPerDay: { value: 1.5, sources: [], provisional: TRAVEL_PLACEHOLDER },
	airTripsPerDay: { value: 6, sources: [], provisional: TRAVEL_PLACEHOLDER },
	flightsPerDay: { value: 3, sources: [], provisional: TRAVEL_PLACEHOLDER },
	planeSeats: { value: 8, sources: [], provisional: TRAVEL_PLACEHOLDER },
	strainThreshold: {
		value: STRAIN.threshold,
		sources: ['neupane2024-surge-sr', 'wilde2021-icu-occupancy', 'bravata2021-va-icu-strain']
	},
	strainMaxMultiplier: {
		value: STRAIN.cap,
		sources: ['neupane2024-surge-sr', 'kadri2021-caseload-surge', 'bravata2021-va-icu-strain']
	},
	// Worked out from the threshold and the cap (derived.ts).
	strainSlope: {
		value: STRAIN.slope,
		sources: ['neupane2024-surge-sr', 'wilde2021-icu-occupancy', 'kadri2021-caseload-surge']
	},
	partialIllFactor: {
		value: 0.5,
		sources: [],
		provisional:
			'The step 1 rule that partly vaccinated people are ill half as long; no source gives the factor yet.'
	}
};
