import { ERA_DEATH_RATE } from './careBasis';
import { DEATHS_TALLY } from './deathsTally';
import { DISEASES } from './diseases';
import { fullCourseSevere } from '../sim/disease';
import type { DiseaseConfig } from '../sim/types';
import {
	EU_CURATIVE_OCCUPANCY_2023,
	EU_OCCUPANCY_MISSING,
	fmt,
	PLAGUE_ALL,
	PLAGUE_BUBONIC_TREATED_CFR,
	PLAGUE_EUROPE_SECOND_PANDEMIC_CFR,
	PLAGUE_FIRST_ANTIBIOTICS_YEAR,
	PLAGUE_INCUBATION_RANGE,
	PLAGUE_MORTALITY,
	STRAIN,
	CHIT,
	EBOLA_VACCINE,
	FLU_VACCINE,
	PERTUSSIS_VACCINE,
	SMALLPOX_VACCINE_HALF_LIFE,
	DAYS_PER_YEAR
} from './derived';

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
	vaccineStart:
		'Each vaccine starts at its protection when the course takes effect and then fades at its measured rate. Many studies report protection averaged over months, after some has already faded; starting from those would count the fading twice.',
	vaccineMeasuresIllness:
		'For measles, mumps, rubella, chickenpox, flu, whooping cough and Ebola, the studies measure how well the vaccine stops people falling ill, not catching it. Some vaccinated people catch it without symptoms and can pass it on, so these vaccines look slightly better at stopping spread in the sim than they really are.',
	fluVaccineStart: `The flu vaccine starts at about ${Math.round(FLU_VACCINE.start * 100)} in 100 just after the jab, worked out so that, fading at the measured rate, it averages the ${Math.round(FLU_VACCINE.seasonAverage * 100)} in 100 that studies find over a season. That start is higher than any figure measured directly. Those studies count people who saw a doctor, so they may overstate protection against any infection.`,
	opvType2:
		'The oral polio vaccine’s protection against catching polio was measured as no virus in the gut after a type 2 test dose; protection against types 1 and 3 may be lower. Its protection against paralysis is the figure for children in industrialised countries.',
	ebolaVaccineDeaths: `The Ebola vaccine’s protection against death rests on ${EBOLA_VACCINE.patients} vaccinated patients, ${EBOLA_VACCINE.deaths} of whom died.`,
	pertussisVaccine: `The whooping cough vaccine starts at ${Math.round(PERTUSSIS_VACCINE.full * 100)} in 100, measured over the first year and a half or so, so it is slightly low just after the course. How fast it fades (${Math.round(CHIT.decayPerYear * 1000) / 10}% a year) comes from a study funded by Sanofi Pasteur, which makes the vaccine; eight of its nine authors worked there.`,
	smallpoxVaccineWaning: `Smallpox vaccination protects for decades: half of people have lost protection against catching it after about ${Math.round(SMALLPOX_VACCINE_HALF_LIFE / DAYS_PER_YEAR)} years, and protection against dying lasts far longer. Official advice of “3 to 5 years” is how long full protection lasts.`,
	omicronAfterInfection:
		'For Omicron, protection after infection comes from people who mostly had earlier variants and then met Omicron (BA.1), not from people who had Omicron itself.',
	strainOdds: `Full hospitals make patients more likely to die. Above ${Math.round(STRAIN.threshold * 100)}% of beds in use, the odds of death rise, up to ${fmt(STRAIN.cap, 1)} times at ${Math.round(STRAIN.capAt * 100)}% and beyond. The studies measure odds (one measures hazards, which the model treats as odds), so the model raises the odds, not the chance itself.`,
	deathsTally: `Each dot stands for a group of people. ${DEATHS_TALLY} Where a dot is one person, the count is the dots that died.`,
	eraDeathRate: `${ERA_DEATH_RATE} This applies to the Black Death and 1918 flu. Their patients still fill beds and show on the hospital gauge.`,
	plagueSpread:
		'The Black Death spread between people living closely together, through the lice and fleas people carried, not through the air; the dots stand in for that closeness. In the source most onward spread happens in the last two days of illness, which the model spreads evenly over the whole illness.',
	plagueRoute:
		'How plague spread is still argued over. Dean and colleagues (2018) found that people’s own lice and fleas fitted the European epidemics best; Park and colleagues (2018) replied that a mix of rats’ fleas and spread from people’s lungs can’t be ruled out.',
	plagueDeathRate: `The Black Death’s death rate is from before antibiotics: ${PLAGUE_ALL.deaths} deaths in ${PLAGUE_ALL.cases.toLocaleString('en-GB')} hospital cases of bubonic plague, 1720 to 1945, about ${Math.round(PLAGUE_MORTALITY * 100)}%. Some of those patients got the care of their day, including an early serum, so it is if anything a little low for 1347: in the European epidemics of the Black Death’s own era it was ${fmt(PLAGUE_EUROPE_SECOND_PANDEMIC_CFR * 100)}%. Antibiotics were first used against plague in ${PLAGUE_FIRST_ANTIBIOTICS_YEAR}. Plague is curable with ordinary antibiotics today: treated, bubonic plague kills about ${fmt(PLAGUE_BUBONIC_TREATED_CFR * 100)} in 100.`,
	plagueAgeBands:
		'The Black Death’s three age bands come from ten-year age groups that don’t line up with the model’s: 15 to 19 year olds are counted with children, and the oldest band really means 50 and over. Who died turned far more on how crowded a household was than on age.',
	plagueVaccine:
		'No plague vaccine is in general use, and WHO recommends one only for people at high risk, such as laboratory staff, so the Black Death has no vaccination lesson.',
	plagueImmunity:
		'Whether surviving plague protected people from catching it again has never been measured; the model assumes the protection does not fade.',
	plagueSilent:
		'Some plague infections cause no symptoms, but no study gives how many, so the model has none and marks the figure as not yet sourced.',
	plagueHospitals:
		'In 1347 there were no hospitals in the modern sense. For the Black Death the hospital gauge means whatever care there was.',
	plagueTravel: `Plague travels here the way incubating people did. People are infected but not yet ill or contagious for ${PLAGUE_INCUBATION_RANGE[0]} to ${PLAGUE_INCUBATION_RANGE[1]} days (the model uses the middle), so someone can take a flight and carry it to another city, while on a two-week sea or road crossing they fall ill on the way and go no further. Goods, bedding, rats and ships’ fleas are not modelled, and they mattered too.`,
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
		.filter((v) => !v.full.severe && fullCourseSevere(v) !== undefined)
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
