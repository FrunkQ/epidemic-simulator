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

/** Babies are an event, counted in the hospital's city, as deaths are (6.8). */
export const BABIES_WHERE =
	'Counted in the city where the mother’s symptoms began, whose hospital took her, as deaths are.';

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
		const amount = harm.counted.length > 1 ? `at least ${about(most)}` : `about ${about(most)}`;
		line = ofRecovered
			? `of whom ${amount} live with lasting harm`
			: `${amount} people here live with lasting harm`;
		hover.push(WHO_COUNTED);
		if (!ofRecovered) hover.push(WANED_TOO);
		harm.counted.forEach((h, k) => hover.push(`About ${about(harmed[k] ?? 0)}: ${h.label}.`));
	} else if (harm) line = 'lasting harm: not counted';
	if (harm) hover.push(...harm.notes, ...(harm.footnotes ?? []));
	return {
		line,
		hover: hover.join('\n'),
		babies: baby ? `About ${about(babies)} babies harmed or pregnancies lost here` : null,
		babiesHover: baby ? [`${baby.label}.`, BABIES_WHERE, ...baby.notes].join('\n') : ''
	};
}
