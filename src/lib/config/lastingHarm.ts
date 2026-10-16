import type { BabyHarmConfig, Bands, LastingHarmConfig, Sourced } from '../sim/types';
import {
	CDC_MEASLES_PREVACCINE,
	CHICKENPOX_CVS,
	EBOLA_FETAL_LOSS,
	LONG_COVID_BANDS,
	MEASLES_LASTING_DISABILITY,
	RUBELLA_CRS,
	SMALLPOX_BLINDNESS,
	SMALLPOX_BLIND_SHARE,
	SMALLPOX_POCKMARKS,
	SMALLPOX_POCKMARKS_RANGE,
	SMALLPOX_PREGNANCY,
	SNELLER_UVEITIS_YEAR_1,
	WATANABE_TWO_DOSE_OR,
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
	/** Lugtu 2026: long COVID (shorter follow-up) in the Omicron and earlier eras, %. */
	lugtuOmicron: shown([22.8, 35.5] as const, ['lugtu2026-long-covid-eras']),
	/** Hou 2025: pooled long COVID among confirmed cases at 1-2 years, % (no comparison group). */
	houOneToTwoYears: shown(46, ['hou2025-long-covid-prevalence']),
	/** UKHSA Green Book: SSPE in 1 in 25,000 measles infections, 1 in 8,000 under age 2. */
	sspeOneIn: shown(25_000, ['ukhsa-greenbook-measles']),
	sspeUnderTwoOneIn: shown(8_000, ['ukhsa-greenbook-measles']),
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
	/** UKHSA Green Book: rubella damage in up to 90% of surviving infants after infection in weeks 0-10. */
	rubellaEarlyCeiling: shown(90, ['ukhsa-greenbook-rubella'])
};
const C = HARM_CONTEXT;

const NO_FIGURE = 'Not counted: no reliable figure yet.';
const all = (v: number): Bands => [v, v, v];
const pct = (share: number, digits = 0) => `${fmt(share * 100, digits)}%`;
const BABIES_NOT_COUNTED = `Harm to babies in pregnancy: ${NO_FIGURE.toLowerCase()}`;

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
		'Older people probably fare worse, but no study splits them out.',
		`Vaccination lowers this by about ${pct(1 - WATANABE_TWO_DOSE_OR)} (moderate certainty).`,
		`${BABIES_NOT_COUNTED} Two pooled studies disagree on stillbirth.`
	],
	context: { houOneToTwoYears: C.houOneToTwoYears }
};

export const OMICRON_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [
		`Long COVID a year later: not counted. No study has measured it at 12 months for Omicron yet. Studies over shorter times find it less common than with earlier variants (${C.lugtuOmicron.value[0]}% against ${C.lugtuOmicron.value[1]}%, Lugtu 2026).`,
		BABIES_NOT_COUNTED
	],
	context: { lugtuOmicron: C.lugtuOmicron }
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
		`Blindness: mostly in poorly nourished children who lack vitamin A; close to none where children are well fed. ${NO_FIGURE}`,
		BABIES_NOT_COUNTED
	],
	footnotes: [
		`Not counted here: about 1 in ${fmt(C.sspeOneIn.value)} people who had measles (1 in ${fmt(C.sspeUnderTwoOneIn.value)} infected under age 2) die of a brain disease ${C.sspeYears.value[0]}-${C.sspeYears.value[1]} years later (UKHSA, CDC).`
	],
	context: { sspeOneIn: C.sspeOneIn, sspeUnderTwoOneIn: C.sspeUnderTwoOneIn, sspeYears: C.sspeYears }
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
		`${pct(RUBELLA_CRS.risk)} of babies whose mother caught it in the first ${RUBELLA_CRS.weeks} weeks (CDC), up to ${C.rubellaEarlyCeiling.value}% in the first 10 weeks (UKHSA), and about none later. Silent infections count too.`,
		`Pregnancies lost: ${NO_FIGURE.toLowerCase()}`
	],
	context: { rubellaEarlyCeiling: C.rubellaEarlyCeiling }
};

export const CHICKENPOX_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [`Scarring, and brain damage after the infection reaches the brain: ${NO_FIGURE.toLowerCase()}`],
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
	notes: [`Some babies are left with brain damage. ${NO_FIGURE}`]
};

export const FLU_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: [`Brain damage in children after flu affects the brain: ${NO_FIGURE.toLowerCase()}`]
};

export const FLU1918_LASTING_HARM: LastingHarmConfig = {
	counted: [],
	notes: ['A link to sleeping sickness (encephalitis lethargica) is refuted by most studies.']
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
			label: `Left with deep pockmark scars on the face (${pct(SMALLPOX_POCKMARKS_RANGE[0])} to ${pct(SMALLPOX_POCKMARKS_RANGE[1])} of survivors; the middle is used)`,
			rate: { value: all(SMALLPOX_POCKMARKS), sources: ['who-smallpox-eradication-subclinical'] }
		},
		{
			key: 'blindness',
			label: `Lost the sight of one or both eyes (both: ${SMALLPOX_BLINDNESS.bothEyes} in ${fmt(SMALLPOX_BLINDNESS.survivors)}). Measured in Madras, India, in the 1960s and 70s; blindness was mostly in people who were poorly nourished`,
			rate: { value: all(SMALLPOX_BLIND_SHARE), sources: ['who-smallpox-eradication-subclinical'] }
		}
	],
	notes: [`Bone and joint damage in children, and male infertility: ${NO_FIGURE.toLowerCase()}`]
};

export const SMALLPOX_BABY_HARM: BabyHarmConfig = {
	label: 'Pregnancies lost',
	risk: {
		value: SMALLPOX_PREGNANCY.lost / SMALLPOX_PREGNANCY.women,
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
			label: `Eye inflammation (uveitis), ${fmt(SNELLER_UVEITIS_YEAR_1[0] - SNELLER_UVEITIS_YEAR_1[1], 1)} points more a year later`,
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
		`A year on, counting only the extra over people who never had Ebola. Measured among all survivors, joint pain is ${C.ebolaJointPain.value}% at 1-2 years.`,
		`Hearing loss (${C.ebolaHearingLoss.value}%) and numb hands (${C.ebolaNumbHands.value}%) or feet (${C.ebolaNumbFeet.value}%) at 1-2 years: not counted, since no study compares them with people who never had Ebola.`
	],
	context: {
		ebolaJointPain: C.ebolaJointPain,
		ebolaHearingLoss: C.ebolaHearingLoss,
		ebolaNumbHands: C.ebolaNumbHands,
		ebolaNumbFeet: C.ebolaNumbFeet
	}
};

export const EBOLA_BABY_HARM: BabyHarmConfig = {
	label: 'Pregnancies lost',
	risk: { value: EBOLA_FETAL_LOSS, sources: ['kayem2021-ebola-pregnancy'] },
	notes: [`About ${pct(EBOLA_FETAL_LOSS)} of pregnancies are lost when the mother has Ebola.`]
};

export const NOT_COUNTED_HARM: LastingHarmConfig = { counted: [], notes: [NO_FIGURE] };
