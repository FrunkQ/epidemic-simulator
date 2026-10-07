import type { Bands, Sourced } from '../sim/types';

/**
 * COVID-19 (2020 virus) deaths per infection by age, worked out from sourced inputs so the
 * bands can be re-derived and checked (lesson test 16). Inputs:
 * - the global pre-vaccine infection fatality ratio for each single year of age 1-100, in %
 *   (COVID-19 Forecasting Team 2022, Table 1; age 0 is not given, so it takes age 1's value);
 * - the UK population on 1 January 2019 in 5-year groups (Eurostat demo_pjangroup), with 85+
 *   worked out as the 65+ total minus 65-84.
 * Assumptions: each group's rate is the plain mean of its single-year rates, which slightly
 * overstates older groups (fewer people live to the top of each group); and 85+ is 65+ minus 65-84. How 85+ splits by age is not
 * known, so it takes ages 85-94 (central), 85-89 (low) or 85-100 (high).
 */
export const COVID19_IFR_PERCENT_BY_AGE: Sourced<number[]> = {
	value: [
		0.0054, 0.004, 0.0032, 0.0027, 0.0024, 0.0023, 0.0023, 0.0023, 0.0025, 0.0028, 0.0031, 0.0036, 0.0042,
		0.005, 0.006, 0.0071, 0.0085, 0.01, 0.0118, 0.0138, 0.0162, 0.0188, 0.0219, 0.0254, 0.0293, 0.0337,
		0.0386, 0.0442, 0.0504, 0.0573, 0.065, 0.0735, 0.0829, 0.0932, 0.1046, 0.1171, 0.1307, 0.1455, 0.1616,
		0.1789, 0.1976, 0.2177, 0.2391, 0.262, 0.2863, 0.3119, 0.3389, 0.3672, 0.3968, 0.4278, 0.4606, 0.4958,
		0.5342, 0.5766, 0.6242, 0.6785, 0.7413, 0.8149, 0.9022, 1.0035, 1.1162, 1.2413, 1.3803, 1.5346, 1.7058,
		1.8957, 2.1064, 2.3399, 2.5986, 2.8851, 3.2022, 3.5527, 3.9402, 4.3679, 4.8397, 5.3597, 5.932, 6.5612,
		7.252, 8.0093, 8.8381, 9.7437, 10.7311, 11.8054, 12.9717, 14.2346, 15.5984, 17.0669, 18.6431, 20.3292,
		22.1263, 24.0344, 26.0519, 28.176, 30.4021, 32.7239, 35.1335, 37.6213, 40.1762, 42.7856
	],
	sources: ['covid19-forecasting-team-2022-ifr']
};

/** [first age, last age, people] for each UK group, 1 January 2019. */
export const UK_2019_AGE_GROUPS: Sourced<[number, number, number][]> = {
	value: [
		[0, 4, 3885007],
		[5, 9, 4146546],
		[10, 14, 3908395],
		[15, 19, 3661722],
		[20, 24, 4170514],
		[25, 29, 4527006],
		[30, 34, 4485180],
		[35, 39, 4387779],
		[40, 44, 4008205],
		[45, 49, 4457239],
		[50, 54, 4668822],
		[55, 59, 4351807],
		[60, 64, 3716512],
		[65, 69, 3384532],
		[70, 74, 3286389],
		[75, 79, 2281501],
		[80, 84, 1695137],
		[85, 94, 1624819]
	],
	sources: ['eurostat-demo-pjangroup-uk-2019']
};

export type OldestGroup = 'central' | 'low' | 'high';
const OLDEST_LAST_AGE: Record<OldestGroup, number> = { central: 94, low: 89, high: 100 };

function ifrAt(age: number): number {
	const v = COVID19_IFR_PERCENT_BY_AGE.value;
	return v[Math.max(1, age) - 1] / 100;
}

/** Deaths per infection in each band (0-14, 15-64, 65+) and each band's share of people. */
export function covid19BandsPerInfection(oldest: OldestGroup = 'central'): {
	bands: Bands;
	shares: Bands;
} {
	const deaths: Bands = [0, 0, 0];
	const people: Bands = [0, 0, 0];
	for (const [first, given, n] of UK_2019_AGE_GROUPS.value) {
		const last = first === 85 ? OLDEST_LAST_AGE[oldest] : given;
		let sum = 0;
		for (let a = first; a <= last; a++) sum += ifrAt(a);
		const band = first < 15 ? 0 : first < 65 ? 1 : 2;
		deaths[band] += n * (sum / (last - first + 1));
		people[band] += n;
	}
	const total = people[0] + people[1] + people[2];
	return {
		bands: deaths.map((d, i) => d / people[i]) as Bands,
		shares: people.map((p) => p / total) as Bands
	};
}
