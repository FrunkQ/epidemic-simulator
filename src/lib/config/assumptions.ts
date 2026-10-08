import { DISEASES } from './diseases';
import type { DiseaseConfig } from '../sim/types';
import { EU_CURATIVE_OCCUPANCY_2023, EU_OCCUPANCY_MISSING, STRAIN } from './derived';

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });
/** "A, B and C" */
function list(items: readonly string[]): string {
	return items.length < 2
		? items.join('')
		: `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
const occupancyCountries = Object.keys(EU_CURATIVE_OCCUPANCY_2023).length;
const missingCountries = list(EU_OCCUPANCY_MISSING.map((c) => countryName.of(c) ?? c));

/**
 * Plain lines for the About page (step 5): every place where no figure exists and the model
 * assumes none, or makes a simplification a reader should know about (6.2, 6.6, 6.13).
 */
export const ASSUMPTIONS = {
	fullSevereNone:
		'Where no study gives a vaccine’s protection against serious illness for people it didn’t stop catching it, the model gives them none: they are as likely to get seriously ill as anyone. This holds for a full course and an unfinished one alike, so an unfinished course differs from a full one only by its own sourced figures.',
	afterInfectionNone:
		'Having had a disease protects against serious illness the next time only for COVID-19, the one disease with a sourced figure. For every other disease, once immunity fades, the model gives no such protection.',
	strongerOfTwo:
		'Someone protected both by a vaccine and by having had the disease keeps the stronger of the two. The model doesn’t combine them, because combined (“hybrid”) figures aren’t sourced here.',
	omicronAfterInfection:
		'For Omicron, protection after infection comes from people who mostly had earlier variants and then met Omicron (BA.1), not from people who had Omicron itself.',
	strainOdds: `Full hospitals make patients more likely to die. Above ${Math.round(STRAIN.threshold * 100)}% of beds in use, the odds of death rise, up to ${STRAIN.cap} times at ${Math.round(STRAIN.capAt * 100)}% and beyond. The studies measure odds (one measures hazards, which the model treats as odds), so the model raises the odds, not the chance itself.`,
	careHomes:
		'Some older people died of COVID without going into hospital, in care homes or at home. The model counts them as needing a bed, so it slightly overstates hospital pressure for the oldest group.',
	strainSlope: `No study measures how fast the risk rises between ${Math.round(STRAIN.threshold * 100)}% and ${Math.round(STRAIN.capAt * 100)}%; the model draws a straight line between the sourced starting point and the sourced cap.`,
	englandOnly:
		'The England preset uses NHS England’s beds and how full they normally are, with UK ages. It is England’s NHS, not the whole UK, because no UK-wide figure for short-term hospital beds is published.',
	euOccupancy: `The EU figure for how full hospitals normally are is an average of the ${occupancyCountries} EU countries that report it, weighted by population. ${missingCountries} have no figure for 2023.`
} as const;

/** Vaccines whose full course has no severe figure and borrows the unfinished course's (6.2). */
export const FULL_COURSE_BORROWS_PARTIAL: string[] = Object.values(
	DISEASES as Record<string, DiseaseConfig>
).flatMap((d) =>
	(d.vaccines ?? [])
		.filter((v) => !v.full.severe && v.partial?.severe)
		.map(
			(v) =>
				`${d.name}, ${v.label}: no study gives a full course’s protection against serious illness, so the sim uses the unfinished course’s figure, because a full course includes it.`
		)
);

/** Vaccines whose unfinished course has no figure against catching the disease. */
export const PARTIAL_NO_INFECTION_FIGURE: string[] = Object.values(
	DISEASES as Record<string, DiseaseConfig>
).flatMap((d) =>
	(d.vaccines ?? [])
		.filter((v) => v.partial && !v.partial.infection)
		.map(
			(v) =>
				`${d.name}, ${v.label}: no study gives how well an unfinished course stops people catching it, so the sim gives an unfinished course no protection against catching it.`
		)
);
