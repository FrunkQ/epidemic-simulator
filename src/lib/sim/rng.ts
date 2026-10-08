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
}
