import { describe, expect, it } from 'vitest';
import { COLOURS, MAP_PALETTE } from '../../src/lib/sim/render';

/*
 * The map's colour check: every pair of colours either view draws stays at least as far apart as
 * the closest pair of full colours on the old map, under normal vision and under protan, deutan
 * and tritan colour blindness. Distance is OKLab ΔE × 100 (Ottosson 2020), colour blindness the
 * Machado, Oliveira & Fernandes 2009 simulation at severity 1, in linear RGB, as the dataviz
 * palette validator measures them.
 */
type Vision = 'normal' | 'protan' | 'deutan' | 'tritan';
const VISIONS: Vision[] = ['normal', 'protan', 'deutan', 'tritan'];
const MACHADO: Record<Exclude<Vision, 'normal'>, number[][]> = {
	protan: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998]
	],
	deutan: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881]
	],
	tritan: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039]
	]
};

function srgb(colour: string): number[] {
	const rgb = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(colour);
	const v = rgb ? rgb.slice(1).map(Number) : [1, 3, 5].map((k) => parseInt(colour.slice(k, k + 2), 16));
	return v.map((c) => c / 255);
}
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab(colour: string, vision: Vision): number[] {
	let [r, g, b] = srgb(colour).map(linear);
	if (vision !== 'normal') {
		const m = MACHADO[vision];
		const clamp = (c: number) => Math.max(0, Math.min(1, c));
		[r, g, b] = m.map((row) => clamp(row[0] * r + row[1] * g + row[2] * b));
	}
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
	];
}
const deltaE = (a: string, b: string, vision: Vision) => {
	const [x, y] = [oklab(a, vision), oklab(b, vision)];
	return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** The old map's closest pair of full colours, for each vision. */
function oldMapWorst(vision: Vision): number {
	const all = Object.values(COLOURS);
	let worst = Infinity;
	for (let i = 0; i < all.length; i++)
		for (let j = i + 1; j < all.length; j++) worst = Math.min(worst, deltaE(all[i], all[j], vision));
	return worst;
}

/** Each pair the map draws, with the distance that tells them apart. */
function mapPairs(vision: Vision): { name: string; e: number }[] {
	const { bases, lifted, shadeFills } = MAP_PALETTE;
	const out: { name: string; e: number }[] = [];
	const b = Object.entries(bases);
	for (let i = 0; i < b.length; i++)
		for (let j = i + 1; j < b.length; j++) {
			const names = [b[i][0], b[j][0]].sort().join(' | ');
			out.push({ name: `dimmed ${names}`, e: deltaE(b[i][1], b[j][1], vision) });
		}
	// Specks, and Shading's outline round an infected dot, against every dimmed dot.
	for (const [ln, l] of Object.entries(lifted))
		for (const [bn, bc] of b) out.push({ name: `lifted ${ln} | dimmed ${bn}`, e: deltaE(l, bc, vision) });
	out.push({ name: 'lifted silent | lifted ill', e: deltaE(lifted.silent, lifted.symptomatic, vision) });
	// Shading: every silent dot against every ill one, from any dimmed dot at any strength drawn. A
	// dot is its fill and its edge: the outline where it has one, else the fill. Two dots are told
	// apart by whichever of the two is further apart. A solid dot, drawn without an outline, must also
	// stand apart from every dimmed dot by its fill alone.
	const look = (s: { fill: string; outline: boolean }, target: 'silent' | 'symptomatic') => ({
		fill: s.fill,
		edge: s.outline ? lifted[target] : s.fill
	});
	for (const silent of shadeFills.filter((f) => f.target === 'silent'))
		for (const ill of shadeFills.filter((f) => f.target === 'symptomatic'))
			for (const s of silent.fills)
				for (const t of ill.fills) {
					const [x, y] = [look(s, 'silent'), look(t, 'symptomatic')];
					out.push({
						name: `shaded ${silent.base} silent at ${s.strength.toFixed(2)} | ${ill.base} ill at ${t.strength.toFixed(2)}`,
						e: Math.max(deltaE(x.fill, y.fill, vision), deltaE(x.edge, y.edge, vision))
					});
				}
	for (const f of shadeFills)
		for (const s of f.fills.filter((s) => !s.outline))
			for (const [bn, bc] of b)
				out.push({
					name: `shaded ${f.base} ${f.target} at ${s.strength.toFixed(2)}, no outline | dimmed ${bn}`,
					e: deltaE(s.fill, bc, vision)
				});
	return out;
}

describe('map colours', () => {
	for (const vision of VISIONS)
		it(`every pair the map draws is at least as far apart as the old map's closest pair (${vision})`, () => {
			const bar = oldMapWorst(vision);
			const close = mapPairs(vision)
				.filter((p) => p.e < bar)
				.map((p) => `${p.name}: ${p.e.toFixed(1)} < ${bar.toFixed(1)}`);
			expect(close).toEqual([]);
		});

	it('the check sees a pair that is too close', () => {
		// The dimmed colours before this check: green and yellow 10 apart for normal vision.
		expect(deltaE('rgb(35,108,89)', 'rgb(115,116,72)', 'normal')).toBeLessThan(oldMapWorst('normal'));
	});
});
