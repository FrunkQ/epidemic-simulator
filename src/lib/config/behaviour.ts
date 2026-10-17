import type { Sourced } from '../sim/types';
import {
	EU_CURATIVE_BEDS_PER_1000,
	EU_CURATIVE_OCCUPANCY,
	fmt,
	JOSHI_2021_DAYS_TO_NO_IMPACT,
	KEY_WORKER_SHARE,
	LOCKDOWN_COMPLIANCE,
	LOCKDOWN_CONTACT_CUT,
	LOCKDOWN_FATIGUE_MEAN_DAYS,
	STRAIN
} from './derived';

/**
 * How people and health systems respond. COVID-19 era research backs the behaviour mechanics
 * only, never another disease's numbers.
 */
export interface BehaviourConfig {
	/** Share of people aged 15-64 who are key workers and keep working in a lockdown (6.4). */
	keyWorkerShare: Sourced;
	/** Share of everyone else who stay home from the start of a lockdown (6.4). */
	lockdownCompliance: Sourced;
	/** How much less contact outside the home people staying home in a lockdown have (6.4). */
	lockdownContactCut: Sourced;
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
}

/** Why the travel numbers are placeholders: they are sized for the sim, not taken from data. */
const TRAVEL_PLACEHOLDER =
	'Sized so a few dots a day travel between the 3 cities; real trip and flight rates per city pair come with country data in step 4.';

export const BEHAVIOUR: BehaviourConfig = {
	keyWorkerShare: {
		value: KEY_WORKER_SHARE,
		sources: ['ons2020-key-workers', 'worldbank-pop-total-2019', 'worldbank-pop-1564-2019']
	},
	lockdownCompliance: {
		value: LOCKDOWN_COMPLIANCE,
		sources: ['smith2020-lockdown-adherence', 'joshi2021-lockdown-mobility']
	},
	lockdownContactCut: {
		value: LOCKDOWN_CONTACT_CUT,
		sources: ['jarvis2020-comix-uk', 'liu2021-contact-review']
	},
	lockdownFatigueMeanDays: {
		value: LOCKDOWN_FATIGUE_MEAN_DAYS,
		sources: ['joshi2021-lockdown-mobility'],
		provisional: `A pick inside Joshi 2021's ${fmt(JOSHI_2021_DAYS_TO_NO_IMPACT, 1)} days for the median country, not a sourced figure.`
	},
	lockdownFatigueSdDays: {
		value: 20,
		sources: ['petherick2021-pandemic-fatigue'],
		provisional: 'An assumption shown against Petherick 2021.'
	},
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
	}
};
