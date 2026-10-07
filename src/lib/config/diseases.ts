import type { Banded, Bands, DiseaseConfig, Sourced, Vaccine } from '../sim/types';
import { covid19BandsPerInfection, covid19SevereBandsPerInfection } from './covidAgeIfr';

/** How the disease picker groups diseases, in plain words. */
export const DISEASE_GROUPS = {
	common: 'Common',
	eradicated: 'Wiped out by vaccines',
	deadly: 'Deadly but burns out fast',
	historic: 'Historic pandemics'
} as const;
export type DiseaseGroup = keyof typeof DISEASE_GROUPS;

/**
 * Death rate per symptomatic case, worked out from a death rate per infection. Cases that never
 * show symptoms never die in the model, so every death is carried by the symptomatic share.
 */
export function perSymptomatic(infectionFatalityRate: Sourced, asymptomaticFraction: Sourced): number {
	return infectionFatalityRate.value / (1 - asymptomaticFraction.value);
}

const COVID19_ASYMPTOMATIC: Sourced = {
	value: 0.2,
	sources: ['buitrago-garcia-2020-asymptomatic-sars-cov-2']
};
const COVID19_IFR: Sourced = { value: 0.0068, sources: ['meyerowitzkatz2020-covid-ifr'] };
/** Hospital admissions per infection, England's pre-vaccine peak (Ward 2024: 3.39%). */
const COVID19_IHR: Sourced = { value: 0.0339, sources: ['ward-2024-covid-ihr-ifr'] };
const COVID19_AGE = covid19BandsPerInfection();
const ukWeighted = (b: Bands) => b.reduce((a, v, i) => a + v * COVID19_AGE.shares[i], 0);
/** Deaths per infection by band, derived in covidAgeIfr.ts; UK 2019 ages are the reference. */
const COVID19_DEATHS_BY_AGE: Banded = {
	value: COVID19_AGE.bands,
	per: 'infection',
	reference: COVID19_AGE.shares,
	overall: ukWeighted(COVID19_AGE.bands),
	sources: ['covid19-forecasting-team-2022-ifr', 'eurostat-uk-population-2018-2019-5yr']
};
const COVID19_SEVERE = covid19SevereBandsPerInfection();
/** Hospitalised or died outside hospital, per infection by band (Herrera-Esposito 2022). */
const COVID19_HOSPITAL_BY_AGE: Banded = {
	value: COVID19_SEVERE,
	per: 'infection',
	reference: COVID19_AGE.shares,
	overall: ukWeighted(COVID19_SEVERE),
	sources: ['herrera-esposito-2022-severe-by-age', 'eurostat-uk-population-2018-2019-5yr']
};

/**
 * Omicron against the 2020 virus in people with no immunity: basic infection fatality 0.7% vs
 * 1.2% (Perez-Guzman 2023). Applied per infection, before converting with Omicron's own share
 * of cases without symptoms.
 */
const OMICRON_SEVERITY_RATIO = 0.7 / 1.2;
const OMICRON_ASYMPTOMATIC: Sourced = { value: 0.324, sources: ['shang-2022-omicron-asymptomatic'] };
const OMICRON_IFR: Sourced = {
	value: COVID19_IFR.value * OMICRON_SEVERITY_RATIO,
	sources: ['meyerowitzkatz2020-covid-ifr', 'perez-guzman-2023-omicron']
};
/** The 2020 virus's hospital share per infection, scaled the same way (an assumption). */
const OMICRON_HOSPITAL_PER_INFECTION = COVID19_IHR.value * OMICRON_SEVERITY_RATIO;

/*
 * Vaccines. Each disease's `fullEfficacy` and `partialEfficacy` are its default vaccine's
 * infection values (the same objects), until step 3 moves the engine onto `vaccines`.
 * Risk rates are per 100,000 doses; a null death rate means no death has been established as
 * caused by the vaccine.
 */

/** MMR's risks, the same vaccine whichever of the three diseases it is given against. */
const MMR_SERIOUS: Sourced = { value: 30, sources: ['cdc-pinkbook-measles'] };
const MMR_DEATHS: Sourced<null> = { value: null, sources: ['cdc-pinkbook-measles'] };

const COVID19_MRNA_ORIGINAL = {
	product: 'mRNA',
	version: 'original',
	label: 'mRNA (original)',
	default: true,
	infection: { value: 0.95, sources: ['cheng-2021-phase3-ma', 'kow-2021-bnt-ma'] },
	severe: { value: 0.976, sources: ['zheng-2022-covid-ve-ma'] },
	partial: {
		infection: { value: 0.53, sources: ['kow-2021-bnt-ma'] },
		severe: { value: 0.53, sources: ['rahmani-k-2022-covid-ve-ma'] }
	},
	seriousPer100kDoses: {
		value: 0.96,
		sources: ['oster-2022-mrna-myocarditis', 'cdc-covid-vaccine-safety-2025']
	},
	deathsPer100kDoses: {
		value: null,
		sources: ['cdc-covid-vaccine-safety-2025', 'xu-2021-covid-vaccine-mortality']
	}
} satisfies Vaccine;

const COVID19_CHADOX1: Vaccine = {
	product: 'adenovirus',
	label: 'ChAdOx1',
	infection: { value: 0.667, sources: ['voysey-2021-chadox1-pooled'] },
	severe: { value: 0.91, sources: ['rahmani-k-2022-covid-ve-ma'] },
	partial: {
		infection: { value: 0.51, sources: ['rahmani-k-2022-covid-ve-ma'] },
		severe: { value: 0.62, sources: ['rahmani-k-2022-covid-ve-ma'] }
	},
	seriousPer100kDoses: { value: 1.574, sources: ['lane-shakir-2022-chadox1-tts'] },
	deathsPer100kDoses: { value: 0.288, sources: ['lane-shakir-2022-chadox1-tts'] }
};

const FLU_INFECTION: Sourced = {
	value: 0.414,
	sources: ['guo2024-flu-ve-review', 'belongia2016-flu-ve-review']
};
const FLU_PARTIAL_INFECTION: Sourced = {
	value: 0.2,
	sources: ['belongia2016-flu-ve-review', 'young2018-flu-ve-waning-review', 'hu2022-flu-ve-waning']
};
const FLU_INACTIVATED: Vaccine = {
	product: 'inactivated',
	label: 'Typical season',
	default: true,
	infection: FLU_INFECTION,
	severe: { value: 0.42, sources: ['yegorov-2025-flu-severe-ma', 'rondy-2017-flu-hosp-ma'] },
	partial: { infection: FLU_PARTIAL_INFECTION, severe: null },
	seriousPer100kDoses: { value: 0.3, sources: ['cdc-flu-gbs-2024', 'mcneil-2016-anaphylaxis'] },
	deathsPer100kDoses: {
		value: null,
		sources: ['cdc-flu-gbs-2024', 'miller-2015-deaths-after-vaccination']
	}
};

/** IPV hardly stops infection (Hird 2012), for a full or a partial course. */
const POLIO_IPV_INFECTION: Sourced = { value: 0, sources: ['hird2012-ipv-mucosal-review'] };
const POLIO_IPV_PARTIAL_INFECTION: Sourced = { value: 0, sources: ['hird2012-ipv-mucosal-review'] };
const POLIO_IPV: Vaccine = {
	product: 'IPV',
	label: 'Inactivated (IPV, injected)',
	default: true,
	infection: POLIO_IPV_INFECTION,
	severe: { value: 0.99, sources: ['cdc-pinkbook-polio'] },
	partial: {
		infection: POLIO_IPV_PARTIAL_INFECTION,
		severe: { value: 0.4, sources: ['grassly2014-ipv-doses-review', 'cooper2024-ipv-nigeria'] }
	},
	seriousPer100kDoses: { value: 0.131, sources: ['cdc-pinkbook-polio', 'mcneil-2016-anaphylaxis'] },
	deathsPer100kDoses: { value: null, sources: ['cdc-pinkbook-polio'] }
};
const POLIO_OPV: Vaccine = {
	product: 'OPV',
	label: 'Oral (OPV, drops)',
	infection: { value: 0.87, sources: ['hird2012-ipv-mucosal-review'] },
	severe: { value: 0.95, sources: ['cdc-pinkbook-polio'] },
	partial: { infection: null, severe: { value: 0.5, sources: ['cdc-pinkbook-polio'] } },
	seriousPer100kDoses: { value: 0.04, sources: ['cdc-pinkbook-polio'] },
	deathsPer100kDoses: {
		value: null,
		sources: ['cdc-pinkbook-polio', 'miller-2015-deaths-after-vaccination']
	}
};

const MEASLES_FULL: Sourced = {
	value: 0.97,
	sources: [
		'cdc-pinkbook-measles',
		'uzicanin2011-measles-ve-review',
		'dipietrantonj2020-cochrane-mmrv',
		'benet2025-measles-ve-france',
		'perry2026-measles-ve-wales'
	]
};
const MEASLES_PARTIAL: Sourced = {
	value: 0.93,
	sources: ['cdc-pinkbook-measles', 'uzicanin2011-measles-ve-review', 'dipietrantonj2020-cochrane-mmrv']
};
const MUMPS_FULL: Sourced = { value: 0.88, sources: ['cdc-pinkbook-mumps'] };
const MUMPS_PARTIAL: Sourced = { value: 0.78, sources: ['cdc-pinkbook-mumps'] };
const RUBELLA_FULL: Sourced = { value: 0.97, sources: ['cdc-pinkbook-rubella'] };
const RUBELLA_PARTIAL: Sourced = { value: 0.95, sources: ['cdc-pinkbook-rubella'] };
const CHICKENPOX_FULL: Sourced = { value: 0.92, sources: ['cdc-pinkbook-varicella'] };
const CHICKENPOX_PARTIAL: Sourced = { value: 0.82, sources: ['cdc-pinkbook-varicella'] };
const PERTUSSIS_FULL: Sourced = { value: 0.85, sources: ['cdc-pinkbook-pertussis'] };
const PERTUSSIS_PARTIAL: Sourced = { value: 0.5, sources: ['cdc-pinkbook-pertussis'] };
const SMALLPOX_FULL: Sourced = { value: 0.95, sources: ['cdc-smallpox-vaccine'] };
const SMALLPOX_PARTIAL: Sourced = { value: 0.5, sources: ['cdc-smallpox-vaccine'] };
const EBOLA_FULL: Sourced = { value: 0.95, sources: ['cdc-ervebo-vaccine'] };
const EBOLA_PARTIAL: Sourced = { value: 0, sources: ['cdc-ervebo-vaccine'] };

/** One MMR entry for measles, mumps or rubella, with that disease's protection. */
function mmr(full: Sourced, partial: Sourced): Vaccine {
	return {
		product: 'MMR',
		label: 'MMR',
		default: true,
		infection: full,
		severe: null,
		partial: { infection: partial, severe: null },
		seriousPer100kDoses: MMR_SERIOUS,
		deathsPer100kDoses: MMR_DEATHS
	};
}

/** A disease's banded rate as per-symptomatic-case values, whatever unit its source used. */
export function perSymptomaticBands(banded: Banded, asymptomaticFraction: Sourced): Bands {
	if (banded.per === 'symptomatic-case') return banded.value;
	if (banded.per === 'infection') {
		return banded.value.map((v) =>
			perSymptomatic({ value: v, sources: banded.sources }, asymptomaticFraction)
		) as Bands;
	}
	throw new Error(`a disease rate can't be counted per ${banded.per}`);
}

/**
 * Disease presets. Every number carries the ids of its sources in citations.ts.
 * Durations are in days; the engine converts them to ticks once, at load.
 */
export const DISEASES = {
	measles: {
		id: 'measles',
		name: 'Measles',
		group: 'common',
		blurb: 'Spreads very easily. People are contagious for about 4 days before the rash appears.',
		r0: {
			value: 15,
			sources: ['guerra2017-measles-r0', 'wallinga2001-measles-r0-europe', 'fu2026-measles-r0-lmic']
		},
		silentDays: {
			value: 4,
			sources: ['cdc-survmanual-measles-2025', 'cdc-pinkbook-measles', 'klinkenberg2011-measles-generation']
		},
		illDays: { value: 5, sources: ['cdc-survmanual-measles-2025', 'cdc-pinkbook-measles'] },
		asymptomaticFraction: { value: 0, sources: ['tranter2024-measles-breakthrough'] },
		mortality: {
			value: 0.002,
			sources: ['cdc-survmanual-measles-2025', 'portnoy2019-measles-cfr-lmic', 'sbarra2023-measles-cfr-lmic']
		},
		waningDays: {
			value: null,
			sources: [
				'cdc-pinkbook-measles',
				'perry2026-measles-ve-wales',
				'griffin2016-measles-immunity',
				'robert2024-measles-waning-england',
				'bolotin2022-measles-waning-review'
			]
		},
		fullEfficacy: MEASLES_FULL,
		partialEfficacy: MEASLES_PARTIAL,
		hospitalisedShare: { value: 0.2, sources: ['cdc-measles-symptoms'] },
		vaccines: [mmr(MEASLES_FULL, MEASLES_PARTIAL)]
	},
	polio: {
		id: 'polio',
		name: 'Polio',
		group: 'eradicated',
		blurb: 'Most people never feel ill, so it spreads quietly until it reaches someone vulnerable.',
		r0: {
			value: 6,
			sources: [
				'fine2024-polio-population-immunity',
				'yaari2016-polio-israel',
				'brouwer2018-polio-rahat',
				'blake2014-polio-older-ages'
			]
		},
		silentDays: { value: 7, sources: ['cdc-pinkbook-polio'] },
		illDays: {
			value: 21,
			sources: [
				'cdc-pinkbook-polio',
				'who2022-polio-position-paper',
				'alexander1997-polio-excretion-review',
				'brouwer2022-polio-shedding-israel',
				'yaari2016-polio-israel'
			]
		},
		asymptomaticFraction: {
			value: 0.96,
			sources: ['cdc-pinkbook-polio', 'who2022-polio-position-paper', 'fatusi1997-polio-epidemiology']
		},
		mortality: {
			value: 0.005,
			sources: ['cdc-pinkbook-polio', 'fatusi1997-polio-epidemiology', 'doshi2011-polio-cfr-india']
		},
		waningDays: { value: null, sources: ['cdc-pinkbook-polio', 'blake2014-polio-older-ages'] },
		// IPV is the default (UK and EU use it): it protects against paralysis, hardly against infection.
		fullEfficacy: POLIO_IPV_INFECTION,
		partialEfficacy: POLIO_IPV_PARTIAL_INFECTION,
		hospitalisedShare: { value: 1, sources: ['cdc-pinkbook-polio'] },
		vaccines: [POLIO_IPV, POLIO_OPV]
	},
	flu: {
		id: 'flu',
		name: 'Seasonal flu',
		group: 'common',
		blurb: 'Spreads fast but people feel ill quickly, which makes it easier to slow down.',
		r0: {
			value: 1.3,
			sources: ['biggerstaff2014-flu-r-review', 'chowell2007-flu-r-us-fr-au', 'truscott2011-flu-mechanisms']
		},
		silentDays: {
			value: 1,
			sources: ['memoli2015-flu-challenge', 'suess2012-flu-shedding-germany', 'lau2010-flu-shedding-hk']
		},
		illDays: { value: 4, sources: ['carrat2008-flu-timelines-review', 'suess2012-flu-shedding-germany'] },
		asymptomaticFraction: {
			value: 0.2,
			sources: [
				'carrat2008-flu-timelines-review',
				'leung2015-flu-asymptomatic-review',
				'furuya2016-flu-asymptomatic-review',
				'cohen2021-flu-phirst-southafrica'
			]
		},
		mortality: {
			value: 0.001,
			sources: [
				'mcdonald2023-flu-cfr-netherlands',
				'iuliano2017-flu-global-mortality',
				'cohen2010-flu-mortality-southafrica',
				'nair2011-flu-children-burden'
			]
		},
		waningDays: {
			value: 180,
			sources: ['truscott2011-flu-mechanisms', 'young2018-flu-ve-waning-review', 'hu2022-flu-ve-waning']
		},
		fullEfficacy: FLU_INFECTION,
		partialEfficacy: FLU_PARTIAL_INFECTION,
		hospitalisedShare: { value: 0.012, sources: ['cdc-flu-burden-2022-23', 'cdc-flu-burden-about'] },
		vaccines: [FLU_INACTIVATED],
		// US 2018-19 season; the 0-17 and 18-64 groups stand in for 0-14 and 15-64.
		mortalityByAge: {
			value: [0.0000386, 0.0003517, 0.009459],
			per: 'symptomatic-case',
			reference: [0.3335, 0.5887, 0.0777],
			overall: 0.000955,
			sources: ['cdc-flu-burden-2018-19']
		},
		hospitalisedByAge: {
			value: [0.004066, 0.007732, 0.09091],
			per: 'symptomatic-case',
			reference: [0.3335, 0.5887, 0.0777],
			overall: 0.01297,
			sources: ['cdc-flu-burden-2018-19']
		}
	},
	covid19: {
		id: 'covid19',
		name: 'COVID-19',
		group: 'common',
		blurb:
			'The 2020 pandemic virus. Many people pass it on before they feel ill, or without ever feeling ill.',
		r0: { value: 3.32, sources: ['alimohamadi-2020-covid-r0'] },
		silentDays: { value: 2, sources: ['alene2021-covid-serial-incubation', 'byrne-2020-infectious-period'] },
		illDays: { value: 7.3, sources: ['rahmani-a-2022-covid-shedding'] },
		asymptomaticFraction: COVID19_ASYMPTOMATIC,
		infectionFatalityRate: COVID19_IFR,
		mortality: {
			value: perSymptomatic(COVID19_IFR, COVID19_ASYMPTOMATIC),
			sources: ['meyerowitzkatz2020-covid-ifr', 'ward-2024-covid-ihr-ifr']
		},
		mortalityByAge: COVID19_DEATHS_BY_AGE,
		hospitalisedByAge: COVID19_HOSPITAL_BY_AGE,
		waningDays: {
			value: 660,
			sources: ['stein2023-covid-past-infection', 'chemaitelly-2022-natural-immunity-waning']
		},
		fullEfficacy: COVID19_MRNA_ORIGINAL.infection,
		partialEfficacy: COVID19_MRNA_ORIGINAL.partial.infection,
		hospitalisedShare: {
			value: perSymptomatic(COVID19_IHR, COVID19_ASYMPTOMATIC),
			sources: ['ward-2024-covid-ihr-ifr', 'buitrago-garcia-2020-asymptomatic-sars-cov-2']
		},
		vaccines: [COVID19_MRNA_ORIGINAL, COVID19_CHADOX1]
	},
	covid19omicron: {
		id: 'covid19omicron',
		name: 'COVID-19 (Omicron era)',
		group: 'common',
		blurb:
			'The 2022 variant. It spreads far faster than the 2020 virus and is milder per case, and the original vaccine stops it less well.',
		r0: { value: 8.4, sources: ['perez-guzman-2023-omicron', 'liu-rocklov-2022-omicron-r'] },
		silentDays: {
			value: 0.3,
			sources: [
				'madewell-2023-omicron-serial',
				'wu-2022-incubation-variants',
				'alene2021-covid-serial-incubation',
				'byrne-2020-infectious-period'
			]
		},
		illDays: { value: 5, sources: ['wu-2023-omicron-shedding'] },
		asymptomaticFraction: OMICRON_ASYMPTOMATIC,
		infectionFatalityRate: OMICRON_IFR,
		mortality: {
			value: perSymptomatic(OMICRON_IFR, OMICRON_ASYMPTOMATIC),
			sources: ['meyerowitzkatz2020-covid-ifr', 'perez-guzman-2023-omicron']
		},
		waningDays: { value: 195, sources: ['bobrovitz-2023-omicron-reinfection'] },
		fullEfficacy: { value: 0.234, sources: ['mohammed-2023-omicron-ve'] },
		partialEfficacy: { value: 0.136, sources: ['tan-2022-omicron-children-partial'] },
		hospitalisedShare: {
			value: OMICRON_HOSPITAL_PER_INFECTION / (1 - OMICRON_ASYMPTOMATIC.value),
			sources: ['ward-2024-covid-ihr-ifr', 'perez-guzman-2023-omicron']
		}
	},
	chickenpox: {
		id: 'chickenpox',
		name: 'Chickenpox',
		group: 'common',
		blurb: 'Very catching and usually mild. Almost everyone used to get it as a child.',
		r0: { value: 5, sources: ['santermans-2015-vzv-r0'] },
		silentDays: { value: 2, sources: ['cdc-pinkbook-varicella'] },
		illDays: { value: 5, sources: ['cdc-pinkbook-varicella'] },
		asymptomaticFraction: { value: 0.05, sources: ['who-varicella-position-paper-2014'] },
		mortality: { value: 2e-5, sources: ['cdc-pinkbook-varicella'] },
		waningDays: { value: null, sources: ['cdc-pinkbook-varicella'] },
		fullEfficacy: CHICKENPOX_FULL,
		partialEfficacy: CHICKENPOX_PARTIAL,
		hospitalisedShare: { value: 0.0015, sources: ['cdc-pinkbook-varicella'] },
		vaccines: [
			{
				product: 'varicella',
				label: 'Chickenpox vaccine',
				default: true,
				infection: CHICKENPOX_FULL,
				severe: null,
				partial: {
					infection: CHICKENPOX_PARTIAL,
					severe: { value: 0.98, sources: ['marin-2016-varicella-ma'] }
				},
				seriousPer100kDoses: { value: 1.3, sources: ['moro-2022-varicella-vaers'] },
				deathsPer100kDoses: { value: null, sources: ['moro-2022-varicella-vaers'] }
			}
		]
	},
	mumps: {
		id: 'mumps',
		name: 'Mumps',
		group: 'common',
		blurb: 'Swollen glands. Spreads easily in crowded places, even among some vaccinated people.',
		r0: { value: 11, sources: ['gupta-2005-mumps-r0'] },
		silentDays: { value: 2, sources: ['cdc-pinkbook-mumps'] },
		illDays: { value: 5, sources: ['cdc-pinkbook-mumps'] },
		asymptomaticFraction: { value: 0.2, sources: ['cdc-pinkbook-mumps'] },
		mortality: { value: 0.0001, sources: ['cdc-pinkbook-mumps'] },
		waningDays: { value: 15000, sources: ['cdc-pinkbook-mumps'] },
		fullEfficacy: MUMPS_FULL,
		partialEfficacy: MUMPS_PARTIAL,
		hospitalisedShare: { value: 0.01, sources: ['cdc-pinkbook-mumps'] },
		vaccines: [mmr(MUMPS_FULL, MUMPS_PARTIAL)]
	},
	rubella: {
		id: 'rubella',
		name: 'Rubella',
		group: 'common',
		blurb: 'Mild for most, and half of people never notice it, but dangerous in pregnancy.',
		r0: { value: 5, sources: ['papadopoulos-2022-rubella-r0'] },
		silentDays: { value: 7, sources: ['cdc-pinkbook-rubella'] },
		illDays: { value: 7, sources: ['cdc-pinkbook-rubella'] },
		asymptomaticFraction: { value: 0.5, sources: ['cdc-pinkbook-rubella'] },
		mortality: { value: 1e-5, sources: ['cdc-pinkbook-rubella'] },
		waningDays: { value: null, sources: ['cdc-pinkbook-rubella'] },
		fullEfficacy: RUBELLA_FULL,
		partialEfficacy: RUBELLA_PARTIAL,
		hospitalisedShare: { value: 0.001, sources: ['cdc-pinkbook-rubella'] },
		vaccines: [mmr(RUBELLA_FULL, RUBELLA_PARTIAL)]
	},
	pertussis: {
		id: 'pertussis',
		name: 'Whooping cough',
		group: 'common',
		blurb: 'A cough that lasts for weeks. People keep going about their lives, so it keeps spreading.',
		r0: { value: 5.5, sources: ['kretzschmar-2010-pertussis-r0'] },
		silentDays: { value: 7, sources: ['cdc-pinkbook-pertussis'] },
		illDays: { value: 21, sources: ['cdc-pinkbook-pertussis'] },
		asymptomaticFraction: {
			value: 0.35,
			sources: ['kretzschmar-2010-pertussis-r0', 'craig-2020-pertussis-asymptomatic']
		},
		mortality: { value: 0.002, sources: ['cdc-pinkbook-pertussis'] },
		waningDays: { value: 4380, sources: ['cdc-pinkbook-pertussis'] },
		fullEfficacy: PERTUSSIS_FULL,
		partialEfficacy: PERTUSSIS_PARTIAL,
		hospitalisedShare: { value: 0.05, sources: ['cdc-pinkbook-pertussis'] },
		vaccines: [
			{
				product: 'DTaP',
				label: 'Acellular whooping cough vaccine (DTaP)',
				default: true,
				infection: PERTUSSIS_FULL,
				severe: null,
				partial: { infection: PERTUSSIS_PARTIAL, severe: null },
				seriousPer100kDoses: { value: 10, sources: ['cdc-pinkbook-pertussis'] },
				deathsPer100kDoses: { value: null, sources: ['cdc-pinkbook-pertussis'] }
			}
		]
	},
	smallpox: {
		id: 'smallpox',
		name: 'Smallpox',
		group: 'eradicated',
		blurb: 'Killed about 3 in 10 people it made ill. Wiped out in 1980, so almost no one is protected now.',
		r0: { value: 5, sources: ['costantino2018-smallpox-r0', 'gani-2001-smallpox-r0'] },
		silentDays: { value: 0, sources: ['cdc-smallpox-signs-symptoms', 'cdc-smallpox-clinical-signs'] },
		illDays: { value: 16, sources: ['cdc-smallpox-signs-symptoms', 'who-smallpox-qa'] },
		asymptomaticFraction: { value: 0, sources: ['who-smallpox-eradication-subclinical'] },
		mortality: { value: 0.3, sources: ['who-smallpox-qa', 'cdc-smallpox-clinical-signs'] },
		waningDays: { value: null, sources: ['cdc-smallpox-clinical-signs'] },
		fullEfficacy: SMALLPOX_FULL,
		partialEfficacy: SMALLPOX_PARTIAL,
		hospitalisedShare: { value: 0.9, sources: ['cdc-smallpox-signs-symptoms'] },
		coverageToday: {
			value: 0,
			sources: ['gani-2001-smallpox-r0', 'cdc-smallpox-vaccine', 'who-smallpox-qa']
		},
		vaccines: [
			{
				product: 'vaccinia',
				label: 'Vaccinia (the 1960s vaccine)',
				default: true,
				infection: SMALLPOX_FULL,
				severe: null,
				partial: { infection: SMALLPOX_PARTIAL, severe: null },
				seriousPer100kDoses: { value: 7.4, sources: ['lane-1969-smallpox-complications'] },
				deathsPer100kDoses: { value: 0.1, sources: ['lane-1969-smallpox-complications'] }
			}
		]
	},
	ebola: {
		id: 'ebola',
		name: 'Ebola',
		group: 'deadly',
		blurb:
			'Kills about half of those who fall ill, but they are soon too sick to move about, so it spreads less far.',
		r0: { value: 1.95, sources: ['muzembo2024-ebola-r0', 'vankerkhove-2015-ebola-parameters'] },
		silentDays: { value: 0, sources: ['who-ebola-factsheet'] },
		illDays: { value: 10, sources: ['who-ebola-factsheet'] },
		asymptomaticFraction: {
			value: 0,
			sources: ['dean2016-ebola-asymptomatic', 'glynn-2017-asymptomatic-ebola']
		},
		mortality: { value: 0.5, sources: ['who-ebola-factsheet', 'vankerkhove-2015-ebola-parameters'] },
		waningDays: { value: null, sources: ['rimoin-2018-ebola-antibodies-40-years'] },
		fullEfficacy: EBOLA_FULL,
		partialEfficacy: EBOLA_PARTIAL,
		hospitalisedShare: { value: 1, sources: ['who-ebola-treatment-centre'] },
		vaccines: [
			{
				product: 'rVSV-ZEBOV',
				label: 'Ervebo (rVSV-ZEBOV, one dose)',
				default: true,
				infection: EBOLA_FULL,
				severe: null,
				partial: { infection: EBOLA_PARTIAL, severe: null },
				seriousPer100kDoses: { value: 19.5, sources: ['choi-2021-acip-ebola'] },
				deathsPer100kDoses: { value: null, sources: ['choi-2021-acip-ebola'] }
			}
		]
	},
	marburg: {
		id: 'marburg',
		name: 'Marburg',
		group: 'deadly',
		blurb:
			'A close cousin of Ebola. Very deadly and no vaccine, but it spreads mainly to people caring for the sick.',
		r0: { value: 1.59, sources: ['ajelli-2012-marburg-transmission', 'cuomodannenburg2024-marburg-review'] },
		silentDays: { value: 0, sources: ['who-marburg-factsheet'] },
		illDays: { value: 8, sources: ['who-marburg-factsheet', 'ajelli-2012-marburg-transmission'] },
		asymptomaticFraction: {
			value: 0,
			sources: ['glynn-2017-asymptomatic-ebola', 'semancik-2024-filovirus-seroprevalence']
		},
		mortality: { value: 0.5, sources: ['who-marburg-factsheet'] },
		waningDays: { value: null, sources: ['natesan-2016-filovirus-antibody-persistence'] },
		fullEfficacy: { value: 0, sources: ['who-marburg-factsheet'] },
		partialEfficacy: { value: 0, sources: ['who-marburg-factsheet'] },
		hospitalisedShare: { value: 1, sources: ['who-marburg-treatment-centre'] }
	},
	flu1918: {
		id: 'flu1918',
		name: '1918 flu ("Spanish flu")',
		group: 'historic',
		blurb:
			'The 1918 pandemic flu. Unlike ordinary flu, a large share of the people it killed were young adults.',
		r0: { value: 1.8, sources: ['biggerstaff2014-flu-r-review'] },
		// No 1918-specific contagious periods exist: seasonal flu's, checked against the 1918 serial interval.
		silentDays: {
			value: 1,
			sources: [
				'memoli2015-flu-challenge',
				'suess2012-flu-shedding-germany',
				'lau2010-flu-shedding-hk',
				'white-pagano-2008-1918-serial',
				'vink-2014-serial-intervals'
			]
		},
		illDays: {
			value: 4,
			sources: [
				'carrat2008-flu-timelines-review',
				'suess2012-flu-shedding-germany',
				'white-pagano-2008-1918-serial',
				'vink-2014-serial-intervals'
			]
		},
		asymptomaticFraction: { value: 0, sources: ['fraser-2011-1918-households'] },
		mortality: { value: 0.017, sources: ['britten-1932-phr-1918-canvass', 'morabia-2021-1918-canvass'] },
		waningDays: { value: null, sources: ['yu-2008-1918-survivor-antibodies'] },
		fullEfficacy: { value: 0, sources: ['cdc-1918-pandemic-page'] },
		partialEfficacy: { value: 0, sources: ['cdc-1918-pandemic-page'] },
		// Lower bound: everyone who died of it needed a bed, and no 1918 hospital figure exists.
		hospitalisedShare: {
			value: 0.017,
			sources: ['britten-1932-phr-1918-canvass', 'morabia-2021-1918-canvass']
		},
		// Reported cases by age (Britten 1932, Tables 7 and 28): 15,761 / 25,927 / 666 cases.
		mortalityByAge: {
			value: [0.0115, 0.0195, 0.041],
			per: 'symptomatic-case',
			reference: [15761 / 42354, 25927 / 42354, 666 / 42354],
			overall: 0.017,
			sources: ['britten-1932-phr-1918-canvass', 'morabia-2021-1918-canvass']
		},
		hospitalisedByAge: {
			value: [0.0115, 0.0195, 0.041],
			per: 'symptomatic-case',
			reference: [15761 / 42354, 25927 / 42354, 666 / 42354],
			overall: 0.017,
			sources: ['britten-1932-phr-1918-canvass', 'morabia-2021-1918-canvass']
		}
	}
} satisfies Record<string, DiseaseConfig>;
