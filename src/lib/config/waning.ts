import { DAYS_PER_YEAR } from './derived';

/** Half-lives this long or longer are worded in years on the card, shorter ones in days. */
export const WANING_IN_YEARS_FROM_DAYS = 2 * DAYS_PER_YEAR;

/**
 * How the card words a vaccine's waning, e.g. " just after the course, halving every 105 days";
 * empty when protection doesn't fade.
 */
export function waningWords(halfLifeDays: number | null): string {
	if (halfLifeDays === null) return '';
	const every =
		halfLifeDays < WANING_IN_YEARS_FROM_DAYS
			? `${Math.round(halfLifeDays)} days`
			: `${Math.round(halfLifeDays / DAYS_PER_YEAR)} years`;
	return ` just after the course, halving every ${every}`;
}
