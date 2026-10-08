/** Dot health states. Stored in a Uint8Array, so plain numbers. */
export const State = {
	SUSCEPTIBLE: 0,
	SILENT: 1,
	SYMPTOMATIC: 2,
	RECOVERED: 3,
	DECEASED: 4
} as const;
export type StateValue = (typeof State)[keyof typeof State];

/** Vaccination level, kept separate from health state. */
export const Protection = {
	NONE: 0,
	PARTIAL: 1,
	FULL: 2
} as const;

/** A number that came from research, with the ids of its sources in citations.ts. */
export interface Sourced<T = number> {
	value: T;
	sources: string[];
	/**
	 * Set on a placeholder: why the value is not yet properly sourced. Placeholders are listed by
	 * tests/sim/provisional.test.ts, and a release build (RELEASE=1) fails while any remain.
	 */
	provisional?: string;
}

/** One value per age band: 0-14, 15-64, 65+ (the World Bank bands). */
export type Bands = [number, number, number];

/** What a banded rate is counted per. */
export type BandUnit = 'infection' | 'symptomatic-case' | 'person-year';

/**
 * A sourced rate by age band. `reference` is the source's own population or case mix (shares
 * summing to 1) and `overall` its published all-ages figure, so the bands can be checked.
 */
export interface Banded extends Sourced<Bands> {
	per: BandUnit;
	reference: Bands;
	overall: number;
	/** Required on a death band above its hospital band: why some die without admission (sourced). */
	outsideHospitalReason?: { text: string; sources: string[] };
}

/**
 * Disease ids and picker groups come from config, so adding a disease never touches the engine.
 * (Type-only imports: no runtime dependency on config.)
 */
export type DiseaseId = keyof typeof import('../config/diseases').DISEASES;
export type DiseaseGroup = import('../config/diseases').DiseaseGroup;

/**
 * Deaths caused by a vaccine (6.13). Every kind carries sources, so "no deaths" can't be claimed
 * without one, and code that shows it must handle all three kinds.
 * - rate: deaths per 100,000 doses; `lowerBound` when the source counts only proven cases.
 * - none-established: a source says no death has been shown to be caused by the vaccine.
 * - established-no-rate: deaths are confirmed in `group` (people it isn't recommended for), but no
 *   rate has been published; `text` says what the source found.
 */
export type VaccineDeathRate =
	| { kind: 'rate'; value: number; sources: string[]; lowerBound?: true }
	| { kind: 'none-established'; sources: string[] }
	| { kind: 'established-no-rate'; group: string; text: string; sources: string[] };

/**
 * Protection from one course of a vaccine, as shares from 0 to 1. `severe` is the published
 * protection against severe disease in everyone vaccinated (not only in breakthrough cases); it is
 * left out when no pooled figure exists.
 */
export interface VaccineProtection {
	/** Share of infections prevented. */
	infection: Sourced;
	severe?: Sourced;
}

/**
 * One vaccine a population can be given against a disease, keyed by product and version (6.13).
 * Risk rates are per 100,000 doses; deaths use `VaccineDeathRate`, so a missing rate is never 0.
 */
export interface Vaccine {
	product: string;
	/** Set when a product has more than one version; the picker groups versions under the product. */
	version?: string;
	/** Plain name for the picker. */
	label: string;
	/** Exactly one entry per disease is the default. */
	default?: true;
	/** A completed course. */
	full: VaccineProtection;
	/**
	 * A started but unfinished course, and nothing else (not an old or waned vaccination, which
	 * waningDays covers). Left out when the vaccine has no multi-dose course; a field is left out
	 * when no figure exists for it.
	 */
	partial?: { infection?: Sourced; severe?: Sourced };
	/** Serious adverse events (usually needing hospital or emergency care) per 100,000 doses. */
	seriousPer100kDoses: Sourced<number | null>;
	/** Deaths caused by the vaccine: a rate per 100,000 doses, or a sourced reason there is none (6.13). */
	deathsPer100kDoses: VaccineDeathRate;
	/**
	 * Half-life of the vaccine's protection against infection: days until that protection has
	 * fallen to half its starting value (vaccinated dots wane with this, 6.3). null when no
	 * meaningful waning is established within the time the sim covers, and then a source must say so.
	 */
	waningDays: Sourced<number | null>;
}

/** Disease settings as written in config: durations in days. */
export interface DiseaseConfig {
	id: string;
	name: string;
	group: DiseaseGroup;
	/** One plain-language line for the disease picker. */
	blurb: string;
	r0: Sourced;
	/** Days contagious before symptoms (the orange phase). */
	silentDays: Sourced;
	/** Days contagious with symptoms (the red phase). */
	illDays: Sourced;
	/** Share of infections that never show symptoms. */
	asymptomaticFraction: Sourced;
	/** Chance that a symptomatic case dies. */
	mortality: Sourced;
	/**
	 * Half-life of infection-acquired immunity (recovered dots): days until half of recovered
	 * people have lost protection, as sources report it (7 Oct). Vaccine protection has its own
	 * `Vaccine.waningDays`. The engine draws each dot's time from an exponential with mean
	 * waningDays / ln 2. null when research says it does not fade.
	 */
	waningDays: Sourced<number | null>;
	/** How much a full course of vaccine cuts the chance of catching it (0 to 1). */
	fullEfficacy: Sourced;
	/**
	 * The same for a started but unfinished course. Left out when the default vaccine has no
	 * unfinished course (one dose, e.g. flu or Ebola): nobody is then partly vaccinated, and the UI
	 * hides that control.
	 */
	partialEfficacy?: Sourced;
	/** Share of symptomatic (red) cases who need a hospital bed. */
	hospitalisedShare: Sourced;
	/**
	 * Share vaccinated today, for diseases where that is far from normal coverage
	 * (smallpox: routine vaccination ended decades ago). New populations start here.
	 */
	coverageToday?: Sourced;
	/**
	 * Deaths per infection, when the source reports that rather than deaths per case. `mortality`
	 * is then worked out from it with `perSymptomatic`, so the two can't drift apart.
	 */
	infectionFatalityRate?: Sourced;
	/** Deaths by age band (the engine reads them from step 3; until then it uses `mortality`). */
	mortalityByAge?: Banded;
	/** Hospital admissions by age band. */
	hospitalisedByAge?: Banded;
	/** Vaccines on offer; `fullEfficacy` and `partialEfficacy` equal the default's infection values. */
	vaccines?: Vaccine[];
	/**
	 * Which vaccine entry (by vaccineKey) "partly vaccinated" means, when it isn't the default's
	 * course; e.g. Omicron-era people part-way through a primary course got the original vaccine.
	 */
	partialCourse?: string;
}

/** Calibration output for one disease (diseases.generated.ts). */
export interface DiseaseCalibration {
	/** Per-tick infection chance for one infectious dot near one susceptible dot. */
	beta: number;
	/** Distance in world units within which spread can happen. */
	transmissionRadius: number;
	/** R0 the calibration measured at this beta, for the record. */
	measuredR0: number;
	/** Standard error of measuredR0. */
	standardError: number;
	/** Runs (seeds) and index cases behind the measurement. */
	seeds: number;
	indexCases: number;
}

/** Disease settings converted to ticks, used by the engine. */
export interface DiseaseRuntime {
	id: string;
	r0: number;
	silentTicks: number;
	illTicks: number;
	asymptomaticFraction: number;
	mortality: number;
	/** Mean ticks until protection drops a level (waningDays / ln 2); 0 when it never fades. */
	waningMeanTicks: number;
	/** Share of fully / partly vaccinated people for whom the vaccine works (all or nothing). */
	fullEfficacy: number;
	/** 0 when the disease has no unfinished course. */
	partialEfficacy: number;
	/** False when the default vaccine has no unfinished course: partly vaccinated dots spawn unprotected. */
	hasPartialCourse: boolean;
	hospitalisedShare: number;
	beta: number;
	transmissionRadius: number;
}

export interface Region {
	id: number;
	name: string;
	kind: 'city' | 'rural';
	cx: number;
	cy: number;
	/** Real people living here. */
	population: number;
	/** Dots per square world unit; drives how crowded it is. */
	density: number;
	hasAirport: boolean;
	/** Share fully vaccinated, 0 to 1. */
	vaccinatedFull: number;
	/** Share partly vaccinated, 0 to 1. */
	vaccinatedPartial: number;
	/** Hospital beds per 1,000 people, so capacity scales with the population. */
	hospitalBedsPerThousand: number;
	hub?: { x: number; y: number };
}

export type RouteKind = 'road' | 'ferry' | 'air';

export interface Route {
	id: number;
	kind: RouteKind;
	from: number;
	to: number;
	/** Polyline in world units, from the edge of `from` to the edge of `to`: [x0, y0, x1, y1, ...]. */
	points: number[];
	/** Cumulative length at each point. */
	cumulative: number[];
	length: number;
	travelDays: number;
	/** Trips per day in each direction at the default travel setting. */
	tripsPerDay: number;
	open: boolean;
	/** Distance along the route where a closed border's barrier stands (ground routes). */
	barrierS?: number;
}

export interface Scenario {
	/** Seed of the procedural map; routes are generated from it and the regions. */
	mapSeed: number;
	regions: Region[];
	/** Multiplies how often people travel (the Travel slider); 1 is normal. */
	travelScale?: number;
}

export type Speed = 0 | 0.5 | 1 | 2 | 4;

export type Command =
	| { type: 'lockdown'; region: number; on: boolean }
	| { type: 'flights'; on: boolean }
	| { type: 'route'; route: number; open: boolean }
	| { type: 'massTest'; region: number }
	| { type: 'speed'; value: Speed }
	| { type: 'seed'; region: number; count: number };

/** Counts by display colour. */
export interface Counts {
	unprotected: number;
	full: number;
	partial: number;
	silent: number;
	symptomatic: number;
	recovered: number;
	deceased: number;
	/** Everyone ever infected (for attack rates). */
	everInfected: number;
}

export interface RegionTelemetry {
	id: number;
	name: string;
	dots: number;
	counts: Counts;
	overloaded: boolean;
	/** Spare hospital beds, in dots. Multiply by peoplePerDot to show people. */
	capacity: number;
	lockedDown: boolean;
	fatiguedShare: number;
	testCooldown: number;
}

export type SimEvent = { kind: 'firstCase' | 'overloaded'; region: number; day: number };

export interface Telemetry {
	tick: number;
	day: number;
	speed: Speed;
	peoplePerDot: number;
	/** Dots on a road, ferry or plane right now. */
	travelling: number;
	regions: RegionTelemetry[];
	totals: Counts;
	/** Today's history sample per region. The full history comes from sim.history(region). */
	latest: Record<HistoryChannel, number>[];
	/** Changes whenever a new daily sample is stored. */
	historyVersion: number;
	/** The most recent events (at most 100). */
	events: SimEvent[];
}

/** One region's daily history, oldest first. Channels follow HISTORY_CHANNELS. */
export interface RegionHistory {
	days: Int32Array;
	series: Record<HistoryChannel, Int32Array>;
}

export const HISTORY_CHANNELS = ['silent', 'symptomatic', 'recovered', 'deceased', 'susceptible'] as const;
export type HistoryChannel = (typeof HISTORY_CHANNELS)[number];

/** Size of the drawing surface in screen pixels. The camera decides what part of the world it shows. */
export interface Viewport {
	width: number;
	height: number;
}
