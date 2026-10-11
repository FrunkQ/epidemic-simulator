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
	/** `people` with symptoms in dot `dot` finished their illness; `died` of them died. */
	onIllnessEnd(dot: number, people: number, died: number): void;
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
	/** Had it before, immunity waned: catchable, with protection after infection (0 unless sourced). */
	readonly susceptibleAgain: Int32Array;
	/** The vaccine worked: can't catch it until it wanes. */
	readonly vaccineImmune: Int32Array;
	readonly recovered: Int32Array;
	readonly dead: Int32Array;
	/** Infected and not yet ill (will get symptoms). */
	readonly silentSymptomatic: Int32Array;
	/** Infected and never ill. */
	readonly silentAsymptomatic: Int32Array;
	readonly ill: Int32Array;
	/** Of `ill`, those who had had it before. */
	readonly illAgain: Int32Array;
	/** Silent people still in their latent days: not yet contagious. */
	readonly latent: Int32Array;
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
		this.dead = counts();
		this.silentSymptomatic = counts();
		this.silentAsymptomatic = counts();
		this.ill = counts();
		this.illAgain = counts();
		this.latent = counts();
		this.severe = new Float32Array(cap);
		this.vaccineWaneMean = new Float32Array(cap);
		this.nextVaccineWane = new Float64Array(cap).fill(Infinity);
		this.nextRecoveredWane = new Float64Array(cap).fill(Infinity);
		this.symBuf = buffer(cap * this.length, perDot);
		this.againBuf = disease.afterInfectionSevere > 0 ? buffer(cap * this.length, perDot) : null;
		this.asymBuf = disease.asymptomaticFraction > 0 ? buffer(cap * this.length, perDot) : null;
		this.recoveredWaneMean = disease.waningMeanTicks;
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

	catchable(i: number): number {
		return this.susceptible[i] + this.susceptibleAgain[i];
	}

	/** Silent and ill people. */
	infected(i: number): number {
		return this.silentSymptomatic[i] + this.silentAsymptomatic[i] + this.ill[i];
	}

	/** People who can pass it on now: ill, and silent past their latent days (unless only ill people spread). */
	infectious(i: number, silentSpread: boolean): number {
		const silent = silentSpread ? this.silentSymptomatic[i] + this.silentAsymptomatic[i] - this.latent[i] : 0;
		return silent + this.ill[i];
	}

	/** Living people who aren't ill. */
	notIll(i: number): number {
		return this.perDot - this.dead[i] - this.ill[i];
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

	private at(i: number, tick: number, age: number): number {
		const L = this.length;
		return i * L + ((((tick - age) % L) + L) % L);
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
		} else {
			this.silentSymptomatic[i] += symFirst + symAgain;
		}
		if (this.latentTicks > 0) this.latent[i] += asym + (this.silentTicks > 0 ? symFirst + symAgain : 0);
		this.activate(i);
	}

	/**
	 * End of a tick: move every active dot's people along their clocks. `deathChance(i, again)` is
	 * the chance of dying for someone in dot i finishing their illness, with protection after
	 * infection when `again`. Recovered people start waning when `waning` is on.
	 */
	advance(
		tick: number,
		rng: Rng,
		hooks: PeopleHooks,
		deathChance: (i: number, again: boolean) => number,
		waning: boolean
	): void {
		const S = this.silentTicks;
		const I = this.illTicks;
		const lat = this.latentTicks;
		const sym = this.symBuf;
		const again = this.againBuf;
		const asym = this.asymBuf;
		// Every dot's clock is at the same place this tick, so the slots are worked out once.
		const L = this.length;
		const slot = (age: number) => this.at(0, tick, age);
		const latSym = lat > 0 && S > 0 ? slot(Math.min(lat, S) - 1) : -1;
		const latAsym = lat > 0 && asym ? slot(Math.min(lat, S + I) - 1) : -1;
		const onset = S > 0 ? slot(S - 1) : -1;
		const finish = slot(S + I - 1);
		for (let k = this.activeCount - 1; k >= 0; k--) {
			const i = this.active[k];
			const row = i * L;
			if (latSym >= 0) {
				const b = row + latSym;
				this.latent[i] -= sym[b] + (again ? again[b] : 0);
			}
			if (latAsym >= 0) this.latent[i] -= asym![row + latAsym];
			if (onset >= 0) {
				const b = row + onset;
				const first = sym[b];
				const twice = again ? again[b] : 0;
				if (first + twice > 0) {
					this.silentSymptomatic[i] -= first + twice;
					this.ill[i] += first + twice;
					this.illAgain[i] += twice;
				}
			}
			const end = row + finish;
			const first = sym[end];
			const twice = again ? again[end] : 0;
			const quiet = asym ? asym[end] : 0;
			if (first + twice > 0) {
				this.ill[i] -= first + twice;
				this.illAgain[i] -= twice;
				let died = 0;
				if (first > 0) died += rng.binomial(first, deathChance(i, false));
				if (twice > 0) died += rng.binomial(twice, deathChance(i, true));
				this.dead[i] += died;
				this.recovered[i] += first + twice - died;
				hooks.onIllnessEnd(i, first + twice, died);
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
				if (this.againBuf) this.susceptibleAgain[i]++;
				else this.susceptible[i]++;
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
	 * Move everyone ill in dot `from` to dot `to`, each on their own clock. Done between ticks (before
	 * departures), so an entry's age is the ticks since its infection.
	 */
	moveIll(from: number, to: number, tick: number): number {
		const moved = this.ill[from];
		if (moved === 0) return 0;
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
	 * Move one living person who isn't ill, picked at random, from dot `from` to dot `to`, with
	 * their state and their place on the clock. Returns false if `from` has nobody to give.
	 */
	moveOneNotIll(from: number, to: number, tick: number, rng: Rng): boolean {
		const total = this.notIll(from);
		if (total <= 0) return false;
		let u = rng.int(total);
		for (const counts of [this.susceptible, this.susceptibleAgain, this.vaccineImmune, this.recovered]) {
			if (u < counts[from]) {
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
			for (let a = 0; a <= last; a++) {
				const f = this.at(from, tick, a);
				if (u >= buf[f]) {
					u -= buf[f];
					continue;
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
				}
				this.activate(to);
				return true;
			}
		}
		return false;
	}
}
