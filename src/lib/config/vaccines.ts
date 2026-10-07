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

/**
 * Protection of a vaccine measured relative to another, against people with no vaccine:
 * 1 - (1 - relative) x (1 - base). Used for the updated COVID-19 vaccine, whose sources compare it
 * with the original vaccine rather than with the unvaccinated.
 */
export function stackedProtection(relative: number, base: number): number {
	return 1 - (1 - relative) * (1 - base);
}

/** The key citations use for a vaccine in usedFor, e.g. "covid-updated" or "IPV". */
export function vaccineKey(vaccine: Vaccine): string {
	return vaccine.version ? `${vaccine.product}-${vaccine.version}` : vaccine.product;
}

/** The disease's default vaccine, or undefined when it has none. */
export function defaultVaccine(vaccines: Vaccine[] | undefined): Vaccine | undefined {
	return vaccines?.find((v) => v.default === true);
}

/**
 * Deaths caused by one vaccine product over a number of doses given, for HarmComparison (6.13).
 * Products are never added together: each population is given one product. A null rate (a source
 * says no death has been established as caused by the vaccine) stays null for any number of
 * doses, so the panel shows "No deaths confirmed as caused by this vaccine" instead of 0.
 */
export function vaccineCausedDeaths(vaccine: Vaccine, doses: number): number | null {
	if (!(doses >= 0)) throw new RangeError('doses must be zero or more');
	const rate = vaccine.deathsPer100kDoses.value;
	return rate === null ? null : (rate * doses) / 100_000;
}
