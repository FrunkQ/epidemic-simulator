import { Agents } from './agents';
import { Camera } from './camera';
import {
	BASE_SPEED,
	DEFAULT_PEOPLE_PER_DOT,
	ESSENTIAL_SHARE,
	MAX_AGENTS,
	MAX_DENSITY,
	MIN_DENSITY,
	MIN_DOTS_PER_REGION,
	TICKS_PER_DAY
} from './constants';
import { loadDisease } from '../config';
import { BEHAVIOUR } from '../config/behaviour';
import {
	bedChanceOf,
	deathChanceAtEnd,
	deathChanceOf,
	Exposure,
	hospitalRegion,
	transmit,
	vaccineFor,
	type IllnessRules
} from './disease';
import { People, type PeopleHooks } from './people';
import { setLook } from './look';
import { SpatialGrid } from './grid';
import { moveInRegions, regionRadius } from './movement';
import { generateWorld, type World } from './geography';
import { Renderer } from './render';
import { generateRoutes } from './routes';
import { Transit } from './transit';
import { Rng } from './rng';
import { sumCounts, TelemetryCounters } from './telemetry';
import {
	Protection,
	State,
	type Bands,
	type Command,
	type DiseaseId,
	type DiseaseRuntime,
	type HealthPolicy,
	type Region,
	type RegionHistory,
	type Route,
	type Scenario,
	type SimEvent,
	type PressureBand,
	type Speed,
	type Subsystems,
	type Telemetry,
	type Viewport
} from './types';

/** Every subsystem on: the full model (6.14). */
export const ALL_SUBSYSTEMS: Subsystems = {
	deaths: true,
	hospital: true,
	ageBands: true,
	silentSpread: true,
	illStopsMovement: true,
	travel: true,
	waning: true,
	interventions: true
};

/** The agreed strain curve (6.6): how much a bedded patient's chance of dying rises with pressure. */
export function strainMultiplier(pressure: number): number {
	const over = Math.max(0, pressure - BEHAVIOUR.strainThreshold.value);
	return Math.min(BEHAVIOUR.strainMaxMultiplier.value, 1 + BEHAVIOUR.strainSlope.value * over);
}

/** The gauge's plain band: Coping below the strain threshold, Overwhelmed above 100% (6.6). */
export function pressureBand(pressure: number): PressureBand {
	if (pressure > 1) return 'overwhelmed';
	return pressure >= BEHAVIOUR.strainThreshold.value ? 'under-pressure' : 'coping';
}

/** Events kept for the UI. */
const MAX_EVENTS = 100;

export interface SimulationOptions {
	seed: number;
	diseaseId: DiseaseId;
	/** Calibration and tests only: use these disease numbers instead of loading diseaseId. */
	disease?: DiseaseRuntime;
	/** Dot pool size; tests may use a smaller one. */
	capacity?: number;
	/**
	 * Calibration only: newly infected people are set aside instead of spreading,
	 * so each index case's own infections can be counted (People.secondaries).
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
	/** The people inside the dots, for the one disease circulating (6.12: one per disease from 3c). */
	people!: People;
	readonly view = new Camera();
	tick = 0;
	speed: Speed = 1;

	private scenario!: Scenario;
	private disease!: DiseaseRuntime;
	private diseaseId!: DiseaseId;
	private diseaseOverride: DiseaseRuntime | null = null;
	private rng!: Rng;
	private grid!: SpatialGrid;
	private counters!: TelemetryCounters;
	/** Whether people have changed since the last full recount. */
	private countsStale = true;
	private radii!: Float32Array;
	private regionDots: number[] = [];
	/** All hospital beds per region, in people. */
	private beds: number[] = [];
	/** Spare hospital beds per region, in people. */
	private bedCapacity: number[] = [];
	private peoplePerDot = DEFAULT_PEOPLE_PER_DOT;
	/** Hospital pressure per region (6.6), and the death multiplier it gives a bedded patient. */
	private pressure!: Float32Array;
	private strain!: Float32Array;
	private overloadSeen!: Uint8Array;
	private subsystems: Subsystems = ALL_SUBSYSTEMS;
	private rules!: IllnessRules;
	private readonly renderer: Renderer;
	private readonly queue: Command[] = [];
	private events: SimEvent[] = [];
	private firstCaseSeen!: Uint8Array;
	/** Whether this run has already reported an illness that had no home region. */
	private lostDeathReported = false;
	private readonly secondaryOnly: boolean;
	private seed: number;
	private readonly hooks: PeopleHooks;
	private exposure!: Exposure;
	/** People not protected by the vaccine at the start, per region (lesson 1's denominator). */
	private unprotectedAtStart: number[] = [];
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
			onInfected: (dot, people) => {
				const r = this.agents.region[dot];
				if (r < 0) return;
				this.counters.addInfections(r, this.agents.ageBand[dot], people);
				if (this.firstCaseSeen[r] === 0) {
					this.firstCaseSeen[r] = 1;
					this.pushEvent({ kind: 'firstCase', region: r, day: this.day });
				}
			},
			onIllnessEnd: (dot, _people, died) => {
				if (died === 0) return;
				const region = hospitalRegion(this.agents, this.routeList, dot);
				// Every dot has a home region, so this can't happen; skipping would lose deaths from the
				// counts, so fail loudly in development and tests, and say so once per run anywhere else.
				if (region < 0) {
					const message = `Deaths in dot ${dot} with no home region; left out of the counts`;
					if (import.meta.env?.DEV) throw new Error(message);
					if (!this.lostDeathReported) console.error(message);
					this.lostDeathReported = true;
					return;
				}
				this.counters.addDeaths(region, 0, this.agents.ageBand[dot], died);
			}
		};
		this.diseaseOverride = options.disease ?? null;
		this.setup(scenario, options.diseaseId, options.seed);
	}

	private pushEvent(e: SimEvent): void {
		this.events.push(e);
		if (this.events.length > MAX_EVENTS) this.events.shift();
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

	/** The map built from scenario.mapSeed (null when the scenario has none). */
	get map(): World | null {
		return this.world;
	}

	/** Planes in the air, for overlays and tests. */
	get planes(): Transit {
		return this.transit;
	}

	radiusOf(region: number): number {
		return this.radii[region];
	}

	/**
	 * Setup change: rebuild everything and restart at day 0. The map comes from scenario.mapSeed,
	 * so a run is reproducible from the scenario and the seed.
	 */
	setup(scenario: Scenario, diseaseId: DiseaseId = this.diseaseId, seed: number = this.seed): void {
		if (scenario.mapSeed === null) this.world = null;
		else if (this.world?.seed !== scenario.mapSeed) this.world = generateWorld(scenario.mapSeed);
		// The engine's own copy: live policy commands must never write into the caller's scenario,
		// so the same scenario and seed always reproduce the same run.
		this.scenario = structuredClone(scenario);
		this.diseaseId = diseaseId;
		this.lostDeathReported = false;
		const disease = this.diseaseOverride ?? loadDisease(diseaseId);
		this.disease = disease;
		this.agents.diseaseCount = 1;
		const sub = { ...ALL_SUBSYSTEMS, ...scenario.subsystems };
		this.subsystems = sub;
		this.rules = {
			deaths: sub.deaths,
			hospital: sub.hospital,
			ageBands: sub.ageBands,
			illStopsMovement: sub.illStopsMovement
		};
		this.seed = seed;
		this.rng = new Rng(seed);
		this.tick = 0;
		this.queue.length = 0;
		this.events = [];
		const regions = scenario.regions;
		this.counters = new TelemetryCounters(regions.length);
		this.pressure = new Float32Array(regions.length);
		this.strain = new Float32Array(regions.length).fill(1);
		this.overloadSeen = new Uint8Array(regions.length);
		this.firstCaseSeen = new Uint8Array(regions.length);
		this.radii = new Float32Array(regions.length);

		const { dots, peoplePerDot } = allocateDots(regions, this.agents.capacity);
		this.regionDots = dots;
		this.peoplePerDot = peoplePerDot;
		this.beds = regions.map((reg, r) => allBeds(dots[r] * peoplePerDot, reg.policy));
		this.bedCapacity = regions.map((reg, r) => this.beds[r] * reg.policy.spareBedShare.value);
		this.spawn();
		this.routeList = this.world ? generateRoutes(this.world, regions, this.radii) : [];
		this.transit = new Transit(this.agents.capacity, regions.length);
		this.transit.illStops = sub.illStopsMovement;
		this.transit.readyToBoard = this.readyToBoard;
		this.exposure = new Exposure(this.agents.capacity);
		this.grid = new SpatialGrid(
			regions.map((reg, r) => [reg.cx, reg.cy, this.radii[r]]),
			disease.transmissionRadius,
			this.agents.capacity
		);
		this.counters.countPatients(this.agents, this.people, this.routeList, this.rules);
		this.updatePressure();
		this.countsStale = true;
		this.sample(0);
	}

	/**
	 * Pressure = (beds normally occupied + outbreak patients) / all beds, and the strain it puts on
	 * patients (6.6). With hospitals switched off there is no pressure and no strain.
	 */
	private updatePressure(): void {
		const regions = this.scenario.regions;
		for (let r = 0; r < regions.length; r++) {
			const beds = this.beds[r];
			if (!this.subsystems.hospital || beds <= 0) {
				this.pressure[r] = 0;
				this.strain[r] = 1;
				continue;
			}
			const normal = 1 - regions[r].policy.spareBedShare.value;
			const p = normal + this.counters.patients[r] / beds;
			this.pressure[r] = p;
			this.strain[r] = strainMultiplier(p);
			if (p > 1 && this.overloadSeen[r] === 0) {
				this.overloadSeen[r] = 1;
				this.pushEvent({ kind: 'overloaded', region: r, day: this.day });
			}
		}
	}

	private spawn(): void {
		const a = this.agents;
		const rng = this.rng;
		a.reset();
		this.people = new People(a, this.disease, this.peoplePerDot, this.secondaryOnly);
		this.unprotectedAtStart = this.scenario.regions.map(() => 0);
		let slot = 0;
		const waning = this.subsystems.waning;
		this.scenario.regions.forEach((reg, r) => {
			const vaccine = vaccineFor(this.disease, reg.vaccine);
			const [young, , old] = reg.policy.ageMix.value;
			const fatigueMean = reg.policy.lockdownFatigueMeanDays.value * TICKS_PER_DAY;
			const fatigueSd = reg.policy.lockdownFatigueSdDays.value * TICKS_PER_DAY;
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
				a.shown[slot] = State.SUSCEPTIBLE;
				const age = rng.next();
				a.ageBand[slot] = age < young ? 0 : age < 1 - old ? 1 : 2;
				const v = rng.next();
				a.protection[slot] = !vaccine.exists
					? Protection.NONE
					: v < reg.vaccinatedFull
						? Protection.FULL
						: vaccine.hasPartialCourse && v < reg.vaccinatedFull + reg.vaccinatedPartial
							? Protection.PARTIAL
							: Protection.NONE;
				this.people.spawn(slot, a.protection[slot], vaccine, rng, waning, 0);
				this.unprotectedAtStart[r] += this.people.susceptible[slot];
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
		const sub = this.subsystems;
		// 2. Departures.
		if (sub.travel) this.transit.depart(a, this.routeList, this.scenario.regions, this.tick, this.rng);
		// 3. Movement, in a region and in transit.
		moveInRegions(a, this.scenario.regions, this.radii, this.tick, this.rng, sub.illStopsMovement);
		this.transit.move(a, this.routeList, this.scenario.regions, this.radii, this.rng);
		// 4. Spatial grid.
		this.grid.rebuild(a);
		// 5. Transmission.
		transmit(
			a,
			this.grid,
			[this.people],
			[this.exposure],
			this.tick,
			this.rng,
			[this.hooks],
			sub.silentSpread
		);
		// 6. Disease clocks, deaths and hospital load (strain from the last count).
		this.people.advance(this.tick, this.rng, this.hooks, this.deathChance, sub.waning);
		// 7. Waning immunity.
		if (sub.waning) this.people.wane(a.activeCount, this.tick, this.rng);
		// 8. Dot flags, telemetry counters, then pressure for the next tick.
		this.refreshDots();
		this.counters.countPatients(a, this.people, this.routeList, this.rules);
		this.updatePressure();
		this.countsStale = true;
		if (this.tick % TICKS_PER_DAY === 0) this.sample(this.day);
	}

	/** The full recount is only needed for a daily sample or a snapshot, not every tick. */
	private freshCounts(): TelemetryCounters {
		if (this.countsStale) {
			this.counters.recount(this.agents, this.people);
			this.countsStale = false;
		}
		return this.counters;
	}

	private sample(day: number): void {
		this.freshCounts().sample(day, this.pressure);
	}

	/**
	 * Chance of dying for someone in dot i finishing their illness (6.6), with the strain of the dot's
	 * hospital region. An 'era' death rate predates modern hospital care, so strain never applies to it.
	 */
	private readonly deathChance = (i: number, again: boolean): number => {
		const rules = this.rules;
		if (!rules.deaths) return 0;
		const p = this.people;
		const severe = again ? p.severeAgain(i) : p.severe[i];
		const band = this.agents.ageBand[i];
		const d = deathChanceOf(this.disease, band, severe, rules);
		const h = bedChanceOf(this.disease, band, severe, rules);
		const home = hospitalRegion(this.agents, this.routeList, i);
		const m = this.disease.strainApplies && rules.hospital && home >= 0 ? this.strain[home] : 1;
		return deathChanceAtEnd(d, h, m);
	};

	/**
	 * Each dot's flags and drawn state from its people: it stops while half or more of them are ill
	 * (the majority rule, 4.4 of research/finer-counts.md) and when half or more have died, and starts
	 * again in a new direction once fewer are ill.
	 */
	/** Redraw the dots whose people changed: every dot with someone infected, and this tick's other changes. */
	private refreshDots(): void {
		const p = this.people;
		for (let k = 0; k < p.activeCount; k++) this.refreshFlags(p.active[k]);
		for (let k = 0; k < p.changedCount; k++) this.refreshFlags(p.changed[k]);
		p.clearChanged();
		this.countsStale = true;
	}

	/** A dot's map state and its flags: the majority rule for ill and dead (finer-counts §0). */
	private refreshFlags(i: number): void {
		const a = this.agents;
		const p = this.people;
		const half = p.perDot / 2;
		setLook(a, p, i);
		const dead = p.dead[i] >= half ? 1 : 0;
		const ill = p.ill[i] >= half ? 1 : 0;
		if (dead === 1 && a.dead[i] === 0) {
			a.vx[i] = 0;
			a.vy[i] = 0;
			a.isolated[i] = 0;
		}
		a.dead[i] = dead;
		if (ill === a.ill[i]) return;
		a.ill[i] = ill;
		if (ill === 1 && this.rules.illStopsMovement) {
			a.vx[i] = 0;
			a.vy[i] = 0;
		} else if (ill === 0 && dead === 0) {
			a.isolated[i] = 0;
			const h = this.rng.next() * Math.PI * 2;
			a.vx[i] = Math.cos(h) * a.speed[i];
			a.vy[i] = Math.sin(h) * a.speed[i];
		}
	}

	/**
	 * Before a dot boards (4.4): nobody ill ever travels. Its ill people swap places with as many
	 * people who aren't ill from the nearest dot staying in the same city with the same age band and
	 * vaccination level, so every dot's attributes stay true for its people. Each person keeps their
	 * own state and clock. Returns false (the dot doesn't board) if no dot can swap.
	 */
	private readonly readyToBoard = (i: number): boolean => {
		const p = this.people;
		const k = p.ill[i];
		if (k === 0) return true;
		const a = this.agents;
		const r = a.region[i];
		let best = -1;
		let bestD = Infinity;
		for (let j = 0; j < a.activeCount; j++) {
			if (j === i || a.region[j] !== r) continue;
			if (a.ageBand[j] !== a.ageBand[i] || a.protection[j] !== a.protection[i]) continue;
			if (p.notIll(j) < k) continue;
			const d = (a.x[j] - a.x[i]) ** 2 + (a.y[j] - a.y[i]) ** 2;
			if (d < bestD) {
				bestD = d;
				best = j;
			}
		}
		if (best < 0) return false;
		p.moveIll(i, best, this.tick);
		for (let n = 0; n < k; n++) p.moveOneNotIll(best, i, this.tick, this.rng);
		if (this.subsystems.waning) {
			for (const d of [i, best]) {
				p.scheduleVaccineWane(d, this.tick, this.rng);
				p.scheduleRecoveredWane(d, this.tick, this.rng);
			}
		}
		this.refreshDot(best);
		this.refreshDot(i);
		return true;
	};

	private refreshDot(i: number): void {
		const a = this.agents;
		const p = this.people;
		setLook(a, p, i);
		const ill = p.ill[i] >= p.perDot / 2 ? 1 : 0;
		if (ill === 1 && a.ill[i] === 0 && this.rules.illStopsMovement) {
			a.vx[i] = 0;
			a.vy[i] = 0;
		}
		a.ill[i] = ill;
	}

	private applyCommands(): void {
		for (const c of this.queue) {
			if (c.type === 'seed') this.seedCases(c.region, c.count);
			else if (c.type === 'policy') this.setPolicy(c.region, c.policy);
			// lockdown, flights, route and massTest arrive with step 3 of the build.
		}
		this.queue.length = 0;
	}

	/**
	 * A live policy change for one population: travel reads it on the next departure, and its spare
	 * beds are recounted. Nothing else about the population changes, and no other population.
	 */
	private setPolicy(region: number, policy: HealthPolicy): void {
		const reg = this.scenario.regions[region];
		if (!reg) return;
		reg.policy = policy;
		this.beds[region] = allBeds(this.regionDots[region] * this.peoplePerDot, policy);
		this.bedCapacity[region] = this.beds[region] * policy.spareBedShare.value;
	}

	/**
	 * Bring in `count` infected people (index cases), each in a different random dot of the region
	 * that has someone catchable, dots with no vaccine first. Returns the dots.
	 */
	private seedCases(region: number, count: number, tick = this.tick): number[] {
		const a = this.agents;
		const p = this.people;
		const pool: number[] = [];
		for (let i = 0; i < a.activeCount; i++) {
			if (a.region[i] === region && p.catchable(i) > 0) pool.push(i);
		}
		const unprotected = pool.filter((i) => a.protection[i] === Protection.NONE);
		const from = unprotected.length > 0 ? unprotected : pool;
		const chosen: number[] = [];
		for (let k = 0; k < count && from.length > 0; k++) {
			const pick = this.rng.int(from.length);
			const i = from[pick];
			from[pick] = from[from.length - 1];
			from.pop();
			// Index cases spread from `tick` (latent days aside), as if caught in that tick's spread.
			p.infect(i, 1, tick, this.rng, this.hooks, false);
			chosen.push(i);
		}
		this.refreshDots();
		return chosen;
	}

	/**
	 * Seed index cases now (not queued) and return their dots. For calibration and tests. They
	 * count as caught in the next tick, so their clocks start with it and their illness lasts its
	 * full length, as for a seed sent as a command.
	 */
	seedNow(region: number, count: number): number[] {
		return this.seedCases(region, count, this.tick + 1);
	}

	/** Whether anyone is infected (silent or ill) anywhere. */
	anyInfected(): boolean {
		return this.people.activeCount > 0;
	}

	/** People in a region the vaccine didn't protect at the start (lesson 1's denominator, 10). */
	unprotectedPeople(region: number): number {
		return this.unprotectedAtStart[region];
	}

	/** People ever infected in a region, by age band. */
	everInfectedByAge(region: number): Bands {
		return this.counters.everByAge(region);
	}

	/** One region's daily history (fresh typed arrays). Call only when historyVersion changes. */
	history(region: number): RegionHistory {
		return this.counters.regionHistory(region);
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
		const c = this.freshCounts();
		const regions = this.scenario.regions.map((reg, r) => ({
			id: reg.id,
			name: reg.name,
			dots: this.regionDots[r],
			counts: c.regionCounts(r),
			deathsByAge: c.deathsByAge(r),
			deaths: c.deaths(r),
			overloaded: this.pressure[r] > 1,
			capacity: this.bedCapacity[r],
			beds: this.beds[r],
			patients: c.patients[r],
			pressure: this.pressure[r],
			pressureBand: pressureBand(this.pressure[r]),
			strain: this.strain[r],
			lockedDown: false,
			fatiguedShare: 0,
			testCooldown: 0
		}));
		const inTransit = c.regionCounts(this.scenario.regions.length);
		return {
			tick: this.tick,
			day: this.day,
			speed: this.speed,
			peoplePerDot: this.peoplePerDot,
			travelling: this.transit.travellers(this.agents),
			regions,
			inTransit,
			totals: sumCounts([...regions.map((r) => r.counts), inTransit]),
			deaths: regions.reduce((t, r) => t + r.deaths, 0),
			latest: this.scenario.regions.map((_, r) => c.latest(r)),
			historyVersion: c.version,
			events: this.events.slice()
		};
	}
}

/** All hospital beds for this many people. Spare beds are this x spareBedShare. */
function allBeds(people: number, policy: HealthPolicy): number {
	return (people * policy.hospitalBedsPerThousand.value) / 1000;
}

/**
 * The state a dot is drawn in: the most common among its people, the more serious on a tie (dead,
 * ill, silent, recovered, then not infected). At one person per dot it is that person's state.
 */

export function createSimulation(scenario: Scenario, options: SimulationOptions): Simulation {
	return new Simulation(scenario, options);
}
