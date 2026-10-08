import type { Banded, Bands, Sourced } from '../sim/types';

export interface PopulationConfig {
	/** Share of people in each age band (0-14, 15-64, 65+); the general default is the EU. */
	ageMix: Sourced<Bands>;
	/** Everyday deaths from all causes, per person per year, by band (EU-27). */
	backgroundDeathRate: Banded;
	/** The same for the UK, kept for the step 4 country preset. */
	ukBackgroundDeathRate: Banded;
}

export const POPULATION: PopulationConfig = {
	ageMix: {
		value: [0.1421, 0.6335, 0.2244],
		sources: ['worldbank-pop-0014', 'worldbank-pop-65up']
	},
	// EU-27 2023: 19,177 / 699,423 / 4,137,597 deaths over 66,433,028 / 285,755,090 / 95,507,232 people.
	backgroundDeathRate: {
		value: [0.000289, 0.00245, 0.0433],
		per: 'person-year',
		reference: [66433028 / 447695350, 285755090 / 447695350, 95507232 / 447695350],
		overall: 4856197 / 447695350,
		sources: ['eurostat-deaths-pop-2023']
	},
	// UK 2018: 3,876 / 91,943 / 518,494 deaths over the mean 2018-19 population by band.
	ukBackgroundDeathRate: {
		value: [0.000326, 0.00217, 0.0426],
		per: 'person-year',
		reference: [11905748.5 / 66460344, 42372373 / 66460344, 12182222.5 / 66460344],
		overall: 614313 / 66460344,
		sources: ['eurostat-uk-deaths-2018-5yr', 'eurostat-uk-population-2018-2019-5yr']
	}
};
