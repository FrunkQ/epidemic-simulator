import type { BabyHarmConfig, Bands, LastingHarmConfig, Sourced } from '../sim/types';
import {
	CDC_MEASLES_PREVACCINE,
	CHICKENPOX_CVS,
	EBOLA_FETAL_LOSS,
	EBOLA_FETAL_LOSS_CI,
	LONG_COVID_BANDS,
	MEASLES_LASTING_DISABILITY,
	RUBELLA_CRS,
	SMALLPOX_BLINDNESS,
	SMALLPOX_BLIND_SHARE,
	SMALLPOX_POCKMARKS,
	SMALLPOX_POCKMARKS_RANGE,
	SMALLPOX_PREGNANCY,
	SMALLPOX_PREGNANCY_LOSS,
	SNELLER_UVEITIS_YEAR_1,
	WATANABE_TWO_DOSE_OR,
	WATANABE_TWO_DOSE_STUDIES,
	ebolaExcess,
	fmt,
	polioLastingParalysis
} from './derived';

/*
 * Lasting harm (6.17): research/lasting-harm.md, as corrected by lasting-harm-verify.md. A rate is
 * per person whose illness with symptoms ends without death; lasting means still there about a
 * year later, or permanent by nature. Harms with no reliable figure are named, never guessed.
 */

/** A figure quoted in a hover, never used by the model, with its sources (6.17). */
function shown<T extends number | readonly number[]>(value: T, sources: string[]): Sourced<T> {
	return { value, sources, contextOnly: true };
}
/** Every figure the hovers quote, each linked to its source (coordinator ruling, 16 Oct). */
export const HARM_CONTEXT = {
	/** How long after illness the counted long COVID figure is measured (GBD 2022's 12-month column). */
	longCovidMonths: shown(12, ['gbd2022-long-covid']),
	/** Lugtu 2026: long COVID (shorter follow-up) in the Omicron and earlier eras, %. */
	lugtuOmicron: shown([22.8, 35.5] as const, ['lugtu2026-long-covid-eras']),
	/** Hou 2025: pooled long COVID among confirmed cases at 1-2 years, % (no comparison group). */
	houOneToTwoYears: shown(46, ['hou2025-long-covid-prevalence']),
	houWindowYears: shown([1, 2] as const, ['hou2025-long-covid-prevalence']),
	/** UKHSA Green Book: SSPE in 1 in 25,000 measles infections, 1 in 8,000 under age 2. */
	sspeOneIn: shown(25_000, ['ukhsa-greenbook-measles']),
	sspeUnderTwoOneIn: shown(8_000, ['ukhsa-greenbook-measles']),
	sspeUnderAge: shown(2, ['ukhsa-greenbook-measles']),
	/** CDC: SSPE "generally develops 7 to 10 years after a person has measles". */
	sspeYears: shown([7, 10] as const, ['cdc-measles-symptoms']),
	/** UKHSA Green Book: deafness after mumps, 1 in 3,400 to 1 in 20,000 cases. */
	mumpsDeafnessOneIn: shown([3_400, 20_000] as const, ['ukhsa-greenbook-mumps']),
	/** CDC: about 1 in 3 people in the US get shingles in their lifetime. */
	shinglesOneIn: shown(3, ['cdc-shingles-about']),
	/** Pink Book: post-polio syndrome in 25-40% of people paralysed as children, 15 to 40 years later. */
	postPolioPct: shown([25, 40] as const, ['cdc-pinkbook-polio']),
	postPolioYears: shown([15, 40] as const, ['cdc-pinkbook-polio']),
	/** Mandizadza 2024, Table 6: Ebola survivors at 12-24 months with each problem, % (no comparison group). */
	ebolaJointPain: shown(37, ['mandizadza2024-ebola-symptoms']),
	ebolaHearingLoss: shown(8, ['mandizadza2024-ebola-symptoms']),
	ebolaNumbHands: shown(12, ['mandizadza2024-ebola-symptoms']),
	ebolaNumbFeet: shown(16, ['mandizadza2024-ebola-symptoms']),
	ebolaWindowYears: shown([1, 2] as const, ['mandizadza2024-ebola-symptoms']),
	/** Ficenec 2022: hearing loss by audiometry, survivors against household or village contacts with no history of Ebola, %. */
	ficenecHearing: shown([23, 9] as const, ['ficenec2022-ebola-hearing']),
	/** Fenner 1988: the decade of Rao's Madras series (1961-69). */
	raoDecade: shown(1960, ['who-smallpox-eradication-subclinical']),
	/** UKHSA Green Book: rubella damage in up to 90% of surviving infants after infection in the first 8 to 10 weeks. */
	rubellaEarlyCeiling: shown(90, ['ukhsa-greenbook-rubella']),
	rubellaEarlyWeeks: shown([8, 10] as const, ['ukhsa-greenbook-rubella'])
};
const C = HARM_CONTEXT;

const NO_FIGURE = 'Not counted: no reliable figure yet.';
/** The same, after a label and a colon ("Pregnancies lost: not counted, as…"). */
const NO_FIGURE_AFTER = 'not counted, as there is no reliable figure yet.';
const all = (v: number): Bands => [v, v, v];
const pct = (share: number, digits = 0) => `${fmt(share * 100, digits)}%`;
const BABIES_NOT_COUNTED = `Harm to babies in pregnancy: ${NO_FIGURE_AFTER}`;

export const COVID19_LASTING_HARM: LastingHarmConfig = {
	counted: [
		{
			key: 'longCovid',
			label: 'Still unwell a year later: tiredness, memory and focus problems, or breathlessness',
			rate: { value: LONG_COVID_BANDS, sources: ['gbd2022-long-covid', 'worldbank-pop-by-sex-2025'] }
		}
	],
	fullyVaccinated: { value: WATANABE_TWO_DOSE_OR, sources: ['watanabe2023-long-covid-vaccination'] },
	notes: [
		'No study splits out older people.',
		`In ${WATANABE_TWO_DOSE_STUDIES} studies, people who were fully vaccinated were about a third less likely to have it (odds ${fmt(WATANABE_TWO_DOSE_OR, 2)} times as high; moderate certainty). One dose alone made no clear difference.`,
		`${BABIES_NOT_COUNTED} Two pooled studies disagree on stillbirth.`
	],
	context: {
		houOneToTwoYears: C.houOneToTwoYears,
		houWindowYears: C.houWindowYears,
		longCovidMonths: C.longCovidMonths
	}
};

export const OMICRON_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [
		`Long COVID a year later: not counted. The ${C.longCovidMonths.value}-month figure counted for COVID-19 comes from 2020-21 infections, before Omicron. Studies over shorter times find it less common than with earlier variants (${C.lugtuOmicron.value[0]}% against ${C.lugtuOmicron.value[1]}%, Lugtu 2026).`,
		BABIES_NOT_COUNTED
	],
	context: { lugtuOmicron: C.lugtuOmicron, longCovidMonths: C.longCovidMonths }
};

export const MEASLES_LASTING_HARM: LastingHarmConfig = {
	counted: [
		{
			key: 'brainDamage',
			label: 'Left with lasting disability after measles spread to the brain',
			rate: { value: all(MEASLES_LASTING_DISABILITY), sources: ['cdc-measles-clinical-overview'] }
		}
	],
	notes: [
		`From CDC's US figures before the vaccine (about ${fmt(CDC_MEASLES_PREVACCINE.disabledPerYear)} left disabled a year out of ${CDC_MEASLES_PREVACCINE.infectedPerYear[0] / 1e6} to ${CDC_MEASLES_PREVACCINE.infectedPerYear[1] / 1e6} million infected), read per infection because per reported case it would be higher than the encephalitis rate itself.`,
		`Blindness: more likely in children who are malnourished, especially those short of vitamin A (WHO measles fact sheet). ${NO_FIGURE}`,
		BABIES_NOT_COUNTED
	],
	footnotes: [
		`Not counted here: about 1 in ${fmt(C.sspeOneIn.value)} people who had measles (1 in ${fmt(C.sspeUnderTwoOneIn.value)} infected under age ${C.sspeUnderAge.value}) die of a brain disease ${C.sspeYears.value[0]}-${C.sspeYears.value[1]} years later (UKHSA, CDC).`
	],
	context: {
		sspeOneIn: C.sspeOneIn,
		sspeUnderTwoOneIn: C.sspeUnderTwoOneIn,
		sspeUnderAge: C.sspeUnderAge,
		sspeYears: C.sspeYears
	}
};

export const MUMPS_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [
		`Deafness: hearing loss is usually temporary but may be permanent (CDC). Estimates of deafness range from 1 in ${fmt(C.mumpsDeafnessOneIn.value[0])} cases to 1 in ${fmt(C.mumpsDeafnessOneIn.value[1])} (UKHSA). Not counted: no figure for permanent deafness.`,
		'Sterility: no study has shown that men whose testicles swelled with mumps are more likely to be sterile (CDC). Reduced fertility has rarely been reported after both testicles swell (UKHSA).',
		BABIES_NOT_COUNTED
	],
	context: { mumpsDeafnessOneIn: C.mumpsDeafnessOneIn }
};

export const RUBELLA_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: ['None in the person ill: joint pain can last up to a month; long-term arthritis is rare.']
};

export const RUBELLA_BABY_HARM: BabyHarmConfig = {
	label: 'Babies born deaf, blind or with heart defects because their mother caught rubella in pregnancy',
	risk: { value: RUBELLA_CRS.risk, sources: ['cdc-mmwr-2001-rubella'] },
	weeks: { value: RUBELLA_CRS.weeks, sources: ['cdc-mmwr-2001-rubella'] },
	perInfection: true,
	notes: [
		`${pct(RUBELLA_CRS.risk)} of babies whose mother caught it in the first ${RUBELLA_CRS.weeks} weeks (CDC), up to ${C.rubellaEarlyCeiling.value}% in the first ${C.rubellaEarlyWeeks.value[0]} to ${C.rubellaEarlyWeeks.value[1]} weeks (UKHSA), and about none later. Silent infections count too.`,
		`Pregnancies lost: ${NO_FIGURE_AFTER}`
	],
	context: { rubellaEarlyCeiling: C.rubellaEarlyCeiling, rubellaEarlyWeeks: C.rubellaEarlyWeeks }
};

export const CHICKENPOX_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [`Scarring, and brain damage after the infection reaches the brain: ${NO_FIGURE_AFTER}`],
	footnotes: [
		`The virus stays in the body; about 1 in ${C.shinglesOneIn.value} people get shingles later in life (CDC).`
	],
	context: { shinglesOneIn: C.shinglesOneIn }
};

export const CHICKENPOX_BABY_HARM: BabyHarmConfig = {
	label: 'Babies born with damaged limbs, eyes or brain because their mother caught chickenpox in pregnancy',
	risk: { value: CHICKENPOX_CVS, sources: ['ahn2016-congenital-varicella'] },
	notes: [`${pct(CHICKENPOX_CVS, 2)} of babies whose mother caught it at any time in pregnancy.`]
};

export const PERTUSSIS_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [
		'Some babies treated in hospital get encephalopathy, a disease of the brain (CDC). Not counted: no figure for how many are left with lasting damage.'
	]
};

export const FLU_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [`Brain damage in children after flu affects the brain: ${NO_FIGURE_AFTER}`]
};

export const FLU1918_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [
		'A link to sleeping sickness (encephalitis lethargica) is refuted by most studies.',
		BABIES_NOT_COUNTED
	]
};

/** Polio's red dot is meningitis or paralysis only, so its rate is per surviving red dot (verify question 1). */
export function polioLastingHarm(asymptomatic: Sourced, mortality: Sourced): LastingHarmConfig {
	const { rate, whoOnly } = polioLastingParalysis(1 - asymptomatic.value, mortality.value);
	return {
		counted: [
			{
				key: 'paralysis',
				label: `Left with lasting paralysis, usually of the legs. WHO calls polio paralysis irreversible, which would make it about ${pct(whoOnly)}`,
				rate: { value: all(rate), sources: ['who-polio-factsheet-2025', 'cdc-pinkbook-polio'] }
			}
		],
		notes: [BABIES_NOT_COUNTED],
		footnotes: [
			`${C.postPolioYears.value[0]} to ${C.postPolioYears.value[1]} years later, ${C.postPolioPct.value[0]}-${C.postPolioPct.value[1]}% of people paralysed as children develop new weakness or pain (CDC).`
		],
		context: { postPolioPct: C.postPolioPct, postPolioYears: C.postPolioYears }
	};
}

export const SMALLPOX_LASTING_HARM: LastingHarmConfig = {
	counted: [
		{
			key: 'pockmarks',
			label: `Left with pockmark scars (depressed scars) on the face (${pct(SMALLPOX_POCKMARKS_RANGE[0])} to ${pct(SMALLPOX_POCKMARKS_RANGE[1])} of survivors; the middle is used)`,
			rate: { value: all(SMALLPOX_POCKMARKS), sources: ['who-smallpox-eradication-subclinical'] }
		},
		{
			key: 'blindness',
			label: `Lost the sight of one or both eyes (both: ${SMALLPOX_BLINDNESS.bothEyes} in ${fmt(SMALLPOX_BLINDNESS.survivors)}). Measured in Madras, India, in the ${C.raoDecade.value}s; blindness was mostly in people who were poorly nourished`,
			rate: { value: all(SMALLPOX_BLIND_SHARE), sources: ['who-smallpox-eradication-subclinical'] }
		}
	],
	notes: [`Bone and joint damage in children, and male infertility: ${NO_FIGURE_AFTER}`],
	context: { raoDecade: C.raoDecade }
};

export const SMALLPOX_BABY_HARM: BabyHarmConfig = {
	label: 'Pregnancies lost',
	risk: {
		value: SMALLPOX_PREGNANCY_LOSS,
		sources: ['who-smallpox-eradication-subclinical']
	},
	notes: [
		`At least ${SMALLPOX_PREGNANCY.lost} of ${SMALLPOX_PREGNANCY.women} pregnant women ill with smallpox lost the baby or died before giving birth (Madras).`
	]
};

const SNELLER = ['sneller2019-ebola-sequelae'];
export const EBOLA_LASTING_HARM: LastingHarmConfig = {
	counted: [
		{
			key: 'jointPain',
			label: 'Joint pain',
			rate: { value: all(ebolaExcess('jointPain')), sources: SNELLER }
		},
		{
			key: 'memoryLoss',
			label: 'Memory loss',
			rate: { value: all(ebolaExcess('memoryLoss')), sources: SNELLER }
		},
		{
			key: 'uveitis',
			label: `Eye inflammation (uveitis). By the next year’s check-up, the gap had grown to ${fmt(SNELLER_UVEITIS_YEAR_1[0] - SNELLER_UVEITIS_YEAR_1[1], 1)} in every 100`,
			rate: { value: all(ebolaExcess('uveitis')), sources: SNELLER }
		},
		{
			key: 'musclePain',
			label: 'Muscle pain',
			rate: { value: all(ebolaExcess('musclePain')), sources: SNELLER }
		},
		{
			key: 'tiredness',
			label: 'Tiredness',
			rate: { value: all(ebolaExcess('tiredness')), sources: SNELLER }
		},
		{ key: 'headache', label: 'Headache', rate: { value: all(ebolaExcess('headache')), sources: SNELLER } }
	],
	notes: [
		`A year on, counting only the extra over people who never had Ebola. Measured among all survivors, joint pain is ${C.ebolaJointPain.value}% at ${C.ebolaWindowYears.value[0]}-${C.ebolaWindowYears.value[1]} years.`,
		`Hearing loss (${C.ebolaHearingLoss.value}%) and numb hands (${C.ebolaNumbHands.value}%) or feet (${C.ebolaNumbFeet.value}%) at ${C.ebolaWindowYears.value[0]}-${C.ebolaWindowYears.value[1]} years: not counted. One study found hearing loss in ${C.ficenecHearing.value[0]}% of survivors against ${C.ficenecHearing.value[1]}% of people from their household or village (Ficenec 2022), but those people were picked for having no history of Ebola; the study reports no test for past infection.`
	],
	context: {
		ebolaJointPain: C.ebolaJointPain,
		ebolaHearingLoss: C.ebolaHearingLoss,
		ebolaNumbHands: C.ebolaNumbHands,
		ebolaNumbFeet: C.ebolaNumbFeet,
		ebolaWindowYears: C.ebolaWindowYears,
		ficenecHearing: C.ficenecHearing
	}
};

export const EBOLA_BABY_HARM: BabyHarmConfig = {
	label: 'Pregnancies lost',
	risk: { value: EBOLA_FETAL_LOSS, sources: ['kayem2021-ebola-pregnancy'] },
	notes: [
		`About ${pct(EBOLA_FETAL_LOSS)} of pregnancies are lost when the mother has Ebola. The studies differ widely: the true figure is probably between ${pct(EBOLA_FETAL_LOSS_CI[0])} and ${pct(EBOLA_FETAL_LOSS_CI[1])}.`
	]
};

export const NOT_COUNTED_HARM: LastingHarmConfig = { counted: [], notes: [NO_FIGURE] };
