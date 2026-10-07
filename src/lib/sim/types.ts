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
	/** Days for immunity to fade one step; null when research says it does not fade. */
	waningDays: Sourced<number | null>;
	/** How much a full course of vaccine cuts the chance of catching it (0 to 1). */
	fullEfficacy: Sourced;
	/** The same for a started but unfinished course. */
	partialEfficacy: Sourced;
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
	waningTicks: number;
	/** Share of fully / partly vaccinated people for whom the vaccine works (all or nothing). */
	fullEfficacy: number;
	partialEfficacy: number;
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

export interface Scenario {
	mapSeed: number;
	regions: Region[];
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
