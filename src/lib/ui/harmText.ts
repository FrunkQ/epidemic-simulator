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
 * Lasting harm is counted where the illness ended, as deaths are (6.8), while "recovered" counts
 * the people here now, who may have caught it elsewhere; so the line is not worded as a share of them.
 */
export const WHERE_COUNTED =
	'Counted in the city where the illness ended, as deaths are; recovered people who later move are not counted again where they go.';

export function harmText(disease: DiseaseConfig, harmed: number[], babies: number): HarmText {
	const harm = disease.lastingHarm;
	const baby = disease.babyHarm;
	let line: string | null = null;
	const hover: string[] = [];
	if (harm && harm.counted.length > 0) {
		const most = Math.max(0, ...harmed);
		line =
			harm.counted.length > 1
				? `at least ${about(most)} live with lasting harm`
				: `about ${about(most)} live with lasting harm`;
		hover.push(WHERE_COUNTED);
		harm.counted.forEach((h, k) => hover.push(`About ${about(harmed[k] ?? 0)}: ${h.label}.`));
	} else if (harm) line = 'lasting harm: not counted';
	if (harm) hover.push(...harm.notes, ...(harm.footnotes ?? []));
	return {
		line,
		hover: hover.join('\n'),
		babies: baby ? `About ${about(babies)} babies harmed or pregnancies lost` : null,
		babiesHover: baby ? [`${baby.label}.`, ...baby.notes].join('\n') : ''
	};
}
