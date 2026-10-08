/** Shared layout for the SVG charts (8): plot area inside fixed margins, and nice axis ticks. */
export const MARGIN = { top: 6, right: 8, bottom: 22, left: 40 };

/** A round number at or above `max`, for the top of the y axis. */
export function niceMax(max: number): number {
	if (max <= 0) return 1;
	const step = 10 ** Math.floor(Math.log10(max));
	for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
	return 10 * step;
}

/** Short people counts for axis labels: 1,200 -> "1.2k", 150,000 -> "150k". */
export function short(n: number): string {
	if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}m`;
	if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
	return `${Math.round(n)}`;
}

/** Index of the day nearest to `day` in a sorted list. */
export function nearest(days: readonly number[], day: number): number {
	let best = 0;
	for (let i = 1; i < days.length; i++) if (Math.abs(days[i] - day) < Math.abs(days[best] - day)) best = i;
	return best;
}

/** One band of a stacked area chart, bottom first. Values are people, one per day. */
export interface Band {
	key: string;
	label: string;
	colour: string;
	values: readonly number[];
}

/** One line on a line chart. Colour plus a dash pattern, so it never relies on colour alone. */
export interface Line {
	key: string;
	label: string;
	colour: string;
	/** SVG stroke-dasharray; omit for solid. */
	dash?: string;
	values: readonly number[];
}

/** A labelled horizontal reference line (e.g. hospital capacity, the herd-immunity threshold). */
export interface Reference {
	label: string;
	value: number;
}
