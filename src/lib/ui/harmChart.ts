import { HOSPITAL_SCALE } from '../sim/telemetry';
import type { DiseaseConfig, RegionHistory } from '../sim/types';

/** The lasting harm chart's two views (6.17): people living with harm, or babies harmed. */
export type HarmView = 'people' | 'babies';

/**
 * Which views a disease's chart has, in order (the first is shown first). The chart shows the card's
 * own numbers, so it follows the card: none at one person per dot (the guided village), People where
 * a harm is counted, and Babies where babies are. A switch appears only with both.
 */
export function harmViews(disease: DiseaseConfig, peoplePerDot: number): HarmView[] {
	if (peoplePerDot <= 1) return [];
	const views: HarmView[] = [];
	if ((disease.lastingHarm?.counted.length ?? 0) > 0) views.push('people');
	if (disease.babyHarm) views.push('babies');
	return views;
}

/** A city's short name for a narrow caption: its first word ("Harbour City" -> "Harbour"). */
export function shortCity(name: string): string {
	return name.split(' ')[0] || name;
}

/**
 * The chart's full title, worded like the card: where immunity never fades everyone counted is
 * among the recovered; where it fades the count is of people here, some no longer shown as recovered.
 */
export function harmTitle(view: HarmView, ofRecovered: boolean): string {
	if (view === 'babies') return 'Babies harmed or pregnancies lost so far, in each city';
	return ofRecovered
		? 'Recovered people who live with lasting harm, in each city'
		: 'People here who live with lasting harm, in each city';
}

/** One city's daily series for a view, in people (history keeps thousandths of a person). */
export function harmSeries(history: RegionHistory, view: HarmView): number[] {
	return Array.from(history.series[view === 'people' ? 'lastingHarm' : 'babies'], (v) => v / HOSPITAL_SCALE);
}
