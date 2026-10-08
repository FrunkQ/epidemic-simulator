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
