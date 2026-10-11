/**
 * Seeded random numbers (sfc32). Every random draw in the simulation goes through here,
 * so the same seed and the same commands always give the same epidemic.
 */
export class Rng {
	private a: number;
	private b: number;
	private c: number;
	private d: number;
	private spare = 0;
	private hasSpare = false;

	constructor(seed: number) {
		// Expand the seed with splitmix32 so nearby seeds give unrelated streams.
		let s = seed >>> 0;
		const mix = () => {
			s = (s + 0x9e3779b9) | 0;
			let z = s;
			z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
			z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
			return (z ^ (z >>> 16)) >>> 0;
		};
		this.a = mix();
		this.b = mix();
		this.c = mix();
		this.d = mix();
		for (let i = 0; i < 12; i++) this.next();
	}

	/** Uniform in [0, 1). */
	next(): number {
		const t = (((this.a + this.b) | 0) + this.d) | 0;
		this.d = (this.d + 1) | 0;
		this.a = this.b ^ (this.b >>> 9);
		this.b = (this.c + (this.c << 3)) | 0;
		this.c = (this.c << 21) | (this.c >>> 11);
		this.c = (this.c + t) | 0;
		return (t >>> 0) / 4294967296;
	}

	/** Integer in [0, n). */
	int(n: number): number {
		return Math.floor(this.next() * n);
	}

	range(min: number, max: number): number {
		return min + (max - min) * this.next();
	}

	/** Standard normal (Box-Muller). */
	normal(): number {
		if (this.hasSpare) {
			this.hasSpare = false;
			return this.spare;
		}
		let u = 0;
		while (u === 0) u = this.next();
		const v = this.next();
		const r = Math.sqrt(-2 * Math.log(u));
		this.spare = r * Math.sin(2 * Math.PI * v);
		this.hasSpare = true;
		return r * Math.cos(2 * Math.PI * v);
	}

	/** Poisson draw (Knuth; fine for the small means used for departures). */
	poisson(mean: number): number {
		const limit = Math.exp(-mean);
		let k = 0;
		let p = this.next();
		while (p > limit) {
			k++;
			p *= this.next();
		}
		return k;
	}

	/**
	 * Binomial draw: how many of `n` people an event with chance `p` happens to. Inversion for small
	 * means, a rounded normal for large ones (where its error is far below the draw's own spread).
	 */
	binomial(n: number, p: number): number {
		if (n <= 0 || p <= 0) return 0;
		if (p >= 1) return n;
		if (p > 0.5) return n - this.binomial(n, 1 - p);
		const mean = n * p;
		if (mean > 30) {
			const k = Math.round(mean + Math.sqrt(mean * (1 - p)) * this.normal());
			return k < 0 ? 0 : k > n ? n : k;
		}
		const q = 1 - p;
		const s = p / q;
		const a = (n + 1) * s;
		let r = Math.pow(q, n);
		let u = this.next();
		let x = 0;
		while (u > r) {
			u -= r;
			x++;
			if (x > n) return n;
			r *= a / x - s;
		}
		return x;
	}

	/**
	 * binomial(n, 1 - e^logEscape), for spread, where each of n people escapes with chance
	 * e^logEscape. Nobody is infected far more often than not, and that case costs one exp.
	 */
	binomialEscape(n: number, logEscape: number): number {
		if (n <= 0 || logEscape >= 0) return 0;
		const p = -Math.expm1(logEscape);
		if (p > 0.5 || n * p > 30) return this.binomial(n, p);
		let r = Math.exp(n * logEscape);
		let u = this.next();
		if (u <= r) return 0;
		const q = 1 - p;
		const s = p / q;
		const a = (n + 1) * s;
		let x = 0;
		while (u > r) {
			u -= r;
			x++;
			if (x > n) return n;
			r *= a / x - s;
		}
		return x;
	}

	/** Exponential draw with the given mean. */
	exponential(mean: number): number {
		return -Math.log(1 - this.next()) * mean;
	}
}
