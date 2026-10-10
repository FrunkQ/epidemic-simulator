import type { Banded, Bands, DiseaseConfig, Sourced, Vaccine, VaccineDeathRate } from '../sim/types';
import { covid19BandsPerInfection, covid19SevereBandsPerInfection } from './covidAgeIfr';
import {
	BOBROVITZ,
	CHIT,
	CHO,
	CHOI,
	COVID_INFECTION_HALF_LIFE_MONTHS,
	DAYS_PER_MONTH,
	DAYS_PER_YEAR,
	FAMULARE,
	FEIKIN,
	FLU_SERIOUS,
	ALL_VACCINE_ANAPHYLAXIS_PER_MILLION,
	DTAP_SERIOUS_DOSES,
	IPV_ONE_DOSE,
	LANE,
	LEWNARD_HALF_LIFE_YEARS,
	MENEGALE,
	MMR_SERIOUS_PER_100K,
	MORO,
	MRNA_SERIOUS as MRNA_SERIOUS_INPUTS,
	OMICRON_VACCINE,
	OPV_RISK,
	OPV_INTESTINAL_IMMUNITY,
	OMICRON_ONE_DOSE,
	FLU_VACCINE,
	LEWNARD_TAKE,
	COCHRANE_MMR,
	BOLORMAA_ONE_DOSE_YEAR1,
	CHICKENPOX_PARTIAL_SEVERE,
	PERTUSSIS_VACCINE,
	SMALLPOX_START,
	SMALLPOX_SEVERE,
	EBOLA_VACCINE,
	RANJEVA_HALF_LIFE_YEARS,
	SMALLPOX_VACCINE_HALF_LIFE,
	STEIN_40_WEEKS,
	WENDELBOE_HALF_LIFE,
	YOUNG,
	BOLORMAA,
	PLAGUE_AGE_SHARES,
	PLAGUE_ILL_DAYS,
	PLAGUE_INCUBATION_DAYS,
	PLAGUE_MORTALITY,
	PLAGUE_MORTALITY_BANDS,
	PLAGUE_R0,
	per100kFromPerMillion
} from './derived';
import { stackedProtection } from './vaccines';

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
/** The 2020 bands, scaled by the same ratio in every band (6.11: a stated assumption). */
const omicronBands = (b: Banded, extra: string): Banded => ({
	...b,
	value: b.value.map((v) => v * OMICRON_SEVERITY_RATIO) as Bands,
	overall: b.overall * OMICRON_SEVERITY_RATIO,
	sources: [...b.sources, extra]
});
const OMICRON_DEATHS_BY_AGE = omicronBands(COVID19_DEATHS_BY_AGE, 'perez-guzman-2023-omicron');
const OMICRON_HOSPITAL_BY_AGE = omicronBands(COVID19_HOSPITAL_BY_AGE, 'perez-guzman-2023-omicron');

/*
 * Vaccines. Each disease's `fullEfficacy` and `partialEfficacy` are its default vaccine's
 * infection values (the same objects), kept for the herd-immunity line; the engine reads `vaccines`.
 * Risk rates are per 100,000 doses; deaths use VaccineDeathRate (6.13). Worked-out numbers come
 * from derived.ts, which citations.ts also uses for its prose.
 */

/** MMR's risks, the same vaccine whichever of the three diseases it is given against. */
const MMR_SERIOUS: Sourced = { value: MMR_SERIOUS_PER_100K, sources: ['cdc-pinkbook-measles'] };
/** MMR: deaths confirmed only in people with immune deficiencies, for whom it isn't recommended (IOM 2012). */
const MMR_DEATHS: VaccineDeathRate = {
	kind: 'established-no-rate',
	group: 'people with severe immune deficiencies',
	text: 'The measles part of the vaccine can cause a brain infection (measles inclusion body encephalitis) in people with severe immune deficiencies, and it is almost always fatal. No study has measured how often.',
	sources: ['iom-2012-adverse-effects-vaccines']
};

/**
 * mRNA serious events: myocarditis or pericarditis, plus anaphylaxis. Ling counts pericarditis,
 * which is often mild, so any breakdown labels that line "myocarditis or pericarditis".
 */
const MRNA_SERIOUS: Sourced = {
	value: MRNA_SERIOUS_INPUTS.per100k,
	sources: [
		'ling-2022-myopericarditis-meta',
		'greenhawt-2021-covid-vaccine-anaphylaxis-meta',
		'oster-2022-mrna-myocarditis'
	]
};
/** At least this many: Cho counts only deaths proven at autopsy. */
const MRNA_DEATHS: VaccineDeathRate = {
	kind: 'rate',
	value: CHO.per100k,
	lowerBound: true,
	sources: [
		'cho-2023-korea-vaccine-myocarditis',
		'xu-2021-covid-vaccine-mortality',
		'cdc-covid-vaccine-safety-2025'
	]
};

/** The 2021 vaccines against the 2020 virus (Liu 2021: all types pooled, mostly mRNA). */
const COVID19_2021 = {
	product: 'covid',
	version: 'original',
	label: 'COVID-19 vaccine (2021)',
	default: true,
	full: {
		infection: { value: FEIKIN.start, sources: ['liu-2021-realworld-ve-meta', 'kow-2021-bnt-ma'] },
		severe: { value: 0.93, sources: ['liu-2021-realworld-ve-meta'] }
	},
	partial: {
		infection: { value: 0.41, sources: ['liu-2021-realworld-ve-meta', 'kow-2021-bnt-ma'] },
		severe: { value: 0.66, sources: ['liu-2021-realworld-ve-meta'] }
	},
	seriousPer100kDoses: MRNA_SERIOUS,
	deathsPer100kDoses: MRNA_DEATHS,
	waningDays: { value: FEIKIN.halfLife, sources: ['feikin-2022-covid-ve-duration'] }
} satisfies Vaccine;

/** Original vaccine against Omicron infection: the pure exponential part, ln2/w. */
const OMICRON_VACCINE_WANING: Sourced = {
	value: MENEGALE.halfLife,
	sources: ['menegale-2023-waning-meta']
};

const OMICRON_ORIGINAL = {
	product: 'covid',
	version: 'original',
	label: 'Original vaccine',
	full: {
		infection: {
			value: OMICRON_VACCINE.originalInfection,
			sources: ['menegale-2023-waning-meta', 'shao-2022-omicron-ve-meta']
		},
		severe: { value: OMICRON_VACCINE.originalSevere, sources: ['mohammed-2023-omicron-ve'] }
	},
	partial: {
		infection: { value: OMICRON_ONE_DOSE.infection, sources: ['shao-2022-omicron-ve-meta'] },
		// Worked out: Shao's one-dose figure with Tan's matched breakthrough factor kept.
		severe: {
			value: OMICRON_ONE_DOSE.severe,
			sources: ['shao-2022-omicron-ve-meta', 'tan-2022-omicron-children-partial']
		}
	},
	seriousPer100kDoses: MRNA_SERIOUS,
	deathsPer100kDoses: MRNA_DEATHS,
	waningDays: OMICRON_VACCINE_WANING
} satisfies Vaccine;

const OMICRON_UPDATED = {
	product: 'covid',
	version: 'updated',
	label: 'Updated vaccine (bivalent)',
	default: true,
	full: {
		infection: {
			value: stackedProtection(OMICRON_VACCINE.bivalentRelativeInfection, OMICRON_VACCINE.originalInfection),
			sources: ['cheng-2024-bivalent-rve-meta', 'menegale-2023-waning-meta']
		},
		severe: {
			value: stackedProtection(OMICRON_VACCINE.bivalentRelativeSevere, OMICRON_VACCINE.originalSevere),
			sources: ['cheng-2024-bivalent-rve-meta', 'mohammed-2023-omicron-ve']
		}
	},
	seriousPer100kDoses: MRNA_SERIOUS,
	deathsPer100kDoses: MRNA_DEATHS,
	waningDays: OMICRON_VACCINE_WANING
} satisfies Vaccine;

/** Exported for tests: the constants behind the updated vaccine's worked-out protection. */
export const OMICRON_VACCINE_INPUTS = OMICRON_VACCINE;

/** Worked out: the start whose season average, waning on Young's half-life, is Guo's 41.4% (6.13). */
const FLU_INFECTION: Sourced = {
	value: FLU_VACCINE.start,
	sources: ['guo2024-flu-ve-review', 'young2018-flu-ve-waning-review', 'belongia2016-flu-ve-review']
};
/** One flu dose a season: no unfinished course, so no partial entry. */
const FLU_INACTIVATED: Vaccine = {
	product: 'inactivated',
	label: 'Typical season',
	default: true,
	full: {
		infection: FLU_INFECTION,
		// Worked out: the season figures' matched breakthrough factor, kept at the new start.
		severe: {
			value: FLU_VACCINE.severe,
			sources: ['yegorov-2025-flu-severe-ma', 'guo2024-flu-ve-review', 'rondy-2017-flu-hosp-ma']
		}
	},
	cardNote: `Averaged over a season it protects about ${Math.round(FLU_VACCINE.seasonAverage * 100)} in 100 (Guo 2024).`,
	seriousPer100kDoses: {
		value: FLU_SERIOUS.per100k,
		sources: ['cdc-flu-gbs-2024', 'mcneil-2016-anaphylaxis']
	},
	deathsPer100kDoses: {
		kind: 'none-established',
		sources: ['miller-2015-deaths-after-vaccination', 'iom-2012-adverse-effects-vaccines']
	},
	waningDays: {
		value: YOUNG.halfLife,
		sources: ['young2018-flu-ve-waning-review', 'hu2022-flu-ve-waning']
	}
};

/** IPV hardly stops infection (Hird 2012), for a full or a partial course. */
const POLIO_IPV_INFECTION: Sourced = { value: 0, sources: ['hird2012-ipv-mucosal-review'] };
const POLIO_IPV_PARTIAL_INFECTION: Sourced = { value: 0, sources: ['hird2012-ipv-mucosal-review'] };
const POLIO_IPV: Vaccine = {
	product: 'IPV',
	label: 'Inactivated (IPV, injected)',
	default: true,
	full: { infection: POLIO_IPV_INFECTION, severe: { value: 0.99, sources: ['cdc-pinkbook-polio'] } },
	partial: {
		infection: POLIO_IPV_PARTIAL_INFECTION,
		severe: { value: IPV_ONE_DOSE, sources: ['grassly2014-ipv-doses-review', 'cooper2024-ipv-nigeria'] }
	},
	seriousPer100kDoses: {
		value: per100kFromPerMillion(ALL_VACCINE_ANAPHYLAXIS_PER_MILLION),
		sources: ['cdc-pinkbook-polio', 'mcneil-2016-anaphylaxis']
	},
	deathsPer100kDoses: { kind: 'none-established', sources: ['cdc-acip-2024-ipv-etr'] },
	// CDC: IPV "probably provides lifelong immunity after a complete series".
	waningDays: { value: null, sources: ['cdc-pinkbook-polio'] }
};
const POLIO_OPV: Vaccine = {
	product: 'OPV',
	label: 'Oral, three-type (OPV, used until 2016)',
	full: {
		infection: { value: OPV_INTESTINAL_IMMUNITY, sources: ['macklin-2019-polio-schedules-nma'] },
		severe: { value: 0.95, sources: ['cdc-pinkbook-polio'] }
	},
	partial: { severe: { value: 0.5, sources: ['cdc-pinkbook-polio'] } },
	seriousPer100kDoses: { value: OPV_RISK.vappPer100k, sources: ['cdc-pinkbook-polio'] },
	// Worked out: vaccine-caused paralysis x the death rate for paralytic polio.
	deathsPer100kDoses: {
		kind: 'rate',
		value: OPV_RISK.deathsPer100k,
		sources: ['cdc-pinkbook-polio', 'miller-2015-deaths-after-vaccination']
	},
	// Gut immunity against infection; protection against paralysis lasts (full.severe stays).
	waningDays: {
		value: FAMULARE.halfLife,
		sources: ['famulare2018-opv-waning']
	}
};

const MEASLES_FULL: Sourced = {
	value: COCHRANE_MMR.measles.full,
	sources: [
		'dipietrantonj2021-cochrane-mmrv',
		'uzicanin2011-measles-ve-review',
		'benet2025-measles-ve-france',
		'perry2026-measles-ve-wales'
	]
};
const MEASLES_PARTIAL: Sourced = {
	value: COCHRANE_MMR.measles.partial,
	sources: ['dipietrantonj2021-cochrane-mmrv', 'uzicanin2011-measles-ve-review']
};
/** Lewnard's take, six months after a dose: the same for one dose or two (no difference in waning). */
const MUMPS_FULL: Sourced = { value: LEWNARD_TAKE, sources: ['lewnard-grad-2018-mumps-waning'] };
const MUMPS_PARTIAL: Sourced = { value: LEWNARD_TAKE, sources: ['lewnard-grad-2018-mumps-waning'] };
const RUBELLA_PROVISIONAL =
	'One cohort in China, mixing BRD-II (a strain used only there) and RA27/3 strains; doses not split.';
const RUBELLA_FULL: Sourced = {
	value: COCHRANE_MMR.rubella,
	sources: ['dipietrantonj2021-cochrane-mmrv'],
	provisional: RUBELLA_PROVISIONAL
};
const RUBELLA_PARTIAL: Sourced = {
	value: COCHRANE_MMR.rubella,
	sources: ['dipietrantonj2021-cochrane-mmrv'],
	provisional: RUBELLA_PROVISIONAL
};
const CHICKENPOX_FULL: Sourced = {
	value: BOLORMAA.early.ve / 100,
	sources: ['bolormaa2025-varicella-duration']
};
const CHICKENPOX_PARTIAL: Sourced = {
	value: BOLORMAA_ONE_DOSE_YEAR1,
	sources: ['bolormaa2025-varicella-duration']
};
const PERTUSSIS_FULL: Sourced = {
	value: PERTUSSIS_VACCINE.full,
	sources: ['fulton-2016-pertussis-vaccines-ma']
};
const PERTUSSIS_PARTIAL: Sourced = {
	value: 0.5,
	sources: [],
	provisional:
		'No pooled figure for an unfinished course; single studies range from 0% after one dose to 70% after two.'
};
const SMALLPOX_FULL: Sourced = { value: SMALLPOX_START, sources: ['cdc-smallpox-vaccine'] };
const EBOLA_FULL: Sourced = {
	value: EBOLA_VACCINE.infection,
	sources: ['meakin-2024-ebola-vaccine-effectiveness']
};

/** One MMR entry for measles, mumps or rubella, with that disease's protection and waning. */
function mmr(full: Sourced, partial: Sourced, waningDays: Sourced<number | null>): Vaccine {
	return {
		product: 'MMR',
		label: 'MMR',
		default: true,
		full: { infection: full },
		partial: { infection: partial },
		seriousPer100kDoses: MMR_SERIOUS,
		deathsPer100kDoses: MMR_DEATHS,
		waningDays
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
		proseName: 'measles',
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
		mortalityBasis: 'modern-care',
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
		vaccines: [
			mmr(MEASLES_FULL, MEASLES_PARTIAL, {
				value: null,
				sources: [
					'cdc-pinkbook-measles',
					'perry2026-measles-ve-wales',
					'robert2024-measles-waning-england',
					'bolotin2022-measles-waning-review'
				]
			})
		]
	},
	polio: {
		id: 'polio',
		name: 'Polio',
		proseName: 'polio',
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
		mortalityBasis: 'modern-care',
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
		proseName: 'seasonal flu',
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
		mortalityBasis: 'modern-care',
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
			value: RANJEVA_HALF_LIFE_YEARS * DAYS_PER_YEAR,
			sources: ['ranjeva2019-flu-infection-protection']
		},
		fullEfficacy: FLU_INFECTION,
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
		proseName: 'COVID-19',
		group: 'common',
		blurb:
			'The 2020 pandemic virus. Many people pass it on before they feel ill, or without ever feeling ill.',
		r0: { value: 3.32, sources: ['alimohamadi-2020-covid-r0'] },
		silentDays: { value: 2, sources: ['alene2021-covid-serial-incubation', 'byrne-2020-infectious-period'] },
		illDays: { value: 7.3, sources: ['rahmani-a-2022-covid-shedding'] },
		asymptomaticFraction: COVID19_ASYMPTOMATIC,
		infectionFatalityRate: COVID19_IFR,
		mortalityBasis: 'modern-care',
		mortality: {
			value: perSymptomatic(COVID19_IFR, COVID19_ASYMPTOMATIC),
			sources: ['meyerowitzkatz2020-covid-ifr', 'ward-2024-covid-ihr-ifr']
		},
		mortalityByAge: COVID19_DEATHS_BY_AGE,
		hospitalisedByAge: COVID19_HOSPITAL_BY_AGE,
		waningDays: {
			value: COVID_INFECTION_HALF_LIFE_MONTHS * DAYS_PER_MONTH,
			sources: ['stein2023-covid-past-infection', 'chemaitelly-2022-natural-immunity-waning']
		},
		afterInfection: {
			infection: {
				value: STEIN_40_WEEKS.preOmicron.reinfection,
				sources: ['stein2023-covid-past-infection']
			},
			severe: { value: STEIN_40_WEEKS.preOmicron.severe, sources: ['stein2023-covid-past-infection'] }
		},
		fullEfficacy: COVID19_2021.full.infection,
		partialEfficacy: COVID19_2021.partial.infection,
		hospitalisedShare: {
			value: perSymptomatic(COVID19_IHR, COVID19_ASYMPTOMATIC),
			sources: ['ward-2024-covid-ihr-ifr', 'buitrago-garcia-2020-asymptomatic-sars-cov-2']
		},
		vaccines: [COVID19_2021]
	},
	covid19omicron: {
		id: 'covid19omicron',
		name: 'COVID-19 (Omicron era)',
		proseName: 'COVID-19 in the Omicron era',
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
		mortalityBasis: 'modern-care',
		mortality: {
			value: perSymptomatic(OMICRON_IFR, OMICRON_ASYMPTOMATIC),
			sources: ['meyerowitzkatz2020-covid-ifr', 'perez-guzman-2023-omicron']
		},
		waningDays: { value: BOBROVITZ.halfLife, sources: ['bobrovitz-2023-omicron-reinfection'] },
		// Mostly pre-Omicron infections against BA.1 reinfection, not Omicron against Omicron.
		afterInfection: {
			infection: { value: STEIN_40_WEEKS.ba1.reinfection, sources: ['stein2023-covid-past-infection'] },
			severe: { value: STEIN_40_WEEKS.ba1.severe, sources: ['stein2023-covid-past-infection'] }
		},
		// The default (updated) vaccine has no partial course, so it has no partialEfficacy (6.13).
		fullEfficacy: OMICRON_UPDATED.full.infection,
		hospitalisedShare: {
			value: OMICRON_HOSPITAL_PER_INFECTION / (1 - OMICRON_ASYMPTOMATIC.value),
			sources: ['ward-2024-covid-ihr-ifr', 'perez-guzman-2023-omicron']
		},
		mortalityByAge: OMICRON_DEATHS_BY_AGE,
		hospitalisedByAge: OMICRON_HOSPITAL_BY_AGE,
		vaccines: [OMICRON_ORIGINAL, OMICRON_UPDATED]
	},
	chickenpox: {
		id: 'chickenpox',
		name: 'Chickenpox',
		proseName: 'chickenpox',
		group: 'common',
		blurb: 'Very catching and usually mild. Almost everyone used to get it as a child.',
		r0: { value: 5, sources: ['santermans-2015-vzv-r0'] },
		silentDays: { value: 2, sources: ['cdc-pinkbook-varicella'] },
		illDays: { value: 5, sources: ['cdc-pinkbook-varicella'] },
		asymptomaticFraction: { value: 0.05, sources: ['who-varicella-position-paper-2014'] },
		mortalityBasis: 'modern-care',
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
				full: { infection: CHICKENPOX_FULL },
				partial: {
					infection: CHICKENPOX_PARTIAL,
					// Worked out: Bolormaa's year-1 figure with Marin's matched breakthrough factor kept.
					severe: {
						value: CHICKENPOX_PARTIAL_SEVERE,
						sources: ['marin-2016-varicella-ma', 'bolormaa2025-varicella-duration']
					}
				},
				seriousPer100kDoses: { value: 1.3, sources: ['moro-2022-varicella-vaers'] },
				// Worked out: vaccine-strain deaths per dose, mostly in people the vaccine wasn't recommended for.
				deathsPer100kDoses: {
					kind: 'rate',
					value: MORO.per100k,
					sources: ['moro-2022-varicella-vaers']
				},
				waningDays: {
					value: BOLORMAA.halfLife,
					sources: ['bolormaa2025-varicella-duration', 'pawaskar2022-varicella-nma']
				}
			}
		]
	},
	mumps: {
		id: 'mumps',
		name: 'Mumps',
		proseName: 'mumps',
		group: 'common',
		blurb: 'Swollen glands. Spreads easily in crowded places, even among some vaccinated people.',
		r0: { value: 11, sources: ['gupta-2005-mumps-r0'] },
		silentDays: { value: 2, sources: ['cdc-pinkbook-mumps'] },
		illDays: { value: 5, sources: ['cdc-pinkbook-mumps'] },
		asymptomaticFraction: { value: 0.2, sources: ['cdc-pinkbook-mumps'] },
		mortalityBasis: 'modern-care',
		mortality: { value: 0.0001, sources: ['cdc-pinkbook-mumps'] },
		waningDays: { value: null, sources: ['who-2007-mumps-position-paper'] },
		fullEfficacy: MUMPS_FULL,
		partialEfficacy: MUMPS_PARTIAL,
		hospitalisedShare: { value: 0.01, sources: ['cdc-pinkbook-mumps'] },
		vaccines: [
			mmr(MUMPS_FULL, MUMPS_PARTIAL, {
				value: LEWNARD_HALF_LIFE_YEARS * DAYS_PER_YEAR,
				sources: ['lewnard-grad-2018-mumps-waning']
			})
		]
	},
	rubella: {
		id: 'rubella',
		name: 'Rubella',
		proseName: 'rubella',
		group: 'common',
		blurb: 'Mild for most, and half of people never notice it, but dangerous in pregnancy.',
		r0: { value: 5, sources: ['papadopoulos-2022-rubella-r0'] },
		silentDays: { value: 7, sources: ['cdc-pinkbook-rubella'] },
		illDays: { value: 7, sources: ['cdc-pinkbook-rubella'] },
		asymptomaticFraction: { value: 0.5, sources: ['cdc-pinkbook-rubella'] },
		mortalityBasis: 'modern-care',
		mortality: { value: 1e-5, sources: ['cdc-pinkbook-rubella'] },
		waningDays: { value: null, sources: ['who-2020-rubella-position-paper'] },
		fullEfficacy: RUBELLA_FULL,
		partialEfficacy: RUBELLA_PARTIAL,
		hospitalisedShare: { value: 0.001, sources: ['cdc-pinkbook-rubella'] },
		vaccines: [mmr(RUBELLA_FULL, RUBELLA_PARTIAL, { value: null, sources: ['cdc-pinkbook-rubella'] })]
	},
	pertussis: {
		id: 'pertussis',
		name: 'Whooping cough',
		proseName: 'whooping cough',
		group: 'common',
		blurb: 'A cough that lasts for weeks. People keep going about their lives, so it keeps spreading.',
		r0: { value: 5.5, sources: ['kretzschmar-2010-pertussis-r0'] },
		silentDays: { value: 7, sources: ['cdc-pinkbook-pertussis'] },
		illDays: { value: 21, sources: ['cdc-pinkbook-pertussis'] },
		asymptomaticFraction: {
			value: 0.35,
			sources: ['kretzschmar-2010-pertussis-r0', 'craig-2020-pertussis-asymptomatic']
		},
		mortalityBasis: 'modern-care',
		mortality: { value: 0.002, sources: ['cdc-pinkbook-pertussis'] },
		// Worked out: the middle of Wendelboe 2005's 4-20 years after infection, read as a half-life.
		waningDays: {
			value: WENDELBOE_HALF_LIFE,
			sources: ['wendelboe2005-pertussis-immunity-duration']
		},
		fullEfficacy: PERTUSSIS_FULL,
		partialEfficacy: PERTUSSIS_PARTIAL,
		hospitalisedShare: { value: 0.05, sources: ['cdc-pinkbook-pertussis'] },
		vaccines: [
			{
				product: 'DTaP',
				label: 'Acellular whooping cough vaccine (DTaP)',
				default: true,
				full: {
					infection: PERTUSSIS_FULL,
					severe: { value: PERTUSSIS_VACCINE.fullSevere, sources: ['radke-2017-pertussis-ve-nz'] }
				},
				partial: {
					infection: PERTUSSIS_PARTIAL,
					severe: { value: PERTUSSIS_VACCINE.partialSevere, sources: ['who-2015-pertussis-position-paper'] }
				},
				seriousPer100kDoses: { value: 100_000 / DTAP_SERIOUS_DOSES, sources: ['cdc-pinkbook-pertussis'] },
				deathsPer100kDoses: { kind: 'none-established', sources: ['iom-2003-vaccines-sudi'] },
				waningDays: {
					value: CHIT.halfLife,
					sources: ['chit2018-acellular-pertussis-ve-waning', 'mcgirr-fisman-2015-dtap-duration']
				}
			}
		]
	},
	smallpox: {
		id: 'smallpox',
		name: 'Smallpox',
		proseName: 'smallpox',
		group: 'eradicated',
		blurb: 'Killed about 3 in 10 people it made ill. Wiped out in 1980, so almost no one is protected now.',
		r0: { value: 5, sources: ['costantino2018-smallpox-r0', 'gani-2001-smallpox-r0'] },
		silentDays: { value: 0, sources: ['cdc-smallpox-signs-symptoms', 'cdc-smallpox-clinical-signs'] },
		illDays: { value: 16, sources: ['cdc-smallpox-signs-symptoms', 'who-smallpox-qa'] },
		asymptomaticFraction: { value: 0, sources: ['who-smallpox-eradication-subclinical'] },
		mortalityBasis: 'modern-care',
		mortality: { value: 0.3, sources: ['who-smallpox-qa', 'cdc-smallpox-clinical-signs'] },
		waningDays: { value: null, sources: ['cdc-smallpox-clinical-signs'] },
		fullEfficacy: SMALLPOX_FULL,
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
				full: {
					infection: SMALLPOX_FULL,
					// Worked out: Eichner's share of cases still protected against death, as the breakthrough factor.
					severe: { value: SMALLPOX_SEVERE, sources: ['eichner-2003-smallpox-protection'] }
				},
				seriousPer100kDoses: {
					value: per100kFromPerMillion(LANE.complicationsPerMillion),
					sources: ['lane-1969-smallpox-complications']
				},
				deathsPer100kDoses: {
					kind: 'rate',
					value: per100kFromPerMillion(LANE.deathsPerMillion),
					sources: ['lane-1969-smallpox-complications']
				},
				waningDays: {
					value: SMALLPOX_VACCINE_HALF_LIFE,
					sources: [
						'nishiura-2006-smallpox-protection-duration',
						'kunasekaran-2019-smallpox-residual-immunity'
					]
				}
			}
		]
	},
	ebola: {
		id: 'ebola',
		name: 'Ebola',
		proseName: 'Ebola',
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
		mortalityBasis: 'modern-care',
		mortality: { value: 0.5, sources: ['who-ebola-factsheet', 'vankerkhove-2015-ebola-parameters'] },
		waningDays: { value: null, sources: ['rimoin-2018-ebola-antibodies-40-years'] },
		fullEfficacy: EBOLA_FULL,
		hospitalisedShare: { value: 1, sources: ['who-ebola-treatment-centre'] },
		vaccines: [
			{
				product: 'rVSV-ZEBOV',
				label: 'Ervebo (rVSV-ZEBOV, one dose)',
				default: true,
				full: {
					infection: EBOLA_FULL,
					// Worked out: 1 - (1 - Meakin's 84%) x Coulborn's relative risk of death 0.40.
					severe: {
						value: EBOLA_VACCINE.severe,
						sources: ['meakin-2024-ebola-vaccine-effectiveness', 'coulborn-2024-ebola-vaccinated-cfr']
					}
				},
				seriousPer100kDoses: { value: CHOI.per100k, sources: ['choi-2021-acip-ebola'] },
				deathsPer100kDoses: {
					kind: 'none-established',
					sources: ['choi-2021-acip-ebola', 'halperin-2017-rvsv-zebov-phase3-safety']
				},
				waningDays: { value: null, sources: ['who-wer-2024-sage-ebola', 'huttner2023-rvsv-zebov-5-year'] }
			}
		]
	},
	marburg: {
		id: 'marburg',
		name: 'Marburg',
		proseName: 'Marburg',
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
		mortalityBasis: 'modern-care',
		mortality: { value: 0.5, sources: ['who-marburg-factsheet'] },
		waningDays: { value: null, sources: ['natesan-2016-filovirus-antibody-persistence'] },
		fullEfficacy: { value: 0, sources: ['who-marburg-factsheet'] },
		hospitalisedShare: { value: 1, sources: ['who-marburg-treatment-centre'] }
	},
	flu1918: {
		id: 'flu1918',
		name: '1918 flu ("Spanish flu")',
		proseName: 'the 1918 flu',
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
		// A 1918 rate, from before modern hospital care: full hospitals don't raise it (6.6).
		mortalityBasis: 'era',
		mortality: { value: 0.017, sources: ['britten-1932-phr-1918-canvass', 'morabia-2021-1918-canvass'] },
		waningDays: { value: null, sources: ['yu-2008-1918-survivor-antibodies'] },
		fullEfficacy: { value: 0, sources: ['cdc-1918-pandemic-page'] },
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
	},
	plague: {
		id: 'plague',
		name: 'Black Death (1347)',
		proseName: 'the Black Death',
		group: 'historic',
		blurb:
			'The plague that reached Europe in 1347 and came back for centuries. It spread between people living closely together, and before antibiotics it killed about half of the people it made ill.',
		r0: { value: PLAGUE_R0, sources: ['dean-2018-second-pandemic-ectoparasites'] },
		// The whole silent phase is latent: infected, no symptoms, and not yet contagious.
		silentDays: { value: PLAGUE_INCUBATION_DAYS, sources: ['who-plague-factsheet'] },
		latentDays: {
			value: PLAGUE_INCUBATION_DAYS,
			sources: ['who-plague-factsheet', 'dean-2018-second-pandemic-ectoparasites']
		},
		illDays: { value: PLAGUE_ILL_DAYS, sources: ['dean-2018-second-pandemic-ectoparasites'] },
		// 0 as for Ebola and Marburg: symptom-free plague infections happen but aren't thought to spread it.
		asymptomaticFraction: {
			value: 0,
			sources: [
				'kool-2005-pneumonic-transmission',
				'ratsitorahina-2000-madagascar-seroprevalence',
				'dean-2018-second-pandemic-ectoparasites'
			]
		},
		// Before antibiotics, from hospital records of 1720-1945 (6.6): an era rate.
		mortalityBasis: 'era',
		mortality: {
			value: PLAGUE_MORTALITY,
			sources: ['mongillo-2024-bubonic-plague-by-age', 'who-plague-factsheet']
		},
		waningDays: { value: null, sources: ['andrianaivoarimanana-2020-plague-antibody-persistence'] },
		// No plague vaccine has established human efficacy (no trial has measured it).
		fullEfficacy: {
			value: 0,
			sources: [
				'jefferson-1998-cochrane-plague-vaccines',
				'hartley-2023-plague-vaccines-review',
				'sagiyev-2019-ev-vaccine-kazakhstan',
				'anisimov-2025-live-plague-vaccine',
				'who-plague-factsheet'
			]
		},
		// Lower bound, as for 1918 flu: everyone who died needed care, and no source gives the share
		// of plague cases needing a bed.
		hospitalisedShare: { value: PLAGUE_MORTALITY, sources: ['mongillo-2024-bubonic-plague-by-age'] },
		mortalityByAge: {
			value: PLAGUE_MORTALITY_BANDS,
			per: 'symptomatic-case',
			reference: PLAGUE_AGE_SHARES,
			overall: PLAGUE_MORTALITY,
			sources: ['mongillo-2024-bubonic-plague-by-age']
		},
		hospitalisedByAge: {
			value: PLAGUE_MORTALITY_BANDS,
			per: 'symptomatic-case',
			reference: PLAGUE_AGE_SHARES,
			overall: PLAGUE_MORTALITY,
			sources: ['mongillo-2024-bubonic-plague-by-age']
		}
	}
} satisfies Record<string, DiseaseConfig>;
