/** Simulation ticks per simulated day. Durations in config are days and are converted once. */
export const TICKS_PER_DAY = 30;
/** Ticks per real second at 1x speed (2 sim days per second). */
export const TICKS_PER_SECOND = 60;
/** Most ticks the loop will run in one animation frame; the rest are dropped. */
export const MAX_TICKS_PER_FRAME = 8;

/** Fixed size of the dot pool. */
export const MAX_AGENTS = 6000;
/** Smallest number of dots any population gets, however many people it has. */
export const MIN_DOTS_PER_REGION = 30;
/** People each dot stands for, before it is raised to fit MAX_AGENTS. */
export const DEFAULT_PEOPLE_PER_DOT = 100;

/** World size in world units. */
export const WORLD_WIDTH = 4800;
export const WORLD_HEIGHT = 2700;

/** Region density is dots per square world unit; clamped to this range. */
export const MIN_DENSITY = 0.002;
export const MAX_DENSITY = 0.03;
export const CITY_DENSITY = 0.012;
export const RURAL_DENSITY = 0.003;

/** Base wandering speed in world units per tick; each dot gets 0.6x to 1.4x of it. */
export const BASE_SPEED = 1.2;
/** A dot turns a little every this many ticks (staggered across dots). */
export const WANDER_EVERY = 8;
/** Largest turn per wander step, in radians. */
export const WANDER_TURN = 0.6;

/** Partly vaccinated dots are ill for this fraction of the usual time. */
export const PARTIAL_ILL_FACTOR = 0.5;

/** Days of history kept for charts (ring buffer). */
export const HISTORY_DAYS = 730;

/** Share of dots that keep moving during a lockdown. */
export const ESSENTIAL_SHARE = 0.1;
/** Map grid resolution: world units per heightmap cell. */
export const MAP_CELL = 12;
/** Share of the world that is land. */
export const LAND_SHARE = 0.38;
/** Widest stretch of water a ferry route may cross, in world units. */
export const MAX_FERRY_GAP = 450;
