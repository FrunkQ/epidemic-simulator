import { Agents } from './agents';
import { Rng } from './rng';
import { Protection, type DiseaseRuntime, type VaccineRuntime } from './types';

/**
 * People inside dots (research/finer-counts.md, option A). For one disease, every dot keeps whole-
 * person counts of its people in each state, and every change is a whole-person random draw. A dot
 * still has one place, one movement, one age band and one vaccination level; its people differ only
 * in where they are in this disease.
 *
 * People infected on the same tick in the same dot share a clock, so a ring buffer per dot holds how
 * many were infected on each of the last silent + ill ticks: those who will get symptoms, split by
 * whether they had had it before (their protection against severe illness differs), and those who
 * never will. An entry's age is the ticks since that infection: with S silent and I ill ticks, people
 * with symptoms fall ill at the end of age S - 1 and finish at the end of age S + I - 1 (at once, for
 * a disease with no silent phase); people without symptoms stay silent until the end of age S + I - 1.
 * Someone still in the latent days (6.1) doesn't spread: silent people under `latentTicks` old.
 * People who never get symptoms spread at `noSymptomInfectiousness` of the rate of those who do.
 */

/** Counts of people that fit in each ring-buffer entry. */
type Buffer = Uint16Array | Uint32Array;

function buffer(size: number, perDot: number): Buffer {
	return perDot > 0xffff ? new Uint32Array(size) : new Uint16Array(size);
}

/** Callbacks for the engine's counters. */
export interface PeopleHooks {
	/** `people` caught it for the first time in dot `dot` (index cases included; reinfections are not counted). */
	onInfected(dot: number, people: number): void;
	/**
	 * `people` with symptoms in dot `dot` finished their illness; `died` of them died. `region` is
	 * the hospital that admitted them when it isn't the dot's own (symptoms that started on a trip),
	 * else -1.
	 */
	onIllnessEnd(dot: number, people: number, died: number, region: number): void;
	/** On tick `tick`, symptoms started for `first` people in dot `dot` and `again` who had had it before. */
	onSymptoms(dot: number, first: number, again: number, tick: number): void;
}

/** People in a dot whose symptoms started on a trip: their hospital is the trip's origin (6.8). */
interface Away {
	/** The tick their illness ends. */
	end: number;
	first: number;
	again: number;
	region: number;
}

export class People {
	readonly perDot: number;
	readonly capacity: number;
	readonly disease: DiseaseRuntime;
	/** Ring-buffer length in ticks: the whole silent and ill course. */
	readonly length: number;
	readonly silentTicks: number;
	readonly illTicks: number;
	readonly latentTicks: number;

	/** Never infected, or vaccine protection waned: catchable, with the dot's vaccine protection against severe illness. */
	readonly susceptible: Int32Array;
	/**
	 * Had it before, immunity waned: catchable again. Kept apart from people never infected so "ever
	 * infected" counts each person once; only where an after-infection figure is sourced do they also
	 * get that protection (otherwise they fall ill like anyone).
	 */
	readonly susceptibleAgain: Int32Array;
	/** The vaccine worked: can't catch it until it wanes. */
	readonly vaccineImmune: Int32Array;
	readonly recovered: Int32Array;
	/**
	 * People in the dot, alive, who have survived an illness with symptoms at least once (6.17): the
	 * base lasting harm is counted on. An expected value, so moving one person moves their expected
	 * share of it with no random draw; it never exceeds the people who have had it.
	 */
	readonly illSurvivors: Float64Array;
	readonly dead: Int32Array;
	/** Infected and not yet ill (will get symptoms). */
	readonly silentSymptomatic: Int32Array;
	/** Of those, people who had it before (the againBuf entries still silent). */
	readonly silentAgain: Int32Array;
	/** Infected and never ill. */
	readonly silentAsymptomatic: Int32Array;
	readonly ill: Int32Array;
	/** Of `ill`, those who had had it before. */
	readonly illAgain: Int32Array;
	/** Silent people still in their latent days: not yet contagious. */
	readonly latent: Int32Array;
	/** Of `latent`, those who will never get symptoms. */
	readonly latentQuiet: Int32Array;
	/** Per dot, ill people whose symptoms started on a trip, so they keep that hospital (rare). */
	private readonly away = new Map<number, Away[]>();
	/** Protection against severe illness for someone in this dot infected despite the vaccine (6.2). */
	readonly severe: Float32Array;
	/** Mean ticks until this dot's vaccine protection fades; 0 when it doesn't. */
	readonly vaccineWaneMean: Float32Array;
	/** Tick of the next person whose vaccine protection, or immunity after infection, fades (6.3). */
	readonly nextVaccineWane: Float64Array;
	readonly nextRecoveredWane: Float64Array;

	private readonly symBuf: Buffer;
	/** Null when protection after infection is no better than none: everyone is then one class. */
	private readonly againBuf: Buffer | null;
	/** Null when everyone infected gets symptoms. */
	private readonly asymBuf: Buffer | null;
	/** Mean ticks until immunity after infection fades; 0 when it doesn't. */
	private readonly recoveredWaneMean: number;
	/** Whether immunity after infection wears off, so anyone who had it may catch it again (6.3). */
	private readonly reinfects: boolean;
	private readonly severeAgainFloor: number;

	/** Dots with anyone infected, so the clocks only visit those. */
	readonly active: Int32Array;
	activeCount = 0;
	/** Infections so far that will get symptoms, and all infections, everywhere (reinfections included). */
	symptomaticInfections = 0;
	infections = 0;
	private readonly isActive: Uint8Array;
	/** Dots that changed this tick while not active (they stopped being, or someone waned), so the map can redraw them. */
	readonly changed: Int32Array;
	changedCount = 0;
	private readonly isChanged: Uint8Array;

	/** Calibration only: people each dot's infectious people infected (6.9). */
	readonly secondaries: Int32Array | null;

	constructor(agents: Agents, disease: DiseaseRuntime, perDot: number, secondaryOnly: boolean) {
		const cap = agents.capacity;
		this.perDot = perDot;
		this.capacity = cap;
		this.disease = disease;
		this.silentTicks = disease.silentTicks;
		this.illTicks = disease.illTicks;
		this.latentTicks = disease.latentTicks;
		this.length = disease.silentTicks + disease.illTicks;
		const counts = () => new Int32Array(cap);
		this.susceptible = counts();
		this.susceptibleAgain = counts();
		this.vaccineImmune = counts();
		this.recovered = counts();
		this.illSurvivors = new Float64Array(cap);
		this.dead = counts();
		this.silentSymptomatic = counts();
		this.silentAsymptomatic = counts();
		this.silentAgain = counts();
		this.ill = counts();
		this.illAgain = counts();
		this.latent = counts();
		this.latentQuiet = counts();
		this.severe = new Float32Array(cap);
		this.vaccineWaneMean = new Float32Array(cap);
		this.nextVaccineWane = new Float64Array(cap).fill(Infinity);
		this.nextRecoveredWane = new Float64Array(cap).fill(Infinity);
		this.symBuf = buffer(cap * this.length, perDot);
		this.againBuf = disease.afterInfectionSevere > 0 ? buffer(cap * this.length, perDot) : null;
		this.asymBuf = disease.asymptomaticFraction > 0 ? buffer(cap * this.length, perDot) : null;
		this.recoveredWaneMean = disease.waningMeanTicks;
		this.reinfects = disease.waningMeanTicks > 0;
		this.severeAgainFloor = disease.afterInfectionSevere;
		this.active = new Int32Array(cap);
		this.isActive = new Uint8Array(cap);
		this.changed = new Int32Array(cap);
		this.isChanged = new Uint8Array(cap);
		this.secondaries = secondaryOnly ? new Int32Array(cap) : null;
	}

	/** Spawn: vaccinate a dot's people one by one, all or nothing (6.1), at the dot's level. */
	spawn(
		i: number,
		protection: number,
		vaccine: VaccineRuntime,
		rng: Rng,
		waning: boolean,
		tick: number
	): void {
		const full = protection === Protection.FULL;
		const partial = protection === Protection.PARTIAL;
		const efficacy = full ? vaccine.fullInfection : partial ? vaccine.partialInfection : 0;
		const immune = rng.binomial(this.perDot, efficacy);
		this.vaccineImmune[i] = immune;
		this.susceptible[i] = this.perDot - immune;
		this.severe[i] = full ? vaccine.fullSevere : partial ? vaccine.partialSevere : 0;
		this.vaccineWaneMean[i] = waning ? vaccine.waningMeanTicks : 0;
		this.scheduleVaccineWane(i, tick, rng);
	}

	/** Protection against severe illness for someone who had had it before. */
	severeAgain(i: number): number {
		return Math.max(this.severe[i], this.severeAgainFloor);
	}

	/**
	 * People in dot i who have caught it in this run, the dead included: everyone who isn't still
	 * never infected. Only people never infected are ever susceptible (first time) or vaccine-immune,
	 * so this moves with its people in the boarding swap and counts each person once, wherever they
	 * are now (the key-worker chart and lesson 21, 6.4). A campaign that vaccinates people who have
	 * had it would need its own tally.
	 */
	everCaught(i: number): number {
		return this.perDot - this.susceptible[i] - this.vaccineImmune[i];
	}

	catchable(i: number): number {
		return this.susceptible[i] + this.susceptibleAgain[i];
	}

	/** Silent and ill people. */
	infected(i: number): number {
		return this.silentSymptomatic[i] + this.silentAsymptomatic[i] + this.ill[i];
	}

	/**
	 * How many people can pass it on now, each weighted by how infectious they are: ill people, and
	 * silent people past their latent days (unless only ill people spread), those who will never get
	 * symptoms at `noSymptomInfectiousness`. A whole number when that is 1.
	 */
	infectious(i: number, silentSpread: boolean): number {
		if (!silentSpread) return this.ill[i];
		const quiet = this.latentQuiet[i];
		const willBeIll = this.silentSymptomatic[i] - (this.latent[i] - quiet);
		const never = this.silentAsymptomatic[i] - quiet;
		return willBeIll + never * this.disease.noSymptomInfectiousness + this.ill[i];
	}

	/** Living people who aren't ill, counted directly (mid-swap a dot briefly holds fewer than perDot). */
	notIll(i: number): number {
		return (
			this.susceptible[i] +
			this.susceptibleAgain[i] +
			this.vaccineImmune[i] +
			this.recovered[i] +
			this.silentSymptomatic[i] +
			this.silentAsymptomatic[i]
		);
	}

	private markChanged(i: number): void {
		if (this.isChanged[i] === 1) return;
		this.isChanged[i] = 1;
		this.changed[this.changedCount++] = i;
	}

	/** Forget this tick's changed dots, once they are redrawn. */
	clearChanged(): void {
		for (let k = 0; k < this.changedCount; k++) this.isChanged[this.changed[k]] = 0;
		this.changedCount = 0;
	}

	private activate(i: number): void {
		if (this.isActive[i] === 1) return;
		this.isActive[i] = 1;
		this.active[this.activeCount++] = i;
	}

	/**
	 * A ring-buffer entry: dot i's people infected `age` ticks before `tick`. Laid out slot by slot
	 * (every dot's entry for one tick of the clock side by side), so the end-of-tick pass over the
	 * active dots reads a few contiguous runs instead of one scattered entry per dot.
	 */
	private at(i: number, tick: number, age: number): number {
		const L = this.length;
		return ((((tick - age) % L) + L) % L) * this.capacity + i;
	}

	/**
	 * Infect `k` catchable people in dot `i` at `tick`. People who had had it before are picked in
	 * proportion to their share. With `setAside` (calibration) they are counted and set aside as
	 * recovered, so they never spread.
	 */
	infect(i: number, k: number, tick: number, rng: Rng, hooks: PeopleHooks, setAside: boolean): void {
		const again = this.susceptibleAgain[i];
		const total = this.susceptible[i] + again;
		if (k > total) k = total;
		if (k <= 0) return;
		let kAgain = again > 0 ? Math.min(again, rng.binomial(k, again / total)) : 0;
		let kFirst = k - kAgain;
		if (kFirst > this.susceptible[i]) {
			kFirst = this.susceptible[i];
			kAgain = k - kFirst;
		}
		this.susceptible[i] -= kFirst;
		this.susceptibleAgain[i] -= kAgain;
		// "Ever infected" counts each person once, so reinfections are not added.
		hooks.onInfected(i, kFirst);
		if (setAside) {
			this.recovered[i] += k;
			return;
		}
		const af = this.disease.asymptomaticFraction;
		const aFirst = af > 0 ? rng.binomial(kFirst, af) : 0;
		const aAgain = af > 0 ? rng.binomial(kAgain, af) : 0;
		let symFirst = kFirst - aFirst;
		let symAgain = kAgain - aAgain;
		const asym = aFirst + aAgain;
		this.infections += k;
		this.symptomaticInfections += k - asym;
		// With no better protection after infection, everyone is one class.
		if (this.againBuf === null) {
			symFirst += symAgain;
			symAgain = 0;
		}
		const b = this.at(i, tick, 0);
		this.symBuf[b] += symFirst;
		if (this.againBuf) this.againBuf[b] += symAgain;
		if (this.asymBuf) this.asymBuf[b] += asym;
		this.silentAsymptomatic[i] += asym;
		if (this.silentTicks === 0) {
			// No silent phase (e.g. Ebola): symptoms start at once.
			this.ill[i] += symFirst + symAgain;
			this.illAgain[i] += symAgain;
			if (symFirst + symAgain > 0) hooks.onSymptoms(i, symFirst, symAgain, tick);
		} else {
			this.silentSymptomatic[i] += symFirst + symAgain;
			this.silentAgain[i] += symAgain;
		}
		if (this.latentTicks > 0) {
			this.latent[i] += asym + (this.silentTicks > 0 ? symFirst + symAgain : 0);
			this.latentQuiet[i] += asym;
		}
		this.activate(i);
	}

	/**
	 * End of a tick: move every active dot's people along their clocks. `deathChance(i, again, region)`
	 * is the chance of dying for someone in dot i finishing their illness, with protection after
	 * infection when `again`, in hospital `region` (-1: the dot's own). Recovered people start waning
	 * when `waning` is on.
	 */
	advance(
		tick: number,
		rng: Rng,
		hooks: PeopleHooks,
		deathChance: (i: number, again: boolean, region: number) => number,
		waning: boolean
	): void {
		const S = this.silentTicks;
		const I = this.illTicks;
		const lat = this.latentTicks;
		const sym = this.symBuf;
		const again = this.againBuf;
		const asym = this.asymBuf;
		// Every dot's clock is at the same place this tick, so the slots are worked out once.
		const slot = (age: number) => this.at(0, tick, age);
		const latSym = lat > 0 && S > 0 ? slot(Math.min(lat, S) - 1) : -1;
		const latAsym = lat > 0 && asym ? slot(Math.min(lat, S + I) - 1) : -1;
		const onset = S > 0 ? slot(S - 1) : -1;
		const finish = slot(S + I - 1);
		for (let k = this.activeCount - 1; k >= 0; k--) {
			const i = this.active[k];
			if (latSym >= 0) {
				const b = latSym + i;
				this.latent[i] -= sym[b] + (again ? again[b] : 0);
			}
			if (latAsym >= 0) {
				const n = asym![latAsym + i];
				this.latent[i] -= n;
				this.latentQuiet[i] -= n;
			}
			if (onset >= 0) {
				const b = onset + i;
				const first = sym[b];
				const twice = again ? again[b] : 0;
				if (first + twice > 0) {
					this.silentSymptomatic[i] -= first + twice;
					this.silentAgain[i] -= twice;
					this.ill[i] += first + twice;
					this.illAgain[i] += twice;
					hooks.onSymptoms(i, first, twice, tick);
				}
			}
			const end = finish + i;
			const first = sym[end];
			const twice = again ? again[end] : 0;
			const quiet = asym ? asym[end] : 0;
			if (first + twice > 0) {
				this.ill[i] -= first + twice;
				this.illAgain[i] -= twice;
				let localFirst = first;
				let localTwice = twice;
				// Reinfected people ending this tick and not yet handled: still in the pool (6.17).
				let pendingAgain = twice;
				const away = this.away.size > 0 ? this.away.get(i) : undefined;
				if (away) {
					// Those whose symptoms started on a trip end their illness in the hospital that took them.
					for (let e = away.length - 1; e >= 0; e--) {
						const g = away[e];
						if (g.end !== tick) continue;
						localFirst -= g.first;
						localTwice -= g.again;
						this.endIllness(i, g.first, g.again, pendingAgain, g.region, rng, hooks, deathChance);
						pendingAgain -= g.again;
						away.splice(e, 1);
					}
					if (away.length === 0) this.away.delete(i);
				}
				if (localFirst + localTwice > 0)
					this.endIllness(i, localFirst, localTwice, pendingAgain, -1, rng, hooks, deathChance);
			}
			if (quiet > 0) {
				this.silentAsymptomatic[i] -= quiet;
				this.recovered[i] += quiet;
			}
			if (first + twice + quiet > 0 && waning) this.scheduleRecoveredWane(i, tick, rng);
			sym[end] = 0;
			if (again) again[end] = 0;
			if (asym) asym[end] = 0;
			if (this.infected(i) === 0) {
				this.isActive[i] = 0;
				this.active[k] = this.active[--this.activeCount];
				this.markChanged(i);
			}
		}
	}

	/** Waning (6.3) as scheduled events: each fade moves one person, then the next one is drawn. */
	wane(n: number, tick: number, rng: Rng): void {
		for (let i = 0; i < n; i++) {
			while (this.nextVaccineWane[i] <= tick) {
				this.vaccineImmune[i]--;
				this.susceptible[i]++;
				this.scheduleVaccineWane(i, this.nextVaccineWane[i], rng);
			}
			while (this.nextRecoveredWane[i] <= tick) {
				this.recovered[i]--;
				// Kept apart from people never infected, so "ever infected" counts each person once.
				this.susceptibleAgain[i]++;
				this.markChanged(i);
				this.scheduleRecoveredWane(i, this.nextRecoveredWane[i], rng);
			}
		}
	}

	/** The next vaccine fade: exponential at the rate of everyone it protects (memoryless, so redrawn on any change). */
	scheduleVaccineWane(i: number, from: number, rng: Rng): void {
		const mean = this.vaccineWaneMean[i];
		const n = this.vaccineImmune[i];
		this.nextVaccineWane[i] = mean > 0 && n > 0 ? from + rng.exponential(mean / n) : Infinity;
	}

	scheduleRecoveredWane(i: number, from: number, rng: Rng): void {
		const mean = this.recoveredWaneMean;
		const n = this.recovered[i];
		this.nextRecoveredWane[i] = mean > 0 && n > 0 ? from + rng.exponential(mean / n) : Infinity;
	}

	/** Ages (ticks since infection) of entries whose people with symptoms are ill now, between ticks. */
	private illAges(): [number, number] {
		return [this.silentTicks > 0 ? this.silentTicks : 0, this.silentTicks + this.illTicks - 1];
	}

	/**
	 * Note that `first` and `again` people in dot `i`, whose symptoms started on tick `onset` on a
	 * trip, are patients of hospital `region` until their illness ends (6.8).
	 */
	markAway(i: number, onset: number, first: number, again: number, region: number): void {
		// Symptoms start at age S - 1 (at once with no silent phase) and the illness ends at age S + I - 1.
		// With no silent phase symptoms start at infection, which happens only in a city, so that case
		// never reaches here; it is kept so the end stays right if trips ever carry infections.
		const end = onset + this.illTicks - (this.silentTicks > 0 ? 0 : 1);
		const group = { end, first, again, region };
		const list = this.away.get(i);
		if (list) list.push(group);
		else this.away.set(i, [group]);
	}

	/** People in a dot whose symptoms started on a trip, still ill (for tests). */
	awayCount(i: number): number {
		return (this.away.get(i) ?? []).reduce((n, g) => n + g.first + g.again, 0);
	}

	private endIllness(
		i: number,
		first: number,
		twice: number,
		/** Reinfected people ending this tick and not yet handled, `twice` included. */
		pendingAgain: number,
		region: number,
		rng: Rng,
		hooks: PeopleHooks,
		deathChance: (i: number, again: boolean, region: number) => number
	): void {
		const diedFirst = first > 0 ? rng.binomial(first, deathChance(i, false, region)) : 0;
		const diedTwice = twice > 0 ? rng.binomial(twice, deathChance(i, true, region)) : 0;
		const died = diedFirst + diedTwice;
		// Reinfected people held their expected share of the dot's survivors; now every one who lives is
		// a survivor (even if their first time had no symptoms), and those who die take their share.
		if (twice > 0) {
			const have = this.illSurvivors[i];
			const share = have > 0 ? have / Math.max(this.hadIt(i) + pendingAgain, have) : 0;
			this.illSurvivors[i] += twice - diedTwice - twice * share;
		}
		this.illSurvivors[i] += first - diedFirst;
		this.dead[i] += died;
		this.recovered[i] += first + twice - died;
		hooks.onIllnessEnd(i, first + twice, died, region);
	}

	/**
	 * Move everyone ill in dot `from` to dot `to`, each on their own clock. Done between ticks (before
	 * departures), so an entry's age is the ticks since its infection.
	 */
	moveIll(from: number, to: number, tick: number): number {
		const moved = this.ill[from];
		if (moved === 0) return 0;
		const away = this.away.get(from);
		if (away) {
			// They keep the hospital that took them.
			const into = this.away.get(to);
			if (into) into.push(...away);
			else this.away.set(to, away);
			this.away.delete(from);
		}
		// Ill people who had it before take their expected share of the dot's survivors (6.17).
		if (this.illAgain[from] > 0) this.moveSurvivorShare(from, to, this.illAgain[from]);
		const [lo, hi] = this.illAges();
		for (let a = lo; a <= hi; a++) {
			this.moveEntry(this.symBuf, from, to, tick, a);
			if (this.againBuf) this.moveEntry(this.againBuf, from, to, tick, a);
		}
		this.ill[to] += moved;
		this.illAgain[to] += this.illAgain[from];
		this.ill[from] = 0;
		this.illAgain[from] = 0;
		this.activate(to);
		return moved;
	}

	private moveEntry(buf: Buffer, from: number, to: number, tick: number, age: number): void {
		const f = this.at(from, tick, age);
		const n = buf[f];
		if (n === 0) return;
		buf[this.at(to, tick, age)] += n;
		buf[f] = 0;
	}

	/**
	 * Living people in a dot who may have had it before, the pool its survivors are among: recovered,
	 * immunity worn off, and ill or silent again. Where immunity wears off, silent people who will
	 * never get symptoms are in it too, since some of them are reinfected; with lifelong immunity none
	 * of them can be.
	 */
	private hadIt(i: number): number {
		return (
			this.recovered[i] +
			this.susceptibleAgain[i] +
			this.illAgain[i] +
			this.silentAgain[i] +
			(this.reinfects ? this.silentAsymptomatic[i] : 0)
		);
	}

	/**
	 * `n` people from the pool leave `from` for `to` (before they are taken off its counts): they take
	 * their expected share of the dot's survivors with them, so neither dot holds more survivors than
	 * its pool.
	 */
	private moveSurvivorShare(from: number, to: number, n = 1): void {
		const have = this.illSurvivors[from];
		if (have <= 0) return;
		const moved = (n * have) / Math.max(this.hadIt(from), have);
		this.illSurvivors[from] -= moved;
		this.illSurvivors[to] += moved;
	}

	/**
	 * Move one living person who isn't ill, picked at random, from dot `from` to dot `to`, with
	 * their state and their place on the clock. Returns false if `from` has nobody to give.
	 */
	moveOneNotIll(from: number, to: number, tick: number, rng: Rng): boolean {
		const total = this.notIll(from);
		if (total <= 0) return false;
		let u = rng.int(total);
		for (const counts of [this.susceptible, this.susceptibleAgain, this.vaccineImmune, this.recovered]) {
			if (u < counts[from]) {
				// Someone who has had it carries their expected share of the dot's survivors (6.17).
				if (counts === this.recovered || counts === this.susceptibleAgain) this.moveSurvivorShare(from, to);
				counts[from]--;
				counts[to]++;
				return true;
			}
			u -= counts[from];
		}
		// Silent people, entry by entry, so they keep their clock.
		const S = this.silentTicks;
		const I = this.illTicks;
		const lat = this.latentTicks;
		const silentEnd = S - 1;
		const bufs: [Buffer | null, number][] = [
			[this.symBuf, silentEnd],
			[this.againBuf, silentEnd],
			[this.asymBuf, S + I - 1]
		];
		for (const [buf, last] of bufs) {
			if (!buf) continue;
			const symptomatic = buf !== this.asymBuf;
			const again = buf === this.againBuf;
			for (let a = 0; a <= last; a++) {
				const f = this.at(from, tick, a);
				if (u >= buf[f]) {
					u -= buf[f];
					continue;
				}
				// Someone reinfected, or, where immunity wears off, silent with no symptoms (perhaps
				// reinfected), carries the share.
				if (again || (!symptomatic && this.reinfects)) this.moveSurvivorShare(from, to);
				if (again) {
					this.silentAgain[from]--;
					this.silentAgain[to]++;
				}
				buf[f]--;
				buf[this.at(to, tick, a)]++;
				const silent = symptomatic ? this.silentSymptomatic : this.silentAsymptomatic;
				silent[from]--;
				silent[to]++;
				const stillLatent = lat > 0 && (symptomatic ? a < Math.min(lat, S) : a < Math.min(lat, S + I));
				if (stillLatent) {
					this.latent[from]--;
					this.latent[to]++;
					if (!symptomatic) {
						this.latentQuiet[from]--;
						this.latentQuiet[to]++;
					}
				}
				this.activate(to);
				return true;
			}
		}
		return false;
	}
}
