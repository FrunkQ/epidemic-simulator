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
export type HealthPolicy = import('../config/healthPolicy').HealthPolicy;

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
	 * Protection from having had the disease (6.2): against reinfection and against severe illness,
	 * from the same source at the same time since infection. A recovered dot whose immunity has
	 * waned keeps the severe part for breakthrough reinfections. Left out where nothing is sourced.
	 */
	afterInfection?: { infection: Sourced; severe: Sourced };
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

/** One vaccine as the engine uses it: protection as plain shares, waning in ticks. */
export interface VaccineRuntime {
	/** vaccineKey of the entry, e.g. "covid-updated". */
	key: string;
	/** False for a disease with no vaccine: nobody spawns vaccinated, full or partial. */
	exists: boolean;
	/** Share of a full course for whom it works against infection (all or nothing). */
	fullInfection: number;
	/** Protection against severe illness for a fully vaccinated person it didn't stop (6.2). */
	fullSevere: number;
	/** False when there is no unfinished course: partly vaccinated dots spawn unprotected. */
	hasPartialCourse: boolean;
	partialInfection: number;
	/** False where an unfinished course has no figure against infection, so it is assumed to give none. */
	partialInfectionSourced: boolean;
	/** Severe protection for an unfinished course's breakthrough case; 0 when unsourced (6.2). */
	partialSevere: number;
	/** Mean ticks until a working vaccine stops working (waningDays / ln 2); 0 when it doesn't fade. */
	waningMeanTicks: number;
}

/** Disease settings converted to ticks, used by the engine. */
export interface DiseaseRuntime {
	id: string;
	r0: number;
	silentTicks: number;
	illTicks: number;
	asymptomaticFraction: number;
	/** All-ages deaths per symptomatic case: the fallback when age bands are switched off. */
	mortality: number;
	/** Deaths per symptomatic case in each age band (the all-ages figure where none is sourced). */
	mortalityByBand: Bands;
	/** All-ages share of symptomatic cases needing a bed. */
	hospitalisedShare: number;
	/** Share of symptomatic cases needing a bed, by age band. */
	hospitalByBand: Bands;
	/** Mean ticks until infection-acquired immunity fades (waningDays / ln 2); 0 when it never fades. */
	waningMeanTicks: number;
	/** Protection against severe illness in a reinfection, once immunity has waned (0 when unsourced). */
	afterInfectionSevere: number;
	/** The vaccines on offer, default first. A disease with no vaccine has one that never works. */
	vaccines: VaccineRuntime[];
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
	/**
	 * The vaccine given here (a vaccineKey, e.g. "covid-original"); the disease's default when unset
	 * or not offered for the disease. Changing it restarts the run, because vaccineWorks is re-rolled.
	 */
	vaccine?: string;
	/** Healthcare and behaviour settings (4.2); beds and travel change live via a 'policy' command. */
	policy: HealthPolicy;
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
	/**
	 * Base trips per day in each direction. The running rate is this x the lower of its two end
	 * populations' travel frequency, the same both ways (4.2).
	 */
	tripsPerDay: number;
	open: boolean;
	/** Distance along the route where a closed border's barrier stands (ground routes). */
	barrierS?: number;
}

export interface Scenario {
	/**
	 * Seed of the procedural map. The engine builds the map and routes from it and the regions, so
	 * a run is reproducible from the scenario and the seed. null: no map, so no routes (tests).
	 */
	mapSeed: number | null;
	regions: Region[];
	/** Switch subsystems off, one at a time, for guided mode (6.14). Everything is on when unset. */
	subsystems?: Partial<Subsystems>;
}

/**
 * The mechanics guided mode can switch on one at a time (6.14). The tick order honours each one;
 * a lesson only sets these, never engine internals.
 */
export interface Subsystems {
	/** People can die. Off: everyone recovers. */
	deaths: boolean;
	/** Hospital beds and pressure; strain raises deaths. Off: no beds, no strain. */
	hospital: boolean;
	/** Death and hospital chances by age band. Off: the all-ages figures for everyone. */
	ageBands: boolean;
	/** People spread it before they have symptoms. Off: only people with symptoms spread it. */
	silentSpread: boolean;
	/** People with symptoms stop moving and don't travel. Off: they carry on as normal. */
	illStopsMovement: boolean;
	/** Trips between populations. */
	travel: boolean;
	/** Vaccine protection and immunity after illness fade. */
	waning: boolean;
	/** Lockdown, testing, flights and borders respond to commands (step 3b). */
	interventions: boolean;
}

export type Speed = 0 | 0.5 | 1 | 2 | 4;

export type Command =
	| { type: 'lockdown'; region: number; on: boolean }
	| { type: 'flights'; on: boolean }
	| { type: 'route'; route: number; open: boolean }
	| { type: 'massTest'; region: number }
	| { type: 'speed'; value: Speed }
	| { type: 'seed'; region: number; count: number }
	/** Replace one population's health policy; applies live (beds, travel), without a restart. */
	| { type: 'policy'; region: number; policy: HealthPolicy };

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

export type PressureBand = 'coping' | 'under-pressure' | 'overwhelmed';

export interface RegionTelemetry {
	id: number;
	name: string;
	dots: number;
	counts: Counts;
	/**
	 * Deaths so far in people, by age band (0-14, 15-64, 65+): the tally of each ended illness's
	 * chance of death (6.6), not the dead dots. Fractional; show it rounded to whole people.
	 */
	deathsByAge: Bands;
	/** Deaths so far in people, all ages (the sum of deathsByAge). */
	deaths: number;
	/** Outbreak patients need more beds than are spare (pressure over 100%). */
	overloaded: boolean;
	/** Spare hospital beds, in dots. Multiply by peoplePerDot to show people. */
	capacity: number;
	/** All hospital beds, in dots. */
	beds: number;
	/** Expected outbreak patients in a bed now, in dots (fractional, 6.6); ill travellers count at their origin. */
	patients: number;
	/** (Beds normally occupied + outbreak patients) / all beds (6.6). 0 when hospitals are switched off. */
	pressure: number;
	pressureBand: PressureBand;
	/** The strain multiplier on the odds of death for patients in a bed (1 = no strain, 6.6). */
	strain: number;
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
	/** Dots on a road, ferry or plane, by colour. A death on a route counts in its origin region. */
	inTransit: Counts;
	/** Every dot: the regions plus inTransit. */
	totals: Counts;
	/** Deaths so far in people, every region (a death on a trip counts in its origin). */
	deaths: number;
	/** Today's history sample per region. The full history comes from sim.history(region). */
	latest: Record<HistoryChannel, number>[];
	/** Changes whenever a new daily sample is stored. */
	historyVersion: number;
	/** The most recent events (at most 100). */
	events: SimEvent[];
}

/**
 * One region's daily history, oldest first. Channels follow HISTORY_CHANNELS; `byAge` has one
 * series per age band for each of AGE_CHANNELS.
 */
export interface RegionHistory {
	days: Int32Array;
	series: Record<HistoryChannel, Float64Array>;
	byAge: Record<AgeChannel, [Float64Array, Float64Array, Float64Array]>;
}

/**
 * Daily channels per region, in dots. inHospital (here and per age band) is an expected value in
 * thousandths of a dot (HOSPITAL_SCALE), and pressure is in thousandths (1000 = 100%). `deceased`
 * is the dead dots on the map (a sample); `deaths` is the deaths tally in people (6.6), the
 * figure every death count shows, kept unrounded and rounded only for display (8).
 */
export const HISTORY_CHANNELS = [
	'silent',
	'symptomatic',
	'recovered',
	'deceased',
	'susceptible',
	'inHospital',
	'pressure',
	'deaths'
] as const;
export type HistoryChannel = (typeof HISTORY_CHANNELS)[number];

/**
 * Daily channels per age band, in dots (vaccinated: given any course, whether it worked or not),
 * except `deceased`, which is the deaths tally in people, unrounded (6.6, 8).
 */
// Units differ: `deceased` is in people, its sibling channels in dots; don't multiply it by peoplePerDot.
export const AGE_CHANNELS = [
	'susceptible',
	'infected',
	'inHospital',
	'recovered',
	'deceased',
	'vaccinated'
] as const;
export type AgeChannel = (typeof AGE_CHANNELS)[number];

/** Size of the drawing surface in screen pixels. The camera decides what part of the world it shows. */
export interface Viewport {
	width: number;
	height: number;
}
