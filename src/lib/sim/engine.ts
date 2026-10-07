import { Agents } from './agents';
import { Camera } from './camera';
import {
	BASE_SPEED,
	DEFAULT_PEOPLE_PER_DOT,
	ESSENTIAL_SHARE,
	FATIGUE_MEAN_DAYS,
	FATIGUE_SD_DAYS,
	MAX_AGENTS,
	MAX_DENSITY,
	MIN_DENSITY,
	MIN_DOTS_PER_REGION,
	TICKS_PER_DAY,
	WORLD_HEIGHT,
	WORLD_WIDTH
} from './constants';
import { advanceIllness, infect, transmit, type DiseaseHooks } from './disease';
import { SpatialGrid } from './grid';
import { moveInRegions, regionRadius } from './movement';
import type { World } from './geography';
import { Renderer } from './render';
import { generateRoutes } from './routes';
import { Transit } from './transit';
import { Rng } from './rng';
import { sumCounts, TelemetryCounters } from './telemetry';
import {
	Protection,
	State,
	type Command,
	type DiseaseRuntime,
	type Region,
	type Route,
	type Scenario,
	type SimEvent,
	type Speed,
	type Telemetry,
	type Viewport
} from './types';

export interface SimulationOptions {
	seed: number;
	disease: DiseaseRuntime;
	/** The map. Without one there are no routes, so no travel. */
	world?: World;
	/** Dot pool size; tests may use a smaller one. */
	capacity?: number;
	/**
	 * Calibration only: newly infected dots are set aside instead of spreading,
	 * so each index case's own infections can be counted.
	 */
	secondaryOnly?: boolean;
}

/** How many dots each population gets, and how many people each dot stands for. */
export function allocateDots(regions: Region[], capacity: number): { dots: number[]; peoplePerDot: number } {
	const total = regions.reduce((s, r) => s + r.population, 0);
	let peoplePerDot = DEFAULT_PEOPLE_PER_DOT;
	const count = (ppd: number) =>
		regions.map((r) => Math.max(MIN_DOTS_PER_REGION, Math.round(r.population / ppd)));
	let dots = count(peoplePerDot);
	while (dots.reduce((a, b) => a + b, 0) > capacity) {
		peoplePerDot = Math.ceil(Math.max(peoplePerDot * 1.1, total / capacity));
		dots = count(peoplePerDot);
		if (dots.every((d) => d === MIN_DOTS_PER_REGION)) break;
	}
	return { dots, peoplePerDot };
}

export class Simulation {
	readonly agents: Agents;
	readonly view = new Camera();
	tick = 0;
	speed: Speed = 1;

	private scenario!: Scenario;
	private disease!: DiseaseRuntime;
	private rng!: Rng;
	private grid!: SpatialGrid;
	private counters!: TelemetryCounters;
	private radii!: Float32Array;
	private regionDots: number[] = [];
	private peoplePerDot = DEFAULT_PEOPLE_PER_DOT;
	private mortalityMultiplier!: Float32Array;
	private readonly renderer: Renderer;
	private readonly queue: Command[] = [];
	private events: SimEvent[] = [];
	private firstCaseSeen!: Uint8Array;
	private readonly secondaryOnly: boolean;
	private seed: number;
	private readonly hooks: DiseaseHooks;
	private world: World | null = null;
	private routeList: Route[] = [];
	private transit!: Transit;

	constructor(scenario: Scenario, options: SimulationOptions) {
		const capacity = options.capacity ?? MAX_AGENTS;
		this.agents = new Agents(capacity);
		this.renderer = new Renderer(capacity);
		this.secondaryOnly = options.secondaryOnly ?? false;
		this.seed = options.seed;
		this.hooks = {
			onInfected: (target) => {
				const r = this.agents.region[target];
				if (r < 0) return;
				this.counters.ever[r]++;
				if (this.firstCaseSeen[r] === 0) {
					this.firstCaseSeen[r] = 1;
					this.events.push({ kind: 'firstCase', region: r, day: this.day });
				}
			},
			onDeath: () => {}
		};
		this.world = options.world ?? null;
		this.setup(scenario, options.disease, options.seed);
	}

	get day(): number {
		return Math.floor(this.tick / TICKS_PER_DAY);
	}

	get regions(): readonly Region[] {
		return this.scenario.regions;
	}

	get routes(): readonly Route[] {
		return this.routeList;
	}

	get map(): World | null {
		return this.world;
	}

	get planes(): Transit {
		return this.transit;
	}

	radiusOf(region: number): number {
		return this.radii[region];
	}

	/** Setup change: rebuild everything and restart at day 0. Pass a world to change the map. */
	setup(
		scenario: Scenario,
		disease: DiseaseRuntime = this.disease,
		seed: number = this.seed,
		world: World | null = this.world
	): void {
		this.world = world;
		this.scenario = scenario;
		this.disease = disease;
		this.seed = seed;
		this.rng = new Rng(seed);
		this.tick = 0;
		this.queue.length = 0;
		this.events = [];
		const regions = scenario.regions;
		this.grid = new SpatialGrid(WORLD_WIDTH, WORLD_HEIGHT, disease.transmissionRadius, this.agents.capacity);
		this.counters = new TelemetryCounters(regions.length);
		this.mortalityMultiplier = new Float32Array(regions.length).fill(1);
		this.firstCaseSeen = new Uint8Array(regions.length);
		this.radii = new Float32Array(regions.length);

		const { dots, peoplePerDot } = allocateDots(regions, this.agents.capacity);
		this.regionDots = dots;
		this.peoplePerDot = peoplePerDot;
		this.spawn();
		this.routeList = this.world ? generateRoutes(this.world, regions, this.radii) : [];
		this.transit = new Transit(this.agents.capacity, regions.length);
		this.transit.travelScale = scenario.travelScale ?? 1;
		this.counters.recount(this.agents);
		this.counters.sample(0);
	}

	private spawn(): void {
		const a = this.agents;
		const rng = this.rng;
		a.reset();
		let slot = 0;
		const fatigueMean = FATIGUE_MEAN_DAYS * TICKS_PER_DAY;
		const fatigueSd = FATIGUE_SD_DAYS * TICKS_PER_DAY;
		this.scenario.regions.forEach((reg, r) => {
			const density = Math.min(MAX_DENSITY, Math.max(MIN_DENSITY, reg.density));
			const count = this.regionDots[r];
			const rad = regionRadius(count, density);
			this.radii[r] = rad;
			for (let k = 0; k < count; k++, slot++) {
				const d = rad * Math.sqrt(rng.next());
				const t = rng.next() * Math.PI * 2;
				a.x[slot] = reg.cx + Math.cos(t) * d;
				a.y[slot] = reg.cy + Math.sin(t) * d;
				const speed = BASE_SPEED * rng.range(0.6, 1.4);
				const h = rng.next() * Math.PI * 2;
				a.speed[slot] = speed;
				a.vx[slot] = Math.cos(h) * speed;
				a.vy[slot] = Math.sin(h) * speed;
				a.state[slot] = State.SUSCEPTIBLE;
				const v = rng.next();
				a.protection[slot] =
					v < reg.vaccinatedFull
						? Protection.FULL
						: v < reg.vaccinatedFull + reg.vaccinatedPartial
							? Protection.PARTIAL
							: Protection.NONE;
				const p = a.protection[slot];
				const efficacy =
					p === Protection.FULL
						? this.disease.fullEfficacy
						: p === Protection.PARTIAL
							? this.disease.partialEfficacy
							: 0;
				a.vaccineWorks[slot] = rng.next() < efficacy ? 1 : 0;
				a.essential[slot] = rng.next() < ESSENTIAL_SHARE ? 1 : 0;
				a.fatigueTicks[slot] = Math.max(TICKS_PER_DAY, Math.round(fatigueMean + rng.normal() * fatigueSd));
				a.region[slot] = r;
			}
		});
		a.activeCount = slot;
	}

	/** Queue a command; it takes effect at the start of the next tick. */
	send(command: Command): void {
		if (command.type === 'speed') {
			this.speed = command.value;
			return;
		}
		this.queue.push(command);
	}

	/** Advance the simulation by whole ticks. */
	step(ticks: number): void {
		for (let t = 0; t < ticks; t++) this.stepOnce();
	}

	private stepOnce(): void {
		const a = this.agents;
		this.tick++;
		// 1. Commands.
		if (this.queue.length > 0) this.applyCommands();
		// 2. Departures.
		this.transit.depart(a, this.routeList, this.scenario.regions, this.tick, this.rng);
		// 3. Movement, in a region and in transit.
		moveInRegions(a, this.scenario.regions, this.radii, this.tick, this.rng);
		this.transit.move(a, this.routeList, this.scenario.regions, this.radii, this.rng);
		// 4. Spatial grid.
		this.grid.rebuild(a);
		// 5. Transmission.
		transmit(a, this.grid, this.disease, this.tick, this.rng, this.hooks, this.secondaryOnly);
		// 6. Disease clocks.
		advanceIllness(a, this.disease, this.rng, this.mortalityMultiplier, this.hooks);
		// 7. Waning immunity: arrives with step 3 of the build.
		// 8. Telemetry counters.
		this.counters.recount(a);
		if (this.tick % TICKS_PER_DAY === 0) this.counters.sample(this.day);
	}

	private applyCommands(): void {
		for (const c of this.queue) {
			if (c.type === 'seed') this.seedCases(c.region, c.count);
			// lockdown, flights, route and massTest arrive with step 3 of the build.
		}
		this.queue.length = 0;
	}

	/** Infect `count` random unprotected dots in a region (index cases). */
	private seedCases(region: number, count: number): number[] {
		const a = this.agents;
		const pool: number[] = [];
		for (let i = 0; i < a.activeCount; i++) {
			if (a.region[i] === region && a.state[i] === State.SUSCEPTIBLE && a.vaccineWorks[i] === 0) {
				pool.push(i);
			}
		}
		pool.sort((p, q) => a.protection[p] - a.protection[q]);
		const unprotected = pool.filter((i) => a.protection[i] === Protection.NONE);
		const from = unprotected.length >= count ? unprotected : pool;
		const chosen: number[] = [];
		for (let k = 0; k < count && from.length > 0; k++) {
			const pick = this.rng.int(from.length);
			const i = from[pick];
			from[pick] = from[from.length - 1];
			from.pop();
			infect(a, i, -1, this.tick, this.disease, this.rng);
			// Index cases may spread from the very next tick.
			a.infectedTick[i] = this.tick - 1;
			this.hooks.onInfected(i, -1);
			chosen.push(i);
		}
		return chosen;
	}

	/** Seed index cases now (not queued) and return their slots. For calibration and tests. */
	seedNow(region: number, count: number): number[] {
		return this.seedCases(region, count);
	}

	render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
		this.renderer.draw(ctx, viewport, this.view, {
			agents: this.agents,
			regions: this.scenario.regions,
			radii: this.radii,
			routes: this.routeList,
			transit: this.transit,
			world: this.world,
			tick: this.tick
		});
	}

	snapshot(): Telemetry {
		const c = this.counters;
		const regions = this.scenario.regions.map((reg, r) => ({
			id: reg.id,
			name: reg.name,
			dots: this.regionDots[r],
			counts: c.regionCounts(r),
			overloaded: false,
			capacity: reg.hospitalCapacity,
			lockedDown: false,
			fatiguedShare: 0,
			testCooldown: 0
		}));
		return {
			tick: this.tick,
			day: this.day,
			speed: this.speed,
			peoplePerDot: this.peoplePerDot,
			travelling: this.transit.travellers(this.agents),
			regions,
			totals: sumCounts(regions.map((r) => r.counts)),
			history: this.scenario.regions.map((_, r) => ({ region: r, ...c.regionHistory(r) })),
			events: this.events.slice()
		};
	}
}

export function createSimulation(scenario: Scenario, options: SimulationOptions): Simulation {
	return new Simulation(scenario, options);
}
