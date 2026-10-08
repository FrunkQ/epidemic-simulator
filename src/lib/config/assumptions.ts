import { BEHAVIOUR } from './behaviour';
import { STRAIN } from './derived';

/**
 * Plain lines for the About page (step 5): every place where no figure exists and the model
 * assumes none, or makes a simplification a reader should know about (6.2, 6.6, 6.13).
 */
export const ASSUMPTIONS = {
	fullSevereNone:
		'Where no study gives a vaccine’s protection against serious illness for people it didn’t stop catching it, the model gives them none: they are as likely to get seriously ill as anyone.',
	partialDefault: `Where no study gives an unfinished course’s protection against serious illness, people part-way through a course who still catch it are ill ${Math.round(BEHAVIOUR.partialIllFactor.value * 100)}% as long and never seriously ill. This is a placeholder until a source is found.`,
	afterInfectionNone:
		'Having had a disease protects against serious illness the next time only for COVID-19, the one disease with a sourced figure. For every other disease, once immunity fades, the model gives no such protection.',
	strongerOfTwo:
		'Someone protected both by a vaccine and by having had the disease keeps the stronger of the two. The model doesn’t combine them, because combined (“hybrid”) figures aren’t sourced here.',
	omicronAfterInfection:
		'For Omicron, protection after infection comes from people who mostly had earlier variants and then met Omicron (BA.1), not from people who had Omicron itself.',
	strainOdds: `Full hospitals make patients more likely to die. Above ${Math.round(STRAIN.threshold * 100)}% of beds in use, the odds of death rise, up to ${STRAIN.cap} times at ${Math.round(STRAIN.capAt * 100)}% and beyond. The studies measure odds, so the model raises the odds, not the chance itself.`,
	strainSlope: `No study measures how fast the risk rises between ${Math.round(STRAIN.threshold * 100)}% and ${Math.round(STRAIN.capAt * 100)}%; the model draws a straight line between the sourced starting point and the sourced cap.`,
	englandOnly:
		'The England preset uses NHS England’s beds and how full they normally are, with UK ages. It is England’s NHS, not the whole UK, because no UK-wide figure for short-term hospital beds is published.',
	euOccupancy:
		'The EU figure for how full hospitals normally are is an average of the 22 EU countries that report it, weighted by population. Denmark, Finland, the Netherlands, Romania and Sweden have no figure for 2023.'
} as const;
