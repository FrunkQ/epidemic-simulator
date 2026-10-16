import type { DiseaseConfig } from '../sim/types';

/**
 * What a card says about lasting harm (6.17). Counts are expected values, so they read "about",
 * rounded like deaths; with several harms counted (one person can have more than one), the
 * headline is "at least" the largest.
 */
export interface HarmText {
	/** The line under Recovered, or null when the disease has nothing to say. */
	line: string | null;
	/** Its hover: each counted harm with its count, then the lines not counted and the footnotes. */
	hover: string;
	/** The babies line, where the disease counts harm to babies. */
	babies: string | null;
	babiesHover: string;
}

/** A count of people, rounded, with "fewer than 1" where rounding would show 0 for some. */
export function about(n: number): string {
	if (n > 0 && n < 0.5) return 'fewer than 1';
	return Math.round(n).toLocaleString('en-GB');
}

/**
 * "about 12", or "fewer than 1" with no "about" or "at least" in front, which would read wrongly.
 * `shown` is the count written after the qualifier (the largest of several harms), when it isn't `n`.
 */
function counted(n: number, qualifier: 'about' | 'at least', shown = n): string {
	if (about(n) === 'fewer than 1') return 'fewer than 1';
	return `${qualifier} ${about(shown)}`;
}
/** Whether the count reads as one person ("fewer than 1" and "about 1"), for the singular. */
function isOne(n: number): boolean {
	return n > 0 && Math.round(n) <= 1;
}
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Babies are an event, counted in the same city as deaths (6.8). */
export const BABIES_WHERE =
	'Counted in the same city as deaths: where the mother fell ill, or, if she fell ill on a trip, the city she set out from.';

/** The hover's first line: who the count is among (6.17). */
export const WHO_COUNTED =
	'Counted among the people here now who have had it with symptoms and survived, wherever they caught it.';
export const WANED_TOO =
	'Includes people whose immunity has since worn off, who are no longer shown as recovered but still live with the harm.';

/**
 * `ofRecovered`: everyone counted is in the card's Recovered (immunity never fades), so the line
 * can hang off it with "of whom"; otherwise it stands alone.
 */
export function harmText(
	disease: DiseaseConfig,
	harmed: number[],
	babies: number,
	ofRecovered: boolean
): HarmText {
	const harm = disease.lastingHarm;
	const baby = disease.babyHarm;
	let line: string | null = null;
	const hover: string[] = [];
	if (harm && harm.counted.length > 0) {
		const most = Math.max(0, ...harmed);
		// One person can have several harms, so the people harmed lie between the largest count and
		// the sum. Below half a person the largest says nothing, so the sum bounds it from above.
		const sum = harmed.reduce((a, b) => a + b, 0);
		const several = harm.counted.length > 1;
		const below = several && most > 0 && most < 0.5 && sum >= 0.5;
		const amount = below
			? `up to ${about(sum)}`
			: counted(several ? sum : most, several ? 'at least' : 'about', most);
		const one = isOne(below ? sum : most);
		line = ofRecovered
			? `of whom ${amount} ${one ? 'lives' : 'live'} with lasting harm`
			: `${amount} ${one ? 'person here lives' : 'people here live'} with lasting harm`;
		hover.push(WHO_COUNTED);
		if (!ofRecovered) hover.push(WANED_TOO);
		harm.counted.forEach((h, k) => hover.push(`${capital(counted(harmed[k] ?? 0, 'about'))}: ${h.label}.`));
	} else if (harm) line = 'lasting harm: not counted';
	if (harm) hover.push(...harm.notes, ...(harm.footnotes ?? []));
	return {
		line,
		hover: hover.join('\n'),
		babies: baby
			? `${capital(counted(babies, 'about'))} ${isOne(babies) ? 'baby harmed or pregnancy lost' : 'babies harmed or pregnancies lost'} here`
			: null,
		babiesHover: baby ? [`${baby.label}.`, BABIES_WHERE, ...baby.notes].join('\n') : ''
	};
}
