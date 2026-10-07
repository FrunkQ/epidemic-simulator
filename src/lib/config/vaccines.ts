import type { Vaccine } from '../sim/types';

/**
 * Protection against severe disease for a vaccinated person the vaccine did not stop from being
 * infected: 1 - (1 - severe) / (1 - infection). `severe` is the published protection in everyone
 * vaccinated, so this is what is left for breakthrough cases. Never clamped: a negative result
 * would mean the two numbers don't fit together, and a test catches that.
 */
export function breakthroughSevereProtection(infection: number, severe: number): number {
	if (infection >= 1) throw new RangeError('infection protection must be below 1 to have breakthrough cases');
	return 1 - (1 - severe) / (1 - infection);
}

/** The key citations use for a vaccine in usedFor, e.g. "mRNA-original" or "IPV". */
export function vaccineKey(vaccine: Vaccine): string {
	return vaccine.version ? `${vaccine.product}-${vaccine.version}` : vaccine.product;
}

/** The disease's default vaccine, or undefined when it has none. */
export function defaultVaccine(vaccines: Vaccine[] | undefined): Vaccine | undefined {
	return vaccines?.find((v) => v.default === true);
}

/**
 * Adds up confirmed vaccine-caused deaths per 100,000 doses. A null rate (no death established as
 * caused by the vaccine) is never counted as 0: it is left out, and when every rate is null the
 * result is null, so the panel shows "No deaths confirmed as caused by this vaccine" instead of 0.
 */
export function sumDeathsPer100k(vaccines: Vaccine[]): number | null {
	let total: number | null = null;
	for (const v of vaccines) {
		const rate = v.deathsPer100kDoses.value;
		if (rate === null) continue;
		total = (total ?? 0) + rate;
	}
	return total;
}
