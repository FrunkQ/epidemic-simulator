/*
 * Worked-out numbers (6.10). Each value here is computed from the figures its source states,
 * held as named constants. diseases.ts stores the results and citations.ts writes its prose from
 * the same constants with template literals, so the arithmetic in a citation's `why` can never
 * drift from the number in use.
 */

export const DAYS_PER_YEAR = 365.25;
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;
const PER_100K = 100_000;
const perMillionToPer100k = (perMillion: number) => (perMillion / 1_000_000) * PER_100K;
const midpoint = (low: number, high: number) => (low + high) / 2;
const mean = (...xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
/** Half-life of an exponential fall from `from` to `to` over `days`. */
const exponentialHalfLife = (days: number, from: number, to: number) =>
	(days * Math.LN2) / Math.log(from / to);

/** A number for prose: rounded to `digits` decimal places, with thousands separators. */
export function fmt(n: number, digits = 0): string {
	return n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// --- Age mix (World Bank, 2025) ---

/** World Bank SP.POP.0014.TO.ZS and SP.POP.65UP.TO.ZS, 2025, in percent (via FRED). */
export const WORLD_BANK_AGES_2025 = {
	EU: { under15: 14.20743, over64: 22.44279 },
	UK: { under15: 16.96477, over64: 19.70269 },
	Nigeria: { under15: 40.51972, over64: 3.06954 },
	Japan: { under15: 11.2384, over64: 29.9941 }
} as const;

/** Shares aged 0-14, 15-64 and 65+; the middle band is the rest. */
export function ageMixOf(place: keyof typeof WORLD_BANK_AGES_2025): [number, number, number] {
	const { under15, over64 } = WORLD_BANK_AGES_2025[place];
	return [under15 / 100, (100 - under15 - over64) / 100, over64 / 100];
}

// --- Hospitals (6.6, 4.2) ---

/** Eurostat hlth_rs_bds1: EU-27 curative care beds (HBEDT_CUR, somatic), per 100,000, 2023. */
export const EU_CURATIVE_BEDS_PER_100K = 330.93;
export const EU_CURATIVE_BEDS_PER_1000 = EU_CURATIVE_BEDS_PER_100K / 100;

/**
 * Eurostat hlth_co_bedoc 2023 (curative care bed occupancy, %) and tps00001 (people on 1 January
 * 2023) for the 22 EU countries with a 2023 value. Eurostat publishes no EU figure, so the default
 * is the population-weighted mean of these.
 */
export const EU_CURATIVE_OCCUPANCY_2023 = {
	AT: [69.18, 9104772],
	BE: [62.53, 11742796],
	BG: [57.2, 6447710],
	CY: [60.4, 949084],
	CZ: [62.47, 10827529],
	DE: [72.0, 83118501],
	EE: [70.8, 1365884],
	EL: [51.74, 10401868],
	ES: [72.54, 48085361],
	FR: [74.27, 68436003],
	HR: [64.32, 3850894],
	HU: [57.59, 9599744],
	IE: [86.96, 5271395],
	IT: [75.5, 58997201],
	LT: [62.85, 2857279],
	LU: [78.28, 660809],
	LV: [69.2, 1895239],
	MT: [70.63, 542051],
	PL: [68.8, 36753736],
	PT: [83.89, 10929704],
	SI: [62.31, 2116972],
	SK: [61.2, 5428792]
} as const satisfies Record<string, readonly [number, number]>;
/** EU-27 people on 1 January 2023 (tps00001), to say what share the 22 countries cover. */
export const EU27_POPULATION_2023 = 447805685;
/** EU countries with no 2023 occupancy value. */
export const EU_OCCUPANCY_MISSING = ['DK', 'FI', 'NL', 'RO', 'SE'] as const;
const occupancyRows = Object.values(EU_CURATIVE_OCCUPANCY_2023);
export const EU_OCCUPANCY_COVERED_PEOPLE = occupancyRows.reduce((a, [, n]) => a + n, 0);
/** Population-weighted mean curative occupancy, as a share (0.711). */
export const EU_CURATIVE_OCCUPANCY =
	occupancyRows.reduce((a, [pct, n]) => a + pct * n, 0) / EU_OCCUPANCY_COVERED_PEOPLE / 100;
export const EU_CURATIVE_OCCUPANCY_UNWEIGHTED = mean(...occupancyRows.map(([pct]) => pct)) / 100;

/**
 * The strain curve (6.6): no extra deaths up to Wilde 2021's 85% occupancy, odds of death rising to
 * Kadri 2021's and Bravata 2021's doubling, reached at 110% pressure. The slope is worked out from
 * those three points; no study gives one.
 */
export const STRAIN = {
	threshold: 0.85,
	cap: 2.0,
	capAt: 1.1,
	/** Wilde 2021: odds of death above 85% occupancy against 45-85%. */
	wildeOddsRatio: 1.23,
	/** Kadri 2021: >99th surge percentile; Bravata 2021: ICU load at 100% or more. */
	kadriOddsRatio: 2.0,
	bravataHazardRatio: 2.35,
	get slope() {
		return (this.cap - 1) / (this.capAt - this.threshold);
	},
	/** The curve's average multiplier over 85-100% pressure, to compare with Wilde's 1.23. */
	get meanOver85To100() {
		const top = Math.min(1, this.capAt);
		return 1 + (this.slope * (top - this.threshold)) / 2;
	}
};

/** NHS England KH03 Q2 2023/24: general and acute beds open overnight, and their occupancy. */
export const KH03_Q2_2023 = { beds: 102922, occupancyPct: 89.7 };
/** ONS: England's population, mid-2023. */
export const ENGLAND_POPULATION_MID_2023 = 57690300;
export const ENGLAND_ACUTE_BEDS_PER_1000 = (KH03_Q2_2023.beds / ENGLAND_POPULATION_MID_2023) * 1000;

// --- Protection after infection (6.2) ---

/**
 * Stein 2023 (COVID-19 Forecasting Team), appendix Table S2, 40 weeks after infection: protection
 * against reinfection and against severe disease, from the same table and time point.
 */
export const STEIN_40_WEEKS = {
	weeks: 40,
	preOmicron: { reinfection: 0.786, severe: 0.902 },
	ba1: { reinfection: 0.361, severe: 0.889 }
};

// --- COVID-19 vaccines ---

/** Liu 2021: two doses, 85% against infection. Feikin 2022: 21.0 points lower from month 1 to month 6. */
export const FEIKIN = {
	start: 0.85,
	drop: 0.21,
	windowDays: (6 - 1) * DAYS_PER_MONTH,
	get end() {
		return this.start - this.drop;
	},
	get exponential() {
		return exponentialHalfLife(this.windowDays, this.start, this.end);
	},
	get straightLine() {
		return (this.windowDays * (this.start / 2)) / this.drop;
	},
	/** The middle of the exponential and straight-line readings. */
	get halfLife() {
		return mean(this.exponential, this.straightLine);
	}
};

/** Menegale 2023: half-life against Omicron infection 143 days, defined as ln2/w plus a 14-day ramp-up. */
export const MENEGALE = {
	reported: 143,
	rampUp: 14,
	get halfLife() {
		return this.reported - this.rampUp;
	}
};

/** Mohammed 2023 (original vaccine against Omicron) and Cheng 2024 (bivalent relative to original). */
export const OMICRON_VACCINE = {
	originalInfection: 0.204,
	originalSevere: 0.569,
	bivalentRelativeInfection: 0.309,
	bivalentRelativeSevere: 0.597
};

/** Ling 2022: myocarditis or pericarditis, 22.6 per million mRNA doses. Greenhawt 2021: anaphylaxis 7.91. */
export const MRNA_SERIOUS = {
	myopericarditisPerMillion: 22.6,
	anaphylaxisPerMillion: 7.91,
	get per100k() {
		return perMillionToPer100k(this.myopericarditisPerMillion + this.anaphylaxisPerMillion);
	}
};

/** Oster 2022: 1,626 myocarditis cases in 354,100,845 mRNA doses (myocarditis only; context). */
export const OSTER = {
	cases: 1626,
	doses: 354_100_845,
	get per100k() {
		return (this.cases / this.doses) * PER_100K;
	}
};

/** Cho 2023: 8 autopsy-proven deaths; mRNA doses by vaccine and dose number (Methods). */
export const CHO = {
	provenDeaths: 8,
	allDeaths: 21,
	dosesBnt: [24_828_152, 23_369_725, 11_458_290],
	dosesModerna: [6_781_796, 6_621_577, 6_930_450],
	get mrnaDoses() {
		return [...this.dosesBnt, ...this.dosesModerna].reduce((a, d) => a + d, 0);
	},
	get per100k() {
		return (this.provenDeaths / this.mrnaDoses) * PER_100K;
	},
	get allDeathsPer100k() {
		return (this.allDeaths / this.mrnaDoses) * PER_100K;
	}
};

/** Chemaitelly 2022: protection after infection "reaches 50% in the 22nd month". */
export const COVID_INFECTION_HALF_LIFE_MONTHS = 22;

/** Bobrovitz 2023: protection after infection against Omicron, 65.2% at 3 months and 24.7% at 12. */
export const BOBROVITZ = {
	early: { month: 3, protection: 65.2 },
	late: { month: 12, protection: 24.7 },
	/** Straight line to 50%. */
	get halfMonths() {
		const slope = (this.early.protection - this.late.protection) / (this.late.month - this.early.month);
		return this.early.month + (this.early.protection - 50) / slope;
	},
	get halfLife() {
		return this.halfMonths * DAYS_PER_MONTH;
	}
};

// --- Flu ---

/** Young 2018: case-weighted VE 53.82% at day 52.5 and 31.10% at day 135.5 after vaccination. */
export const YOUNG = {
	early: { day: 52.5, ve: 53.82 },
	late: { day: 135.5, ve: 31.1 },
	get halfLife() {
		return exponentialHalfLife(this.late.day - this.early.day, this.early.ve, this.late.ve);
	}
};

/** Ranjeva 2019: infection-acquired protection against H3N2 in adults halves in 4.1 years. */
export const RANJEVA_HALF_LIFE_YEARS = 4.1;

/** CDC: GBS 1 to 2 per million flu doses (the middle is used). McNeil 2016: anaphylaxis 1.35 per million. */
export const FLU_SERIOUS = {
	gbsPerMillion: [1, 2] as const,
	anaphylaxisPerMillion: 1.35,
	get per100k() {
		return perMillionToPer100k(midpoint(...this.gbsPerMillion) + this.anaphylaxisPerMillion);
	}
};

// --- Polio ---

/** Hird 2012: OPV against shedding, summary odds ratio 0.13. */
export const OPV_SHEDDING_OR = 0.13;
/** Grassly 2014: one IPV dose seroconverts 33%, 41% and 47% of infants (types 1, 2, 3). */
export const IPV_ONE_DOSE_SEROCONVERSION = [0.33, 0.41, 0.47] as const;
export const IPV_ONE_DOSE = mean(...IPV_ONE_DOSE_SEROCONVERSION);
/** McNeil 2016: anaphylaxis after any vaccine, 1.31 per million doses (no IPV-alone row). */
export const ALL_VACCINE_ANAPHYLAXIS_PER_MILLION = 1.31;
/** CDC: one VAPP case per 2 to 3 million OPV doses; paralytic polio kills 2% to 5% of children. */
export const OPV_RISK = {
	millionDosesPerVapp: [2, 3] as const,
	paralyticCaseFatality: [0.02, 0.05] as const,
	get vappPer100k() {
		return mean(
			perMillionToPer100k(1 / this.millionDosesPerVapp[0]),
			perMillionToPer100k(1 / this.millionDosesPerVapp[1])
		);
	},
	get caseFatality() {
		return midpoint(...this.paralyticCaseFatality);
	},
	get deathsPer100k() {
		return this.vappPer100k * this.caseFatality;
	}
};
/** Famulare 2018: peak gut immunity falls to the half-shedding level in 5 months plus 4 years. */
export const FAMULARE = {
	months: 5,
	years: 4,
	get halfLife() {
		return (this.months / 12 + this.years) * DAYS_PER_YEAR;
	}
};

// --- MMR, chickenpox, whooping cough, smallpox, Ebola ---

/** CDC: febrile seizures after MMR in 1 in 3,000 to 4,000 doses (the middle is used). */
export const MMR_SEIZURE_DOSES = [3000, 4000] as const;
export const MMR_SERIOUS_PER_100K = midpoint(
	PER_100K / MMR_SEIZURE_DOSES[1],
	PER_100K / MMR_SEIZURE_DOSES[0]
);
/** Lewnard & Grad 2018: half of vaccinated people lose protection against mumps within 19.0 years. */
export const LEWNARD_HALF_LIFE_YEARS = 19.0;
/** Moro 2022: 6 vaccine-strain chickenpox deaths in 132.8 million doses. */
export const MORO = {
	deaths: 6,
	doses: 132_800_000,
	get per100k() {
		return (this.deaths / this.doses) * PER_100K;
	}
};
/** Bolormaa 2025: two doses, 93.5% in year 1 and 49.6% by year 9. */
export const BOLORMAA = {
	early: { year: 1, ve: 93.5 },
	late: { year: 9, ve: 49.6 },
	get halfLife() {
		return exponentialHalfLife(
			(this.late.year - this.early.year) * DAYS_PER_YEAR,
			this.early.ve,
			this.late.ve
		);
	}
};
/** Chit 2018: the childhood acellular series is 91% effective at first and decays by 0.096 a year. */
export const CHIT = {
	start: 0.91,
	decayPerYear: 0.096,
	get halfLifeYears() {
		return Math.LN2 / this.decayPerYear;
	},
	get halfLife() {
		return this.halfLifeYears * DAYS_PER_YEAR;
	}
};
/** McGirr & Fisman 2015 (check only): 85% immune falling to 10% over 8.5 years. */
export const MCGIRR = {
	start: 0.85,
	end: 0.1,
	years: 8.5,
	get exponential() {
		return exponentialHalfLife(this.years * DAYS_PER_YEAR, this.start, this.end);
	},
	get straightLine() {
		return ((this.years * (this.start / 2)) / (this.start - this.end)) * DAYS_PER_YEAR;
	}
};
/** Wendelboe 2005: immunity after whooping cough wanes after 4 to 20 years (the middle is used). */
export const WENDELBOE_YEARS = [4, 20] as const;
export const WENDELBOE_HALF_LIFE = midpoint(...WENDELBOE_YEARS) * DAYS_PER_YEAR;
/** CDC: serious DTaP reactions in fewer than 1 in 10,000 doses (the bound is used). */
export const DTAP_SERIOUS_DOSES = 10_000;
/** CDC: smallpox vaccination protects "for about 3 to 5 years" (the middle is used). */
export const SMALLPOX_VACCINE_YEARS = [3, 5] as const;
export const SMALLPOX_VACCINE_HALF_LIFE = midpoint(...SMALLPOX_VACCINE_YEARS) * DAYS_PER_YEAR;
/** Lane 1969: 74 complications and 1 death per million primary vaccinations. */
export const LANE = { complicationsPerMillion: 74, deathsPerMillion: 1 };
/** Choi 2021: 3 vaccine-related serious events among 15,399 people given the one-dose Ebola vaccine. */
export const CHOI = {
	events: 3,
	people: 15_399,
	get per100k() {
		return (this.events / this.people) * PER_100K;
	}
};

export const per100kFromPerMillion = perMillionToPer100k;

// --- Black Death (research/plague.md) ---

/**
 * Dean 2018 Table 3, human-ectoparasite (EP) rows: fitted R0 for the nine pre-industrial European
 * outbreaks, Givry 1348, Florence 1400, Barcelona 1490, London 1563, Eyam 1666, Gdansk 1709,
 * Stockholm 1710, Moscow 1771 and Malta 1813. Their mean is used, so no one town sets it.
 */
export const PLAGUE_EP_R0S = [1.82, 1.76, 1.91, 1.64, 1.48, 1.64, 1.75, 1.79, 1.57] as const;
export const PLAGUE_R0 = mean(...PLAGUE_EP_R0S);
/** Dean 2018 Methods: mildly infectious for 8 days, then highly infectious (moribund) for 2. */
export const PLAGUE_MILD_INFECTIOUS_DAYS = 8;
export const PLAGUE_HIGH_INFECTIOUS_DAYS = 2;
export const PLAGUE_ILL_DAYS = PLAGUE_MILD_INFECTIOUS_DAYS + PLAGUE_HIGH_INFECTIOUS_DAYS;
/** WHO: an incubation period of one to seven days (the middle is used). */
export const PLAGUE_INCUBATION_RANGE = [1, 7] as const;
export const PLAGUE_INCUBATION_DAYS = midpoint(...PLAGUE_INCUBATION_RANGE);

/**
 * Mongillo 2024 Table 2: bubonic plague cases and deaths by ten-year age class, 1720-1945, before
 * antibiotics. The 0-14 band takes the 0-9 and 10-19 classes and 65+ takes the 50+ class (the
 * source has no 65+ cut); both are stated on the About page.
 */
export const PLAGUE_AGE_CLASSES = [
	{ from: 0, cases: 73, deaths: 40 },
	{ from: 10, cases: 263, deaths: 119 },
	{ from: 20, cases: 286, deaths: 158 },
	{ from: 30, cases: 160, deaths: 81 },
	{ from: 40, cases: 115, deaths: 59 },
	{ from: 50, cases: 70, deaths: 43 }
] as const;
type AgeClass = (typeof PLAGUE_AGE_CLASSES)[number];
const tally = (ks: readonly AgeClass[]) => ({
	cases: ks.reduce((a, k) => a + k.cases, 0),
	deaths: ks.reduce((a, k) => a + k.deaths, 0)
});
const PLAGUE_BANDS = [
	tally(PLAGUE_AGE_CLASSES.filter((k) => k.from < 20)),
	tally(PLAGUE_AGE_CLASSES.filter((k) => k.from >= 20 && k.from < 50)),
	tally(PLAGUE_AGE_CLASSES.filter((k) => k.from >= 50))
];
/** All 967 cases and 500 deaths. */
export const PLAGUE_ALL = tally(PLAGUE_AGE_CLASSES);
/** Deaths per case before antibiotics, by band: 0.4732 / 0.5312 / 0.6143. */
export const PLAGUE_MORTALITY_BANDS = PLAGUE_BANDS.map((b) => b.deaths / b.cases) as [number, number, number];
/** The source's own case mix as shares, the reference population for the bands. */
export const PLAGUE_AGE_SHARES = PLAGUE_BANDS.map((b) => b.cases / PLAGUE_ALL.cases) as [
	number,
	number,
	number
];
/** All ages: 500 / 967, the published 51.7%. */
export const PLAGUE_MORTALITY = PLAGUE_ALL.deaths / PLAGUE_ALL.cases;
/** Mongillo 2024 Table 1: the European Second Pandemic subset, the closest to 1347 (About only). */
export const PLAGUE_EUROPE_SECOND_PANDEMIC_CFR = 0.572;
/** Kugeler 2015 Table 2, United States 1900-1941, all forms, before antibiotics (cross-check only). */
export const KUGELER_PRE_ANTIBIOTIC = { deaths: 336, cases: 511 };
/** Kugeler 2015: the first documented use of antibiotics against plague in the United States. */
export const PLAGUE_FIRST_ANTIBIOTICS_YEAR = 1942;
/** Godfred-Cato 2020: deaths among treated bubonic plague cases, for the "curable today" line. */
export const PLAGUE_BUBONIC_TREATED_CFR = 0.142;
