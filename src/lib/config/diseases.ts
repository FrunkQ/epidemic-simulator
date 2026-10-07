import type { Banded, Bands, DiseaseConfig, Sourced, Vaccine } from '../sim/types';
import { covid19BandsPerInfection, covid19SevereBandsPerInfection } from './covidAgeIfr';
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

/*
 * Vaccines. Each disease's `fullEfficacy` and `partialEfficacy` are its default vaccine's
 * infection values (the same objects), until step 3 moves the engine onto `vaccines`.
 * Risk rates are per 100,000 doses; a null death rate means a source says no death has been
 * established as caused by the vaccine. Worked-out numbers are computed here from the figures
 * their sources state, so the arithmetic in each citation's `why` can be checked.
 */

const DAYS_PER_YEAR = 365.25;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;
const PER_100K = 100_000;

/** MMR's risks, the same vaccine whichever of the three diseases it is given against. */
const MMR_SERIOUS: Sourced = { value: 30, sources: ['cdc-pinkbook-measles'] };
const MMR_DEATHS: Sourced<null> = { value: null, sources: ['cdc-pinkbook-measles'] };

/** Myocarditis after mRNA vaccines: 1,626 cases in 354,100,845 doses (Oster 2022). */
const MRNA_MYOCARDITIS_CASES = 1626;
const MRNA_MYOCARDITIS_DOSES = 354_100_845;
/** Anaphylaxis after COVID-19 vaccines: about 5 per million doses (CDC). */
const MRNA_ANAPHYLAXIS_PER_MILLION = 5;
/** mRNA risks: myocarditis plus anaphylaxis, and no death established as caused by the vaccine. */
const MRNA_SERIOUS: Sourced = {
	value:
		(MRNA_MYOCARDITIS_CASES / MRNA_MYOCARDITIS_DOSES) * PER_100K +
		(MRNA_ANAPHYLAXIS_PER_MILLION / 1_000_000) * PER_100K,
	sources: ['oster-2022-mrna-myocarditis', 'cdc-covid-vaccine-safety-2025']
};
const MRNA_DEATHS: Sourced<null> = {
	value: null,
	sources: ['cdc-covid-vaccine-safety-2025', 'xu-2021-covid-vaccine-mortality']
};

/** Two doses against infection, the 2021 vaccines against the 2020 virus (Liu 2021). */
const COVID19_2021_INFECTION = 0.85;
/** Fall in protection against infection from month 1 to month 6 (Feikin 2022: 21.0 points). */
const FEIKIN_INFECTION_DROP = 0.21;
const FEIKIN_WINDOW_DAYS = (6 - 1) * DAYS_PER_MONTH;
/**
 * Half-life of the 2021 vaccines against infection: the middle of an exponential and a
 * straight-line fall from Liu's 0.85 by Feikin's 21 points over months 1 to 6.
 */
function covid2021WaningDays(): number {
	const after = COVID19_2021_INFECTION - FEIKIN_INFECTION_DROP;
	const exponential = (FEIKIN_WINDOW_DAYS * Math.LN2) / Math.log(COVID19_2021_INFECTION / after);
	const straightLine = (FEIKIN_WINDOW_DAYS * (COVID19_2021_INFECTION / 2)) / FEIKIN_INFECTION_DROP;
	return (exponential + straightLine) / 2;
}

/** The 2021 vaccines against the 2020 virus (Liu 2021: all types pooled, mostly mRNA). */
const COVID19_2021 = {
	product: 'covid',
	version: '2021',
	label: 'COVID-19 vaccine (2021)',
	default: true,
	full: {
		infection: { value: COVID19_2021_INFECTION, sources: ['liu-2021-realworld-ve-meta', 'kow-2021-bnt-ma'] },
		severe: { value: 0.93, sources: ['liu-2021-realworld-ve-meta'] }
	},
	partial: {
		infection: { value: 0.41, sources: ['liu-2021-realworld-ve-meta', 'kow-2021-bnt-ma'] },
		severe: { value: 0.66, sources: ['liu-2021-realworld-ve-meta'] }
	},
	seriousPer100kDoses: MRNA_SERIOUS,
	deathsPer100kDoses: MRNA_DEATHS,
	waningDays: { value: covid2021WaningDays(), sources: ['feikin-2022-covid-ve-duration'] }
} satisfies Vaccine;

/** The original vaccine against Omicron, a full course, against unvaccinated people (Mohammed 2023). */
const OMICRON_ORIGINAL_INFECTION = 0.204;
const OMICRON_ORIGINAL_SEVERE = 0.569;
/** Bivalent against original vaccines, relative effectiveness (Cheng 2024). */
const BIVALENT_RELATIVE_INFECTION = 0.309;
const BIVALENT_RELATIVE_SEVERE = 0.597;
/** Menegale 2023's half-life against Omicron infection is ln2/w plus a 14-day ramp-up. */
const MENEGALE_OMICRON_HALF_LIFE_DAYS = 143;
const MENEGALE_RAMP_UP_DAYS = 14;
/** Original vaccine against Omicron infection: the pure exponential part, ln2/w. */
const OMICRON_VACCINE_WANING: Sourced = {
	value: MENEGALE_OMICRON_HALF_LIFE_DAYS - MENEGALE_RAMP_UP_DAYS,
	sources: ['menegale-2023-waning-meta']
};

const OMICRON_ORIGINAL = {
	product: 'covid',
	version: 'original',
	label: 'Original vaccine',
	full: {
		infection: { value: OMICRON_ORIGINAL_INFECTION, sources: ['mohammed-2023-omicron-ve'] },
		severe: { value: OMICRON_ORIGINAL_SEVERE, sources: ['mohammed-2023-omicron-ve'] }
	},
	partial: { infection: { value: 0.136, sources: ['tan-2022-omicron-children-partial'] } },
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
			value: stackedProtection(BIVALENT_RELATIVE_INFECTION, OMICRON_ORIGINAL_INFECTION),
			sources: ['cheng-2024-bivalent-rve-meta', 'mohammed-2023-omicron-ve']
		},
		severe: {
			value: stackedProtection(BIVALENT_RELATIVE_SEVERE, OMICRON_ORIGINAL_SEVERE),
			sources: ['cheng-2024-bivalent-rve-meta', 'mohammed-2023-omicron-ve']
		}
	},
	seriousPer100kDoses: MRNA_SERIOUS,
	deathsPer100kDoses: MRNA_DEATHS,
	waningDays: OMICRON_VACCINE_WANING
} satisfies Vaccine;

/** Exported for tests: the constants behind the updated vaccine's worked-out protection. */
export const OMICRON_VACCINE_INPUTS = {
	originalInfection: OMICRON_ORIGINAL_INFECTION,
	originalSevere: OMICRON_ORIGINAL_SEVERE,
	bivalentRelativeInfection: BIVALENT_RELATIVE_INFECTION,
	bivalentRelativeSevere: BIVALENT_RELATIVE_SEVERE
} as const;

const FLU_INFECTION: Sourced = {
	value: 0.414,
	sources: ['guo2024-flu-ve-review', 'belongia2016-flu-ve-review']
};
/** Young 2018: case-weighted VE 53.82% at day 52.5 and 31.10% at day 135.5 after vaccination. */
const YOUNG_EARLY = { day: 52.5, ve: 53.82 };
const YOUNG_LATE = { day: 135.5, ve: 31.1 };
/** One flu dose a season: no unfinished course, so no partial entry. */
const FLU_INACTIVATED: Vaccine = {
	product: 'inactivated',
	label: 'Typical season',
	default: true,
	full: {
		infection: FLU_INFECTION,
		severe: { value: 0.42, sources: ['yegorov-2025-flu-severe-ma', 'rondy-2017-flu-hosp-ma'] }
	},
	seriousPer100kDoses: { value: 0.3, sources: ['cdc-flu-gbs-2024', 'mcneil-2016-anaphylaxis'] },
	deathsPer100kDoses: {
		value: null,
		sources: ['cdc-flu-gbs-2024', 'miller-2015-deaths-after-vaccination']
	},
	waningDays: {
		value: ((YOUNG_LATE.day - YOUNG_EARLY.day) * Math.LN2) / Math.log(YOUNG_EARLY.ve / YOUNG_LATE.ve),
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
		severe: { value: 0.4, sources: ['grassly2014-ipv-doses-review', 'cooper2024-ipv-nigeria'] }
	},
	seriousPer100kDoses: { value: 0.131, sources: ['cdc-pinkbook-polio', 'mcneil-2016-anaphylaxis'] },
	deathsPer100kDoses: { value: null, sources: ['cdc-pinkbook-polio'] },
	// CDC: IPV "probably provides lifelong immunity after a complete series".
	waningDays: { value: null, sources: ['cdc-pinkbook-polio'] }
};
/** Paralysis caused by OPV (VAPP): one case per 2 to 3 million doses (CDC), stored as 0.04 per 100,000. */
const OPV_VAPP_PER_100K = 0.04;
/** Deaths per paralytic polio case in children: the middle of CDC's 2% to 5%. */
const PARALYTIC_POLIO_CASE_FATALITY = (0.02 + 0.05) / 2;
/**
 * Famulare 2018: peak gut immunity falls to the level where about half of people shed after
 * challenge in 5 months plus a further 4 years. Read as a half-life against infection.
 */
const OPV_MONTHS_TO_TWO_DOSE_LEVEL = 5;
const OPV_YEARS_TO_TWO_DOSE_LEVEL = 4;
const POLIO_OPV: Vaccine = {
	product: 'OPV',
	label: 'Oral (OPV, drops)',
	full: {
		infection: { value: 0.87, sources: ['hird2012-ipv-mucosal-review'] },
		severe: { value: 0.95, sources: ['cdc-pinkbook-polio'] }
	},
	partial: { severe: { value: 0.5, sources: ['cdc-pinkbook-polio'] } },
	seriousPer100kDoses: { value: OPV_VAPP_PER_100K, sources: ['cdc-pinkbook-polio'] },
	// Worked out: vaccine-caused paralysis x the death rate for paralytic polio.
	deathsPer100kDoses: {
		value: OPV_VAPP_PER_100K * PARALYTIC_POLIO_CASE_FATALITY,
		sources: ['cdc-pinkbook-polio', 'miller-2015-deaths-after-vaccination']
	},
	// Gut immunity against infection; protection against paralysis lasts (full.severe stays).
	waningDays: {
		value: (OPV_MONTHS_TO_TWO_DOSE_LEVEL / 12 + OPV_YEARS_TO_TWO_DOSE_LEVEL) * DAYS_PER_YEAR,
		sources: ['famulare2018-opv-waning']
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
/** Lewnard & Grad 2018: half of vaccinated people lose protection within 19.0 years. */
const MUMPS_VACCINE_HALF_LIFE_YEARS = 19.0;
const RUBELLA_FULL: Sourced = { value: 0.97, sources: ['cdc-pinkbook-rubella'] };
const RUBELLA_PARTIAL: Sourced = { value: 0.95, sources: ['cdc-pinkbook-rubella'] };
const CHICKENPOX_FULL: Sourced = { value: 0.92, sources: ['cdc-pinkbook-varicella'] };
const CHICKENPOX_PARTIAL: Sourced = { value: 0.82, sources: ['cdc-pinkbook-varicella'] };
/** Vaccine-strain chickenpox deaths: 6 in 132.8 million doses (Moro 2022). */
const VARICELLA_VACCINE_STRAIN_DEATHS = 6;
const VARICELLA_DOSES = 132_800_000;
/** Bolormaa 2025: two doses, 93.5% effective in year 1 and 49.6% by year 9 (8 years apart). */
const VARICELLA_TWO_DOSE_YEAR1 = 93.5;
const VARICELLA_TWO_DOSE_YEAR9 = 49.6;
const VARICELLA_YEAR9_GAP = (9 - 1) * DAYS_PER_YEAR;
const PERTUSSIS_FULL: Sourced = { value: 0.85, sources: ['cdc-pinkbook-pertussis'] };
const PERTUSSIS_PARTIAL: Sourced = { value: 0.5, sources: ['cdc-pinkbook-pertussis'] };
/** Wendelboe 2005: immunity after infection wanes after 4 to 20 years; the middle is used. */
const PERTUSSIS_INFECTION_HALF_LIFE_YEARS = (4 + 20) / 2;
/** Chit 2018: full acellular series VE by year, used to find when it halves (log-linear). */
const CHIT_START = 85;
const CHIT_YEAR3 = 49;
const CHIT_YEAR5 = 37;
function pertussisVaccineWaningDays(): number {
	const half = CHIT_START / 2;
	const years = 3 + (2 * Math.log(CHIT_YEAR3 / half)) / Math.log(CHIT_YEAR3 / CHIT_YEAR5);
	return years * DAYS_PER_YEAR;
}
/** Ranjeva 2019: infection-acquired protection against H3N2 in adults halves in 4.1 years. */
const FLU_INFECTION_HALF_LIFE_YEARS = 4.1;
const SMALLPOX_FULL: Sourced = { value: 0.95, sources: ['cdc-smallpox-vaccine'] };
/** CDC: vaccination protects "for about 3 to 5 years"; the middle, 4 years, is read as a half-life. */
const SMALLPOX_VACCINE_HALF_LIFE_YEARS = (3 + 5) / 2;
const EBOLA_FULL: Sourced = { value: 0.95, sources: ['cdc-ervebo-vaccine'] };

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
			value: FLU_INFECTION_HALF_LIFE_YEARS * DAYS_PER_YEAR,
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
		fullEfficacy: OMICRON_UPDATED.full.infection,
		// The updated vaccine has no partial-course figure, so this stays the original vaccine's
		// one-dose figure (Tan 2022) until step 3 moves the engine onto `vaccines`.
		partialCourse: 'covid-original',
		partialEfficacy: OMICRON_ORIGINAL.partial.infection,
		hospitalisedShare: {
			value: OMICRON_HOSPITAL_PER_INFECTION / (1 - OMICRON_ASYMPTOMATIC.value),
			sources: ['ward-2024-covid-ihr-ifr', 'perez-guzman-2023-omicron']
		},
		vaccines: [OMICRON_ORIGINAL, OMICRON_UPDATED]
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
				full: { infection: CHICKENPOX_FULL },
				partial: {
					infection: CHICKENPOX_PARTIAL,
					severe: { value: 0.98, sources: ['marin-2016-varicella-ma'] }
				},
				seriousPer100kDoses: { value: 1.3, sources: ['moro-2022-varicella-vaers'] },
				// Worked out: vaccine-strain deaths per dose, mostly in people the vaccine wasn't recommended for.
				deathsPer100kDoses: {
					value: (VARICELLA_VACCINE_STRAIN_DEATHS / VARICELLA_DOSES) * PER_100K,
					sources: ['moro-2022-varicella-vaers']
				},
				waningDays: {
					value:
						(VARICELLA_YEAR9_GAP * Math.LN2) / Math.log(VARICELLA_TWO_DOSE_YEAR1 / VARICELLA_TWO_DOSE_YEAR9),
					sources: ['bolormaa2025-varicella-duration', 'pawaskar2022-varicella-nma']
				}
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
		waningDays: { value: null, sources: ['who-2007-mumps-position-paper'] },
		fullEfficacy: MUMPS_FULL,
		partialEfficacy: MUMPS_PARTIAL,
		hospitalisedShare: { value: 0.01, sources: ['cdc-pinkbook-mumps'] },
		vaccines: [
			mmr(MUMPS_FULL, MUMPS_PARTIAL, {
				value: MUMPS_VACCINE_HALF_LIFE_YEARS * DAYS_PER_YEAR,
				sources: ['lewnard-grad-2018-mumps-waning']
			})
		]
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
		vaccines: [mmr(RUBELLA_FULL, RUBELLA_PARTIAL, { value: null, sources: ['cdc-pinkbook-rubella'] })]
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
		// Worked out: the middle of Wendelboe 2005's 4-20 years after infection, read as a half-life.
		waningDays: {
			value: PERTUSSIS_INFECTION_HALF_LIFE_YEARS * DAYS_PER_YEAR,
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
				full: { infection: PERTUSSIS_FULL },
				partial: { infection: PERTUSSIS_PARTIAL },
				seriousPer100kDoses: { value: 10, sources: ['cdc-pinkbook-pertussis'] },
				deathsPer100kDoses: { value: null, sources: ['cdc-pinkbook-pertussis'] },
				waningDays: {
					value: pertussisVaccineWaningDays(),
					sources: ['chit2018-acellular-pertussis-ve-waning', 'mcgirr-fisman-2015-dtap-duration']
				}
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
				full: { infection: SMALLPOX_FULL },
				seriousPer100kDoses: { value: 7.4, sources: ['lane-1969-smallpox-complications'] },
				deathsPer100kDoses: { value: 0.1, sources: ['lane-1969-smallpox-complications'] },
				waningDays: {
					value: SMALLPOX_VACCINE_HALF_LIFE_YEARS * DAYS_PER_YEAR,
					sources: ['cdc-smallpox-vaccine']
				}
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
		hospitalisedShare: { value: 1, sources: ['who-ebola-treatment-centre'] },
		vaccines: [
			{
				product: 'rVSV-ZEBOV',
				label: 'Ervebo (rVSV-ZEBOV, one dose)',
				default: true,
				full: { infection: EBOLA_FULL },
				seriousPer100kDoses: { value: 19.5, sources: ['choi-2021-acip-ebola'] },
				deathsPer100kDoses: { value: null, sources: ['choi-2021-acip-ebola'] },
				waningDays: { value: null, sources: ['who-wer-2024-sage-ebola', 'huttner2023-rvsv-zebov-5-year'] }
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
