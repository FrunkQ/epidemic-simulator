import {
	ALL_VACCINE_ANAPHYLAXIS_PER_MILLION,
	BOBROVITZ,
	BOLORMAA,
	CHIT,
	CHO,
	CHOI,
	COVID_INFECTION_HALF_LIFE_MONTHS,
	DAYS_PER_MONTH,
	DAYS_PER_YEAR,
	DTAP_SERIOUS_DOSES,
	FAMULARE,
	FEIKIN,
	FLU_SERIOUS,
	IPV_ONE_DOSE,
	IPV_ONE_DOSE_SEROCONVERSION,
	LANE,
	LEWNARD_HALF_LIFE_YEARS,
	MCGIRR,
	MENEGALE,
	MMR_SEIZURE_DOSES,
	MMR_SERIOUS_PER_100K,
	MORO,
	MRNA_SERIOUS,
	OMICRON_VACCINE,
	OPV_RISK,
	OPV_SHEDDING_OR,
	OSTER,
	RANJEVA_HALF_LIFE_YEARS,
	SMALLPOX_VACCINE_HALF_LIFE,
	SMALLPOX_VACCINE_YEARS,
	STEIN_40_WEEKS,
	STRAIN,
	EU_CURATIVE_BEDS_PER_100K,
	EU_CURATIVE_BEDS_PER_1000,
	EU_CURATIVE_OCCUPANCY,
	EU_CURATIVE_OCCUPANCY_UNWEIGHTED,
	EU_OCCUPANCY_COVERED_PEOPLE,
	EU_OCCUPANCY_MISSING,
	EU27_POPULATION_2023,
	EU_CURATIVE_OCCUPANCY_2023,
	ENGLAND_ACUTE_BEDS_PER_1000,
	ENGLAND_POPULATION_MID_2023,
	KH03_Q2_2023,
	WENDELBOE_HALF_LIFE,
	WENDELBOE_YEARS,
	WORLD_BANK_AGES_2025,
	YOUNG,
	fmt,
	EBOLA_VACCINE,
	EICHNER_PROTECTED_CASES,
	FLU_VACCINE,
	LEWNARD_TAKE,
	COCHRANE_MMR,
	MARIN,
	BOLORMAA_ONE_DOSE_YEAR1,
	CHICKENPOX_PARTIAL_SEVERE,
	MOHAMMED_AVERAGED,
	OMICRON_ONE_DOSE,
	OPV_INTESTINAL_IMMUNITY,
	PERTUSSIS_VACCINE,
	SMALLPOX_PROTECTION_MEDIAN_YEARS,
	SMALLPOX_SEVERE,
	SMALLPOX_START,
	KUGELER_PRE_ANTIBIOTIC,
	PLAGUE_ALL,
	PLAGUE_BUBONIC_TREATED_CFR,
	PLAGUE_EP_R0S,
	PLAGUE_EUROPE_SECOND_PANDEMIC_CFR,
	PLAGUE_FIRST_ANTIBIOTICS_YEAR,
	PLAGUE_ILL_DAYS,
	PLAGUE_INCUBATION_DAYS,
	PLAGUE_MORTALITY,
	PLAGUE_MORTALITY_BANDS,
	PLAGUE_R0,
	PLAGUE_BAND_CUTS,
	PLAGUE_INCUBATION_RANGE,
	plagueR0Extremes,
	per100kFromPerMillion,
	BOURNER_HIGH_EFFICACY,
	KUGELER_2020_TREATED,
	FLECK_DERDERIAN_UNTREATED_CASES,
	PERTUSSIS_TRIALS,
	HARTLEY_2023
} from './derived';
import { breakthroughSevereProtection, stackedProtection as stacked } from './vaccines';

/**
 * Every source behind a number in config. The About page is generated from this list.
 * Each entry is checked by a separate verification pass before it is used (verified.ok).
 */
export interface Citation {
	id: string;
	authors: string;
	title: string;
	journal: string;
	year: number;
	/** How strong the evidence is; the About page and evidence table sort by this. */
	evidence: Evidence;
	/** Required when a number's best source is only a review or one study: why nothing stronger is used. */
	noReviewReason?: string;
	/** The public body behind an official source (required when evidence is 'official'). */
	publisher?: string;
	/** DOI (preferred) or a link to the original publisher. */
	doi?: string;
	url?: string;
	/** A copy elsewhere, only when the original won't open; the About page always links the original. */
	mirrorUrl?: string;
	/** Which config numbers this source backs, e.g. "measles.r0". */
	usedFor: string[];
	/** The exact sentence or table value the number comes from. */
	quote: string;
	/** Page, table or figure. */
	location: string;
	/** Why this source and not another. */
	why: string;
	/** Population, country and era the data comes from. */
	context: string;
	/** `note` records any caveat the verification pass found (e.g. which copy it could open). */
	verified: { by: string; on: string; ok: boolean; note?: string };
}

/**
 * Strongest first (Alex: meta-analyses carry the most weight). Only peer-reviewed papers and
 * named public bodies are allowed; preprints and other websites are not.
 */
export const EVIDENCE_RANK = ['meta-analysis', 'systematic-review', 'official', 'review', 'study'] as const;
export type Evidence = (typeof EVIDENCE_RANK)[number];

/** Public bodies whose own pages count as official sources. */
export const OFFICIAL_PUBLISHERS = [
	'WHO',
	'CDC',
	'ECDC',
	'Eurostat',
	'NHS England',
	'World Bank',
	'UN',
	'ONS'
] as const;

export const CITATIONS: Citation[] = [
	{
		id: 'neupane2024-surge-sr',
		authors:
			'Neupane M, De Jonge N, Angelo S, Sarzynski SH, Sun J, Rochwerg BN, Hick JL, Mitchell SH, Warner SR, Mancera AG, Cooper D, Kadri SS',
		title: 'Measures and Impact of Caseload Surge During the COVID-19 Pandemic: A Systematic Review',
		journal: 'Critical Care Medicine',
		year: 2024,
		evidence: 'systematic-review',
		doi: '10.1097/CCM.0000000000006263',
		usedFor: ['behaviour.strainThreshold', 'behaviour.strainMaxMultiplier', 'behaviour.strainSlope'],
		quote:
			'32 of 39 studies (82%) reported detrimental adjusted odds/hazard ratio for caseload surge-mortality outcomes, reporting point estimates of up to four-fold increased risk of mortality. Markedly variable surge strain measures precluded meta-analysis.',
		location: 'Abstract, Data Synthesis and Conclusions (52(7):1097-1112)',
		why: `The strongest evidence on hospital strain and death in COVID-19. It finds strain raises deaths in most studies, with effects up to four-fold, so a cap of ${fmt(STRAIN.cap, 1)} sits inside the range, but it pools no figure; the values come from the cohort studies it reviews.`,
		context: 'COVID-19 era',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Abstract: 32 of 39 studies (82%) detrimental; variable surge measures precluded meta-analysis; 52(7):1097-1112; 12 authors; not retracted.'
		}
	},
	{
		id: 'wilde2021-icu-occupancy',
		authors:
			'Wilde H, Mellan T, Hawryluk I, Dennis JM, Denaxas S, Pagel C, Duncan A, Bhatt S, Flaxman S, Mateen BA, Vollmer SJ',
		title:
			'The association between mechanical ventilator compatible bed occupancy and mortality risk in intensive care patients with COVID-19: a national retrospective cohort study',
		journal: 'BMC Medicine',
		year: 2021,
		evidence: 'study',
		noReviewReason:
			'Two systematic reviews (Neupane 2024 for COVID-19, Eriksson 2017 before it) find higher deaths under hospital strain in most studies, but both say the strain measures differ too much to pool, so neither gives a figure. The numbers come from the largest cohort studies.',
		doi: '10.1186/s12916-021-02096-0',
		usedFor: ['behaviour.strainThreshold', 'behaviour.strainSlope'],
		quote:
			'Adjusting for patient-level factors, mortality was higher for admissions during periods of high occupancy (> 85% occupancy versus the baseline of 45 to 85%) [OR 1.23 (95% posterior credible interval (PCI): 1.08 to 1.39)].',
		location:
			'Abstract, Results (BMC Med 19:213); the Results section gives the same OR with 95% PCI 1.05-1.43',
		why: `National cohort with an occupancy cut-off: no extra deaths up to ${fmt(STRAIN.threshold * 100)}% occupancy, odds of death x${STRAIN.wildeOddsRatio} above it, so the strain threshold is ${STRAIN.threshold}. The slope is worked out: rising from 1 at ${fmt(STRAIN.threshold * 100)}% to the cap of ${STRAIN.cap} at ${fmt(STRAIN.capAt * 100)}% gives ${fmt(STRAIN.slope)} per unit of pressure, an average multiplier of ${fmt(STRAIN.meanOver85To100, 2)} across ${fmt(STRAIN.threshold * 100)}-100%, close to Wilde's ${STRAIN.wildeOddsRatio}. The multiplier is applied to the odds of death, as an odds ratio measures.`,
		context: 'COVID-19 era',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'PMC8404408 full text: abstract OR 1.23 (95% PCI 1.08-1.39) >85% vs 45-85%; Results text gives 1.05-1.43; 11 authors confirmed; not retracted.'
		}
	},
	{
		id: 'kadri2021-caseload-surge',
		authors:
			'Kadri SS, Sun J, Lawandi A, Strich JR, Busch LM, Keller M, Babiker A, Yek C, Malik S, Krack J, Dekker JP, Spaulding AB, Ricotta E, Powers JH 3rd, Rhee C, Klompas M, Athale J, Boehmer TK, Gundlapalli AV, Bentley W, Datta SD, Danner RL, Demirkale CY, Warner S',
		title:
			'Association Between Caseload Surge and COVID-19 Survival in 558 U.S. Hospitals, March to August 2020',
		journal: 'Annals of Internal Medicine',
		year: 2021,
		evidence: 'study',
		noReviewReason:
			'Two systematic reviews (Neupane 2024 for COVID-19, Eriksson 2017 before it) find higher deaths under hospital strain in most studies, but both say the strain measures differ too much to pool, so neither gives a figure. The numbers come from the largest cohort studies.',
		doi: '10.7326/M21-1213',
		usedFor: ['behaviour.strainMaxMultiplier', 'behaviour.strainSlope'],
		quote:
			'compared with nonsurging (<50th surge index percentile) hospital-months, aORs in the 50th to 75th, 75th to 90th, 90th to 95th, 95th to 99th, and greater than 99th percentiles were 1.11 (95% CI, 1.01 to 1.23), 1.24 (CI, 1.12 to 1.38), 1.42 (CI, 1.27 to 1.60), 1.59 (CI, 1.41 to 1.80), and 2.00 (CI, 1.69 to 2.38), respectively.',
		location: 'Abstract, Results (174(9):1240-1251)',
		why: `The largest multi-hospital study: in the most extreme surge months the odds of death were about ${STRAIN.kadriOddsRatio} times those of normal months, so the cap is ${fmt(STRAIN.cap, 1)}. The steady rise across the surge bands supports a ramp rather than a step. Its outcome is death in hospital or discharge to hospice.`,
		context: 'COVID-19 era',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Abstract and Results: aOR 2.00 (95% CI 1.69-2.38) >99th vs <50th surge-index percentile; 174(9):1240-51; not retracted.'
		}
	},
	{
		id: 'bravata2021-va-icu-strain',
		authors:
			'Bravata DM, Perkins AJ, Myers LJ, Arling G, Zhang Y, Zillich AJ, Reese L, Dysangco A, Agarwal R, Myers J, Austin C, Sexson A, Leonard SJ, Dev S, Keyhani S',
		title:
			'Association of Intensive Care Unit Patient Load and Demand With Mortality Rates in US Department of Veterans Affairs Hospitals During the COVID-19 Pandemic',
		journal: 'JAMA Network Open',
		year: 2021,
		evidence: 'study',
		noReviewReason:
			'Two systematic reviews (Neupane 2024 for COVID-19, Eriksson 2017 before it) find higher deaths under hospital strain in most studies, but both say the strain measures differ too much to pool, so neither gives a figure. The numbers come from the largest cohort studies.',
		doi: '10.1001/jamanetworkopen.2020.34266',
		usedFor: ['behaviour.strainThreshold', 'behaviour.strainMaxMultiplier'],
		quote:
			'1.67 (95% CI, 1.08-2.60) when COVID-19 ICU load was greater than 75% to 100%, and 2.35 (95% CI, 1.25-4.39) when COVID-19 ICU load was 100% or more (P = .049)',
		location:
			'Results, ICU load paragraph; Table 3 (reference load 25% or less). JAMA Netw Open 4(1):e2034266',
		why: `Load is measured against the fixed pre-pandemic ICU beds, like the model's pressure. At 100% or more the hazard of death was ${STRAIN.bravataHazardRatio} times that at low load, in line with a cap of ${fmt(STRAIN.cap, 1)}; lower bands were not clearly raised, in line with no extra risk below a high threshold. Hazard ratios are treated as odds ratios here.`,
		context: 'COVID-19 era',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'PMC7816100 Results/Table 3: aHR load >75-100% 1.67 (1.08-2.60), >=100% 2.35 (1.25-4.39), demand >75-100% 1.94 (1.46-2.59); no correction found. doi.org redirect rate-limited; DOI confirmed from the PMC record.'
		}
	},
	{
		id: 'eurostat-curative-beds-2023',
		authors: 'Eurostat',
		title: 'Hospital beds by function and type of care (hlth_rs_bds1)',
		journal: 'Eurostat database',
		year: 2026,
		evidence: 'official',
		publisher: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/hlth_rs_bds1?format=JSON&lang=EN&geo=EU27_2020&facility=HBEDT_CUR&unit=P_HTHAB',
		usedFor: ['behaviour.hospitalBedsPerThousand'],
		quote: 'EU27_2020, HBEDT_CUR (Curative care beds in hospitals (HP.1)), SOM, P_HTHAB: 2023 330.93',
		location: 'hlth_rs_bds1, geo EU27_2020, facility HBEDT_CUR, hlthcare SOM, unit P_HTHAB, 2023',
		why: `Official EU-27 figure for curative (short-term) care beds, the same bed type as the occupancy figure: ${EU_CURATIVE_BEDS_PER_100K} per 100,000 is ${fmt(EU_CURATIVE_BEDS_PER_1000, 2)} per 1,000. Outbreak patients use these beds, and the strain threshold is an acute-occupancy figure.`,
		context: 'EU-27, 2023. Curative care beds, somatic care only (no long-term or psychiatric beds).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'hlth_rs_bds1 EU27_2020 HBEDT_CUR SOM P_HTHAB 2023 = 330.93 (TSV and JSON agree).'
		}
	},
	{
		id: 'eurostat-curative-occupancy-2023',
		authors: 'Eurostat',
		title:
			'Inpatient curative care bed occupancy rate by type of care (hlth_co_bedoc); Population on 1 January (tps00001)',
		journal: 'Eurostat database',
		year: 2026,
		evidence: 'official',
		publisher: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/hlth_co_bedoc?format=JSON&lang=EN&hlthcare=TOTAL&time=2023',
		usedFor: ['behaviour.spareBedShare'],
		quote:
			'hlthcare=TOTAL, unit=PC, 2023: AT 69.18, BE 62.53, BG 57.20, CY 60.40, CZ 62.47, DE 72.00, EE 70.80, EL 51.74, ES 72.54, FR 74.27, HR 64.32, HU 57.59, IE 86.96, IT 75.50, LT 62.85, LU 78.28, LV 69.20, MT 70.63, PL 68.80, PT 83.89, SI 62.31, SK 61.20; population 1 Jan 2023 (tps00001): AT 9104772, BE 11742796, BG 6447710, CY 949084, CZ 10827529, DE 83118501, EE 1365884, EL 10401868, ES 48085361, FR 68436003, HR 3850894, HU 9599744, IE 5271395, IT 58997201, LT 2857279, LU 660809, LV 1895239, MT 542051, PL 36753736, PT 10929704, SI 2116972, SK 5428792',
		location:
			'hlth_co_bedoc, 2023, 22 EU countries; tps00001 at https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tps00001?format=JSON&lang=EN&time=2023',
		why: `Worked out: Eurostat publishes no EU figure for this indicator, so the default is the population-weighted mean of the ${Object.keys(EU_CURATIVE_OCCUPANCY_2023).length} countries with a 2023 value, ${fmt(EU_CURATIVE_OCCUPANCY * 100, 2)}% (unweighted ${fmt(EU_CURATIVE_OCCUPANCY_UNWEIGHTED * 100, 2)}%), leaving ${fmt((1 - EU_CURATIVE_OCCUPANCY) * 100, 1)}% of beds free. ${EU_OCCUPANCY_MISSING.join(', ')} have no 2023 value; the countries used hold ${fmt((EU_OCCUPANCY_COVERED_PEOPLE / EU27_POPULATION_2023) * 100, 1)}% of EU people.`,
		context:
			'EU-27, 2023, curative care beds. Flags: BG, LU, PL break in series; CY, FR, LV definition differs; MT, SI estimated; LV population break in series.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'hlth_co_bedoc 2023 TOTAL PC: 22 EU values, no EU aggregate; tps00001 2023 populations; weighted mean 71.0884%, unweighted 67.9391% (TSV and JSON agree).'
		}
	},
	{
		id: 'nhs-england-kh03-q2-2023-24',
		authors: 'NHS England',
		title:
			'Bed Availability and Occupancy - Quarter ending 30th September 2023 (KH03 Statistical Press Notice)',
		journal: 'NHS England Official Statistics',
		year: 2023,
		evidence: 'official',
		publisher: 'NHS England',
		url: 'https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2023/11/KH03-Q2-2023-24-Statistical-Press-Notice-FINAL.pdf',
		usedFor: ['englandPolicy.hospitalBedsPerThousand', 'englandPolicy.spareBedShare'],
		quote:
			'The average daily number of general and acute beds open overnight was 102,922 in Quarter 2 2023/24 compared with 103,818 in Quarter 1 2023/24 and 102,305 in Quarter 2 2022/23. The average occupancy rate for general and acute beds open overnight was 89.7% in Quarter 2 2023/24 compared with 90.6% in Quarter 1 2023/24 and 90.1% in Quarter 2 2022/23.',
		location: 'Main findings (published 23 Nov 2023)',
		why: `Worked out: ${fmt(KH03_Q2_2023.beds)} general and acute beds over England's ${fmt(ENGLAND_POPULATION_MID_2023)} people is ${fmt(ENGLAND_ACUTE_BEDS_PER_1000, 2)} per 1,000; ${KH03_Q2_2023.occupancyPct}% occupied leaves ${fmt(100 - KH03_Q2_2023.occupancyPct, 1)}% free. Eurostat has no UK curative beds, so this is England's NHS, not the UK.`,
		context:
			'England only (not the UK), NHS beds only, general and acute (no maternity or mental illness beds), July to September 2023.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'KH03 Q2 2023/24 press notice: G&A beds open overnight 102,922; occupancy 89.7%.'
		}
	},
	{
		id: 'ons-england-pop-mid2023',
		authors: 'Office for National Statistics',
		title: 'Population estimates for the UK, England, Wales, Scotland and Northern Ireland: mid-2023',
		journal: 'ONS Statistical Bulletin',
		year: 2024,
		evidence: 'official',
		publisher: 'ONS',
		url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/bulletins/annualmidyearpopulationestimates/mid2023',
		usedFor: ['englandPolicy.hospitalBedsPerThousand'],
		quote: 'Table 1, Population 2023, England: 57,690,300',
		location: 'Table 1 (released 8 Oct 2024)',
		why: 'The population the KH03 England bed count is divided by, for the same year.',
		context: 'England, mid-2023, rounded to the nearest 100.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'ONS mid-2023 bulletin Table 1: England 57,690,300.'
		}
	},
	{
		id: 'guerra2017-measles-r0',
		authors: 'Guerra FM, Bolotin S, Lim G, Heffernan J, Deeks SL, Li Y, Crowcroft NS',
		title: 'The basic reproduction number (R0) of measles: a systematic review',
		journal: 'The Lancet Infectious Diseases',
		year: 2017,
		evidence: 'systematic-review',
		doi: '10.1016/s1473-3099(17)30307-9',
		usedFor: ['measles.r0', 'measles.herdImmunityThreshold'],
		quote: 'R0 is often cited to be 12-18',
		location: 'abstract',
		why: 'Systematic review; standard R0 reference.',
		context: '58 R0 estimates worldwide; threshold derived as 1 - 1/R0.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'wallinga2001-measles-r0-europe',
		authors: 'Wallinga J, Lévy-Bruhl D, Gay NJ, Wachmann CH',
		title:
			'Estimation of measles reproduction ratios and prospects for elimination of measles by vaccination in some Western European countries',
		journal: 'Epidemiology and Infection',
		year: 2001,
		evidence: 'study',
		doi: '10.1017/s095026880100601x',
		usedFor: ['measles.r0', 'measles.herdImmunityThreshold'],
		quote: 'bounds on critical vaccine coverage of 86.6% and 98.1%',
		location: 'abstract',
		why: 'Classic high-income European estimate.',
		context: '8 Western European programmes, 1990s.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'fu2026-measles-r0-lmic',
		authors: 'Fu H, Sbarra A, Russell T, Abbas K, Auzenbergs M, Jit M',
		title:
			'Estimating the basic reproduction number of measles in low-and middle-income settings using 172 seroprevalence studies: A modelling approach',
		journal: 'PLOS Global Public Health',
		year: 2026,
		evidence: 'study',
		doi: '10.1371/journal.pgph.0006731',
		usedFor: ['measles.r0'],
		quote: 'fewer than 13% of studies having median R0 values in the range of 12-18',
		location: 'abstract',
		why: 'Largest LMIC estimate.',
		context: 'Context only: 57 LMICs.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cdc-survmanual-measles-2025',
		authors: 'Filardo TD, Mathis A, Raines K, et al.',
		title: 'Chapter 7: Measles. Manual for the Surveillance of Vaccine-Preventable Diseases',
		journal: 'CDC',
		year: 2025,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/surv-manual/php/table-of-contents/chapter-7-measles.html',
		usedFor: ['measles.silentDays', 'measles.illDays', 'measles.mortality'],
		quote:
			'infectious from four days before until four days after onset of rash … two to three deaths may occur for every 1,000 reported measles cases',
		location: 'Disease Description section (last reviewed 3 June 2025)',
		why: 'Current CDC guidance; replaces the unopenable 2008 edition.',
		context: 'US; 2-3 per 1,000 = 0.002-0.003.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cdc-pinkbook-measles',
		authors: 'CDC',
		title: 'Pink Book, Chapter 13: Measles',
		journal: 'CDC, Epidemiology and Prevention of Vaccine-Preventable Diseases',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-13-measles.html',
		usedFor: [
			'measles.silentDays',
			'measles.illDays',
			'measles.waningDays',
			'measles.vaccines.MMR.seriousPer100kDoses',
			'mumps.vaccines.MMR.seriousPer100kDoses',
			'rubella.vaccines.MMR.seriousPer100kDoses',
			'measles.vaccines.MMR.waningDays'
		],
		quote:
			'transmissible from 4 days before through 4 days after rash onset … 2% to 7% of children who receive only 1 dose of MMR vaccine fail to respond … probably lifelong … MMR vaccine is associated with a very small risk of febrile seizures; approximately one case for every 3,000 to 4,000 doses of MMR vaccine administered.',
		location:
			'Epidemiology; Immunogenicity and Vaccine Efficacy (last reviewed 24 April 2024); Vaccine Safety (febrile seizures)',
		why: `CDC reference text, read directly. Vaccine risk (the same MMR vaccine for measles, mumps and rubella): 1 in ${fmt(MMR_SEIZURE_DOSES[0])} to ${fmt(MMR_SEIZURE_DOSES[1])} doses, the middle of which is ${fmt(MMR_SERIOUS_PER_100K, 1)} per 100,000 doses. These are febrile seizures in young children, which usually need emergency care and leave no lasting harm. Deaths caused by MMR come from IOM 2012, not this page.`,
		context: 'US; seroconversion data.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Vaccine Safety sentence re-opened in a separate pass and confirmed verbatim (last reviewed 24 April 2024).'
		}
	},
	{
		id: 'klinkenberg2011-measles-generation',
		authors: 'Klinkenberg D, Nishiura H',
		title:
			'The correlation between infectivity and incubation period of measles, estimated from households with two cases',
		journal: 'Journal of Theoretical Biology',
		year: 2011,
		evidence: 'study',
		doi: '10.1016/j.jtbi.2011.06.015',
		usedFor: ['measles.silentDays'],
		quote: 'infectiousness of measles cases increases significantly around the time of symptom onset',
		location: 'abstract',
		why: 'Household-data estimate.',
		context: 'Historical households.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'tranter2024-measles-breakthrough',
		authors: 'Tranter I, Smoll N, Lau CL, Williams D, Neucom D, Barnekow D, Dyda A',
		title: 'Onward Virus Transmission after Measles Secondary Vaccination Failure',
		journal: 'Emerging Infectious Diseases',
		year: 2024,
		evidence: 'systematic-review',
		doi: '10.3201/eid3009.240150',
		usedFor: ['measles.asymptomaticFraction'],
		quote: 'effective reproduction number of 0.063',
		location: 'abstract',
		why: 'Systematic review.',
		context: 'Context only; asymptomaticFraction 0 stays an assumption.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'portnoy2019-measles-cfr-lmic',
		authors: 'Portnoy A, et al.',
		title:
			'Estimates of case-fatality ratios of measles in low-income and middle-income countries: a systematic review and modelling analysis',
		journal: 'The Lancet Global Health',
		year: 2019,
		evidence: 'systematic-review',
		doi: '10.1016/s2214-109x(18)30537-0',
		usedFor: ['measles.mortality'],
		quote: 'In community-based settings, the mean case-fatality ratio was 1·5%',
		location: 'abstract',
		why: 'Systematic review.',
		context: 'Low-income alternative value only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'sbarra2023-measles-cfr-lmic',
		authors: 'Sbarra AN, et al.',
		title:
			'Estimating national-level measles case–fatality ratios in low-income and middle-income countries: an updated systematic review and modelling study',
		journal: 'The Lancet Global Health',
		year: 2023,
		evidence: 'systematic-review',
		doi: '10.1016/s2214-109x(23)00043-8',
		usedFor: ['measles.mortality'],
		quote: 'mean CFR for 2019 of 1·32%',
		location: 'abstract',
		why: 'Most recent systematic review.',
		context: 'Low-income alternative value only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'uzicanin2011-measles-ve-review',
		authors: 'Uzicanin A, et al.',
		title:
			'Field effectiveness of live attenuated measles-containing vaccines: a review of published literature',
		journal: 'The Journal of Infectious Diseases',
		year: 2011,
		evidence: 'review',
		doi: '10.1093/infdis/jir102',
		usedFor: [
			'measles.partialEfficacy',
			'measles.fullEfficacy',
			'measles.vaccines.MMR.full.infection',
			'measles.vaccines.MMR.partial.infection'
		],
		quote: '≥12 months, the median VE was … 92.0% … For 2 doses … the median VE was 94.1%',
		location: 'abstract',
		why: 'Review of 70 papers.',
		context: 'Worldwide, 1960-2010.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'dipietrantonj2021-cochrane-mmrv',
		authors: 'Di Pietrantonj C, et al.',
		title: 'Vaccines for measles, mumps, rubella, and varicella in children',
		journal: 'Cochrane Database of Systematic Reviews',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1002/14651858.cd004407.pub5',
		usedFor: [
			'measles.partialEfficacy',
			'measles.fullEfficacy',
			'measles.vaccines.MMR.full.infection',
			'measles.vaccines.MMR.partial.infection',
			'rubella.fullEfficacy',
			'rubella.partialEfficacy',
			'rubella.vaccines.MMR.full.infection',
			'rubella.vaccines.MMR.partial.infection'
		],
		quote:
			'Vaccine effectiveness in preventing measles was 95% after one dose (relative risk (RR) 0.05, 95% CI 0.02 to 0.13; 7 cohort studies; 12,039 children; moderate certainty evidence) and 96% after two doses (RR 0.04, 95% CI 0.01 to 0.28; 5 cohort studies; 21,604 children; moderate certainty evidence). … Vaccine effectiveness against rubella, using a vaccine with the BRD2 strain which is only used in China, is 89% (RR 0.11, 95% CI 0.03 to 0.42; 1 cohort study; 1621 children; moderate certainty evidence).',
		location: 'Abstract, Main results',
		why: `Measles: ${COCHRANE_MMR.measles.full} after two doses and ${COCHRANE_MMR.measles.partial} after one, field effectiveness against measles cases; measles almost always shows, so this is close to protection against infection. Rubella: ${COCHRANE_MMR.rubella} for either course, marked as not fully sourced because it is one cohort in China, mixing the BRD-II strain (used only there) and RA27/3, with doses not split. Mumps (Jeryl Lynn) is ${COCHRANE_MMR.mumps.full} after two doses and ${COCHRANE_MMR.mumps.partial} after one, but those average over years since the dose and can't be paired with a half-life, so mumps uses Lewnard & Grad 2018.`,
		context:
			'Children; cohort studies. The same figures are in the 2020 version (pub4). Measures cases of illness, not infection.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Both quoted sentences confirmed verbatim in the Abstract, Main results: measles 95% after one dose and 96% after two, the same in pub4 and pub5; rubella 89% (pub5 adds that the vaccine used the BRD2 strain, used only in China). Outcome is cases of each disease.'
		}
	},
	{
		id: 'benet2025-measles-ve-france',
		authors: 'Bénet T, et al.',
		title: 'Investigation of a measles outbreak in a highly vaccinated middle school, France, 2023',
		journal: 'Eurosurveillance',
		year: 2025,
		evidence: 'study',
		doi: '10.2807/1560-7917.es.2025.30.46.2500130',
		usedFor: ['measles.fullEfficacy', 'measles.vaccines.MMR.full.infection'],
		quote: 'VE was 96.4%',
		location: 'abstract',
		why: 'Single outbreak; support only.',
		context: 'One French school.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'perry2026-measles-ve-wales',
		authors: 'Perry M, et al.',
		title:
			'Estimates of vaccine effectiveness against measles and mumps: 14 years follow-up of a large cohort in Wales, UK',
		journal: 'International Journal of Epidemiology',
		year: 2026,
		evidence: 'study',
		doi: '10.1093/ije/dyag083',
		usedFor: [
			'measles.fullEfficacy',
			'measles.waningDays',
			'measles.vaccines.MMR.full.infection',
			'measles.vaccines.MMR.waningDays'
		],
		quote: 'remained high after 15 years 99.7%',
		location: 'abstract',
		why: 'Large cohort.',
		context: 'Wales, 2007-2020.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'griffin2016-measles-immunity',
		authors: 'Griffin DE',
		title: 'The Immune Response in Measles: Virus Control, Clearance and Protective Immunity',
		journal: 'Viruses',
		year: 2016,
		evidence: 'review',
		doi: '10.3390/v8100282',
		usedFor: ['measles.waningDays'],
		quote: 'life-long protective immunity',
		location: 'abstract',
		why: 'Review.',
		context: 'Natural immunity.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'robert2024-measles-waning-england',
		authors: 'Robert A, et al.',
		title:
			'Long-term waning of vaccine-induced immunity to measles in England: a mathematical modelling study',
		journal: 'The Lancet Public Health',
		year: 2024,
		evidence: 'study',
		doi: '10.1016/s2468-2667(24)00181-6',
		usedFor: ['measles.waningDays', 'measles.vaccines.MMR.waningDays'],
		quote: 'waning rate was slow (0·039% per year of age',
		location: 'abstract',
		why: 'Fitted national model.',
		context: 'England.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'bolotin2022-measles-waning-review',
		authors: 'Bolotin S, et al.',
		title:
			'In Elimination Settings, Measles Antibodies Wane Following Vaccination but Not Following Infection - A Systematic Review and Meta-Analysis',
		journal: 'The Journal of Infectious Diseases',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1093/infdis/jiac039',
		usedFor: ['measles.waningDays', 'measles.vaccines.MMR.waningDays'],
		quote: 'Decreases in the proportion of seropositive individuals over time were not significant',
		location: 'abstract',
		why: 'Systematic review.',
		context: 'Elimination settings.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cdc-pinkbook-polio',
		authors: 'CDC',
		title: 'Pink Book, Chapter 18: Poliomyelitis',
		journal: 'CDC, Epidemiology and Prevention of Vaccine-Preventable Diseases',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-18-poliomyelitis.html',
		usedFor: [
			'polio.silentDays',
			'polio.illDays',
			'polio.asymptomaticFraction',
			'polio.mortality',
			'polio.waningDays',
			'polio.hospitalisedShare',
			'polio.vaccines.IPV.full.severe',
			'polio.vaccines.IPV.seriousPer100kDoses',
			'polio.vaccines.OPV.full.severe',
			'polio.vaccines.OPV.partial.severe',
			'polio.vaccines.OPV.seriousPer100kDoses',
			'polio.vaccines.OPV.deathsPer100kDoses',
			'polio.vaccines.IPV.waningDays'
		],
		quote:
			'For the onset of paralysis in paralytic poliomyelitis, the incubation period is usually 7 to 21 days. … Approximately 70% of all polio infections in children are asymptomatic. … Approximately 24% … consist of a minor, nonspecific illness … Nonparalytic aseptic meningitis occurs in 1% to 5% of polio infections in children. … Less than 1% of all polio infections in children result in flaccid paralysis. … The case fatality ratio for paralytic polio is generally 2% to 5% among children … most infectious in the days immediately before and after the onset of symptoms … at least 99% are immune following 3 doses … probably provides lifelong immunity after a complete series … Because of interference among serotypes during intestinal replication, a single dose of tOPV produces immunity to all three vaccine viruses in approximately 50% of recipients. … in more than 95% of recipients in industrialized countries … However, one case of VAPP occurred for every 2 to 3 million doses of tOPV vaccine administered. … No increased risks for serious adverse events have been observed in countries relying on all-IPV schedules.',
		location:
			'Clinical Features; Epidemiology; Immunogenicity and Vaccine Efficacy (last reviewed 1 May 2024); OPV vaccine efficacy; Vaccine-associated paralytic polio; IPV safety',
		why: `CDC reference text, read directly. silentDays 7 is worked out: the low end of the 7 to 21 day onset window, because people spread polio before they fall ill. hospitalisedShare 1 is worked out: in the model only meningitis and paralysis cases turn red, and those are hospital cases. Vaccines, against paralysis: IPV 3 doses 0.99; OPV 3 doses 0.95 (in industrialised countries; much lower in low-income tropical settings); OPV one dose 0.50. OPV risk: paralysis caused by the vaccine (VAPP), 1 per ${OPV_RISK.millionDosesPerVapp[0]} to ${OPV_RISK.millionDosesPerVapp[1]} million doses, the middle of which is ${fmt(OPV_RISK.vappPer100k, 4)} per 100,000 doses; it is 7 to 21 times higher for the first dose. IPV has no vaccine-specific serious risk, so the general anaphylaxis rate is used (McNeil 2016). OPV deaths are worked out: ${fmt(OPV_RISK.vappPer100k, 4)} x the middle of the ${OPV_RISK.paralyticCaseFatality[0] * 100}% to ${OPV_RISK.paralyticCaseFatality[1] * 100}% case fatality ratio for paralytic polio (${fmt(OPV_RISK.caseFatality * 100, 1)}%) = ${fmt(OPV_RISK.deathsPer100k, 5)} per 100,000 doses. That no death is established for IPV comes from ACIP 2024.`,
		context: 'US; children.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Vaccine sentences re-opened in separate passes: the IPV 99% sentence, the single-dose tOPV sentence, the VAPP sentence and the all-IPV safety sentence returned verbatim; the OPV three-dose phrase is given as a short fragment because only one read returned it.'
		}
	},
	{
		id: 'who2022-polio-position-paper',
		authors: 'World Health Organization',
		title: 'Polio vaccines: WHO position paper – June 2022',
		journal: 'Weekly Epidemiological Record 97(25)',
		year: 2022,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/publications/i/item/who-wer9725-277-300',
		mirrorUrl: 'https://polioeradication.org/wp-content/uploads/2024/05/WER9725-eng-fre.pdf',
		usedFor: ['polio.illDays', 'polio.asymptomaticFraction'],
		quote:
			'faecal and pharyngeal shedding, typically for 4 and 2 weeks respectively … Asymptomatic infection is the most frequent outcome (72%)',
		location: 'p.278 Epidemiology; p.280 OPV immunogenicity, efficacy and effectiveness',
		why: 'WHO position paper.',
		context: 'Global; added support.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'fine2024-polio-population-immunity',
		authors: 'Fine PEM',
		title: 'Population Immunity and Polio Eradication',
		journal: 'Pathogens',
		year: 2024,
		evidence: 'review',
		noReviewReason: 'No meta-analysis or systematic review of polio R0 was found (search, 7 Oct 2026).',
		doi: '10.3390/pathogens13030183',
		usedFor: ['polio.r0', 'polio.herdImmunityThreshold'],
		quote:
			'estimates of R0 ranging from approximately 4 for wealthy countries up to 30 for poor populations … herd immunity threshold … approximately 75% in wealthy high-hygiene populations to 97% in poor populations',
		location: 'Section 2, Theoretical Background, p.3',
		why: 'Review of pre-vaccine serological R0 estimates; replaces the unverified textbook 5-7.',
		context: 'R0 6 and threshold 83% lie inside these ranges; 6 itself is still a chosen value.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'alexander1997-polio-excretion-review',
		authors: 'Alexander JP, et al.',
		title:
			'Duration of poliovirus excretion and its implications for acute flaccid paralysis surveillance: a review of the literature',
		journal: 'The Journal of Infectious Diseases',
		year: 1997,
		evidence: 'review',
		doi: '10.1093/infdis/175.supplement_1.s176',
		usedFor: ['polio.illDays'],
		quote: 'excreted by a majority of previously unvaccinated infants and young children for 3-4 weeks',
		location: 'abstract',
		why: 'Classic review.',
		context: 'Studies 1935-1995.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'brouwer2022-polio-shedding-israel',
		authors: 'Brouwer AF, et al.',
		title:
			'The role of time-varying viral shedding in modelling environmental surveillance for public health: revisiting the 2013 poliovirus outbreak in Israel',
		journal: 'Journal of the Royal Society Interface',
		year: 2022,
		evidence: 'study',
		doi: '10.1098/rsif.2022.0006',
		usedFor: ['polio.illDays'],
		quote: 'shed virus for an average of 29 days',
		location: 'abstract',
		why: 'High-income outbreak estimate.',
		context: 'Israel 2013.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'yaari2016-polio-israel',
		authors: 'Yaari R, et al.',
		title:
			'Modeling the spread of polio in an IPV-vaccinated population: lessons learned from the 2013 silent outbreak in southern Israel',
		journal: 'BMC Medicine',
		year: 2016,
		evidence: 'study',
		doi: '10.1186/s12916-016-0637-z',
		usedFor: ['polio.r0', 'polio.illDays'],
		quote: 'mean infectious periods was 16.8 (8.6-24.9) days',
		location: 'abstract',
		why: 'Outbreak model.',
		context:
			'Effective R (1.77) in an IPV-vaccinated group; context for R0. An author-details erratum exists (not a retraction).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'brouwer2018-polio-rahat',
		authors: 'Brouwer AF, et al.',
		title:
			'Epidemiology of the silent polio outbreak in Rahat, Israel, based on modeling of environmental surveillance data',
		journal: 'PNAS',
		year: 2018,
		evidence: 'study',
		doi: '10.1073/pnas.1808798115',
		usedFor: ['polio.r0'],
		quote: 'basic reproduction number was 1.62',
		location: 'abstract',
		why: 'Modelling study.',
		context: 'Partly immune population; context only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'blake2014-polio-older-ages',
		authors: 'Blake IM, et al.',
		title: 'The role of older children and adults in wild poliovirus transmission',
		journal: 'PNAS',
		year: 2014,
		evidence: 'study',
		doi: '10.1073/pnas.1323688111',
		usedFor: ['polio.r0', 'polio.waningDays'],
		quote: 'imperfect, waning intestinal immunity among older children and adults permits reinfection',
		location: 'abstract',
		why: 'Fitted outbreak model.',
		context: 'Tajikistan and Congo 2010; gut immunity, not paralysis protection.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'fatusi1997-polio-epidemiology',
		authors: 'Fatusi A',
		title: 'Epidemiology and control of poliomyelitis',
		journal: 'The Journal of the Royal Society for the Promotion of Health',
		year: 1997,
		evidence: 'review',
		doi: '10.1177/146642409711700103',
		usedFor: ['polio.asymptomaticFraction', 'polio.mortality'],
		quote: 'ratios of inapparent to apparent infections range between 100:1 and 1,000:1',
		location: 'abstract',
		why: 'Classic review citing PAHO.',
		context: 'Global.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'doshi2011-polio-cfr-india',
		authors: 'Doshi SJ, et al.',
		title: 'Poliomyelitis-related case-fatality ratio in India, 2002-2006',
		journal: 'Clinical Infectious Diseases',
		year: 2011,
		evidence: 'study',
		doi: '10.1093/cid/cir332',
		usedFor: ['polio.mortality'],
		quote: 'ranges from 2%-5% among children <5 years of age to 10%-30% among adults',
		location: 'abstract',
		why: 'National surveillance.',
		context: 'Paralytic cases only; India.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'grassly2014-ipv-doses-review',
		authors: 'Grassly NC',
		title:
			'Immunogenicity and Effectiveness of Routine Immunization With 1 or 2 Doses of Inactivated Poliovirus Vaccine: Systematic Review and Meta-analysis',
		journal: 'The Journal of Infectious Diseases',
		year: 2014,
		evidence: 'meta-analysis',
		doi: '10.1093/infdis/jit601',
		usedFor: ['polio.vaccines.IPV.partial.severe'],
		quote:
			'One full dose of intramuscular IPV seroconverted 33%, 41%, and 47% of infants against serotypes 1, 2, and 3 on average, whereas 2 full doses seroconverted 79%, 80%, and 90%, respectively. … Limited data from case-control studies indicate clinical efficacy equivalent to the proportion seroconverting.',
		location: 'Abstract, Results',
		why: `One IPV dose, a started course: the mean of ${IPV_ONE_DOSE_SEROCONVERSION.map((x) => `${x * 100}%`).join(', ')} = ${fmt(IPV_ONE_DOSE, 3)} protection against paralysis, since clinical efficacy about equals the share seroconverting.`,
		context: '20 study arms from 12 articles; infants. Seroconversion rises with age at the dose.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cooper2024-ipv-nigeria',
		authors: 'Cooper LV, et al.',
		title:
			'Effectiveness of poliovirus vaccines against circulating vaccine-derived type 2 poliomyelitis in Nigeria between 2017 and 2022: a case-control study',
		journal: 'The Lancet Infectious Diseases',
		year: 2024,
		evidence: 'study',
		doi: '10.1016/s1473-3099(23)00688-6',
		usedFor: ['polio.vaccines.IPV.partial.severe'],
		quote: 'effectiveness of one IPV dose was 43%',
		location: 'abstract',
		why: "Context for one IPV dose against paralysis: 43% here agrees with Grassly 2014's pooled 0.40, which sets the value.",
		context: 'Nigeria; 89% with community controls.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'hird2012-ipv-mucosal-review',
		authors: 'Hird TR, Grassly NC',
		title:
			'Systematic Review of Mucosal Immunity Induced by Oral and Inactivated Poliovirus Vaccines against Virus Shedding following Oral Poliovirus Challenge',
		journal: 'PLoS Pathogens',
		year: 2012,
		evidence: 'systematic-review',
		doi: '10.1371/journal.ppat.1002599',
		usedFor: [
			'polio.fullEfficacy',
			'polio.partialEfficacy',
			'polio.vaccines.IPV.full.infection',
			'polio.vaccines.IPV.partial.infection'
		],
		quote:
			'Individuals vaccinated with OPV were protected against infection and shedding of poliovirus in stool samples collected after challenge compared with unvaccinated individuals (summary odds ratio [OR] for shedding 0.13 (95% confidence interval [CI] 0.08–0.24)). In contrast, IPV provided no protection against shedding compared with unvaccinated individuals (summary OR 0.81 [95% CI 0.59–1.11])',
		location: 'abstract',
		why: `OPV: the summary odds ratio ${OPV_SHEDDING_OR} is not used as a protection figure: 1 - OR overstates protection when shedding is common, so OPV uses Macklin 2019 (${OPV_INTESTINAL_IMMUNITY}). IPV: 1 - OR 0.81 = 0.19, but its 95% CI (0.59-1.11) includes no effect, so it is not statistically significant and is stored as 0, for a full or a started course. IPV cuts shedding from the throat more than from the gut; this model has no route of spread (throat or gut), so it uses this gut-shedding result, and an IPV-vaccinated person can still catch and pass on polio while being protected from paralysis.`,
		context: '31 stool-shedding challenge studies through May 2011, mostly trivalent OPV schedules.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'PLoS article page confirms title, authors Hird TR and Grassly NC, year 2012, and both quoted sentences verbatim; no correction or retraction notice.'
		}
	},
	{
		id: 'biggerstaff2014-flu-r-review',
		authors: 'Biggerstaff M, Cauchemez S, Reed C, Gambhir M, Finelli L',
		title:
			'Estimates of the reproduction number for seasonal, pandemic, and zoonotic influenza: a systematic review of the literature',
		journal: 'BMC Infectious Diseases',
		year: 2014,
		evidence: 'systematic-review',
		doi: '10.1186/1471-2334-14-480',
		usedFor: ['flu.r0', 'flu.herdImmunityThreshold', 'flu1918.r0'],
		quote:
			'median R value for seasonal influenza was 1.28 … The median R value for 1918 was 1.80 (interquartile range [IQR]: 1.47-2.27).',
		location: 'Abstract, Results',
		why: 'Systematic review giving median R for both seasonal flu (1.28, rounded to 1.3) and the 1918 pandemic (1.80).',
		context: 'Threshold derived as 1 - 1/1.3.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'chowell2007-flu-r-us-fr-au',
		authors: 'Chowell G, et al.',
		title:
			'Seasonal influenza in the United States, France, and Australia: transmission and prospects for control',
		journal: 'Epidemiology and Infection',
		year: 2007,
		evidence: 'study',
		doi: '10.1017/s0950268807009144',
		usedFor: ['flu.r0'],
		quote: 'mean value 1.3',
		location: 'abstract',
		why: 'Multi-country, multi-decade.',
		context: 'US, France, Australia.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'truscott2011-flu-mechanisms',
		authors: 'Truscott J, et al.',
		title:
			'Essential epidemiological mechanisms underpinning the transmission dynamics of seasonal influenza',
		journal: 'Journal of the Royal Society Interface',
		year: 2011,
		evidence: 'study',
		doi: '10.1098/rsif.2011.0309',
		usedFor: ['flu.r0'],
		quote: 'R(0), in the range 1.6-3',
		location: 'abstract',
		why: 'Model fitted to temperate series.',
		context: 'Natural immunity wanes over 3-8 years (not vaccine waning).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'carrat2008-flu-timelines-review',
		authors: 'Carrat F, et al.',
		title: 'Time lines of infection and disease in human influenza: a review of volunteer challenge studies',
		journal: 'American Journal of Epidemiology',
		year: 2008,
		evidence: 'systematic-review',
		doi: '10.1093/aje/kwm375',
		usedFor: ['flu.illDays', 'flu.asymptomaticFraction', 'flu1918.illDays'],
		quote: 'duration of viral shedding averaged over 375 participants was 4.80 days',
		location: 'abstract',
		why: 'Systematic review of volunteer challenge studies. Shedding lasts 4.8 days in all and starts about 1 day before symptoms, so illDays = 4.8 - 1 = about 4 (worked out).',
		context: 'Challenge studies in healthy adults; 66.9% symptomatic.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'memoli2015-flu-challenge',
		authors: 'Memoli MJ, et al.',
		title:
			'Validation of the wild-type influenza A human challenge model H1N1pdMIST: an A(H1N1)pdm09 dose-finding investigational new drug study',
		journal: 'Clinical Infectious Diseases',
		year: 2015,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis measures how long flu is contagious before symptoms start; the pooled challenge-study review (Carrat 2008) times shedding from infection, not from symptoms.',
		doi: '10.1093/cid/ciu924',
		usedFor: ['flu.silentDays', 'flu1918.silentDays'],
		quote: 'Viral shedding preceded symptoms by 12-24 hours',
		location: 'abstract',
		why: 'Direct observation.',
		context: 'US volunteers.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'suess2012-flu-shedding-germany',
		authors: 'Suess T, et al.',
		title:
			'Comparison of Shedding Characteristics of Seasonal Influenza Virus (Sub)Types and Influenza A(H1N1)pdm09; Germany, 2007–2011',
		journal: 'PLoS ONE',
		year: 2012,
		evidence: 'study',
		doi: '10.1371/journal.pone.0051653',
		usedFor: ['flu.silentDays', 'flu.illDays', 'flu1918.silentDays', 'flu1918.illDays'],
		quote: 'infectiousness as measured by viral culture lasted approximately until illness days 4-6',
		location: 'abstract',
		why: 'Household study.',
		context: 'Berlin and Munich.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'lau2010-flu-shedding-hk',
		authors: 'Lau LLH, et al.',
		title: 'Viral shedding and clinical illness in naturally acquired influenza virus infections',
		journal: 'The Journal of Infectious Diseases',
		year: 2010,
		evidence: 'study',
		doi: '10.1086/652241',
		usedFor: ['flu.silentDays', 'flu1918.silentDays'],
		quote: '1%-8% of infectiousness occurs prior to illness onset',
		location: 'abstract',
		why: 'Community study.',
		context: 'Hong Kong 2008.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'leung2015-flu-asymptomatic-review',
		authors: 'Leung NHL, et al.',
		title:
			'The fraction of influenza virus infections that are asymptomatic: a systematic review and meta-analysis',
		journal: 'Epidemiology',
		year: 2015,
		evidence: 'meta-analysis',
		doi: '10.1097/ede.0000000000000340',
		usedFor: ['flu.asymptomaticFraction'],
		quote: 'pooled mean of 16%',
		location: 'abstract',
		why: 'Meta-analysis.',
		context: 'Outbreak studies.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'furuya2016-flu-asymptomatic-review',
		authors: 'Furuya-Kanamori L, et al.',
		title: 'Heterogeneous and Dynamic Prevalence of Asymptomatic Influenza Virus Infections',
		journal: 'Emerging Infectious Diseases',
		year: 2016,
		evidence: 'meta-analysis',
		doi: '10.3201/eid2206.151080',
		usedFor: ['flu.asymptomaticFraction'],
		quote: 'ranged from 5.2% to 35.5%',
		location: 'abstract',
		why: 'Meta-analysis.',
		context: '55 studies.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cohen2021-flu-phirst-southafrica',
		authors: 'Cohen C, et al.',
		title:
			'Asymptomatic transmission and high community burden of seasonal influenza in an urban and a rural community in South Africa, 2017–18 (PHIRST): a population cohort study',
		journal: 'The Lancet Global Health',
		year: 2021,
		evidence: 'study',
		doi: '10.1016/s2214-109x(21)00141-8',
		usedFor: ['flu.asymptomaticFraction'],
		quote: '268 (56%) of 478 infections were symptomatic',
		location: 'abstract',
		why: 'Cohort tested regardless of symptoms.',
		context: 'South Africa; upper-range context.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'mcdonald2023-flu-cfr-netherlands',
		authors: 'McDonald SA, et al.',
		title:
			'Inference of age-dependent case-fatality ratios for seasonal influenza virus subtypes A(H3N2) and A(H1N1)pdm09 and B lineages using data from the Netherlands',
		journal: 'Influenza and Other Respiratory Viruses',
		year: 2023,
		evidence: 'study',
		doi: '10.1111/irv.13146',
		usedFor: ['flu.mortality'],
		quote: '85+ years age-group, at 4.76%',
		location: 'abstract',
		why: 'National synthesis.',
		context: 'Age context only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'iuliano2017-flu-global-mortality',
		authors: 'Iuliano AD, et al.',
		title: 'Estimates of global seasonal influenza-associated respiratory mortality: a modelling study',
		journal: 'Lancet',
		year: 2017,
		evidence: 'study',
		doi: '10.1016/s0140-6736(17)33293-2',
		usedFor: ['flu.mortality'],
		quote: 'highest mortality rates were estimated in sub-Saharan Africa',
		location: 'abstract',
		why: 'WHO-used global estimate.',
		context: 'Low-income alternative value only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cohen2010-flu-mortality-southafrica',
		authors: 'Cohen C, et al.',
		title: 'Elevated influenza-related excess mortality in South African elderly individuals, 1998-2005',
		journal: 'Clinical Infectious Diseases',
		year: 2010,
		evidence: 'study',
		doi: '10.1086/657314',
		usedFor: ['flu.mortality'],
		quote: '545 versus 133 deaths per 100,000 population for all causes',
		location: 'abstract',
		why: 'Direct low/high-income comparison.',
		context: 'Low-income multiplier only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'nair2011-flu-children-burden',
		authors: 'Nair H, et al.',
		title:
			'Global burden of respiratory infections due to seasonal influenza in young children: a systematic review and meta-analysis',
		journal: 'Lancet',
		year: 2011,
		evidence: 'meta-analysis',
		doi: '10.1016/s0140-6736(11)61051-9',
		usedFor: ['flu.mortality'],
		quote: '99% of these deaths occurring in developing countries',
		location: 'abstract',
		why: 'Systematic review.',
		context: 'Under-5s; low-income context.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'belongia2016-flu-ve-review',
		authors: 'Belongia EA, et al.',
		title:
			'Variable influenza vaccine effectiveness by subtype: a systematic review and meta-analysis of test-negative design studies',
		journal: 'The Lancet Infectious Diseases',
		year: 2016,
		evidence: 'meta-analysis',
		doi: '10.1016/s1473-3099(16)00129-8',
		usedFor: ['flu.fullEfficacy', 'flu.vaccines.inactivated.full.infection'],
		quote: 'Pooled VE was 33% (95% CI 26-39; I(2)=44·4) for H3N2',
		location: 'abstract',
		why: 'Meta-analysis.',
		context: 'Outpatients 2004-2015.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'guo2024-flu-ve-review',
		authors: 'Guo J, et al.',
		title:
			'Real-world effectiveness of seasonal influenza vaccination and age as effect modifier: A systematic review, meta-analysis and meta-regression of test-negative design studies',
		journal: 'Vaccine',
		year: 2024,
		evidence: 'meta-analysis',
		doi: '10.1016/j.vaccine.2024.02.059',
		usedFor: [
			'flu.fullEfficacy',
			'flu.vaccines.inactivated.full.infection',
			'flu.vaccines.inactivated.full.severe'
		],
		quote: 'The pooled IVE was 41.4 % (95 % CI: 39.2-43.5 %) against any influenza',
		location: 'abstract',
		why: `Largest recent meta-analysis: ${FLU_VACCINE.seasonAverage} is real-world protection against any lab-confirmed flu, all ages, averaged over a season. The sim starts protection higher and lets it wane on Young 2018's ${fmt(YOUNG.halfLife)}-day half-life, so the start is worked out as the value whose average from day ${FLU_VACCINE.season.fromDay} to day ${FLU_VACCINE.season.toDay} is ${FLU_VACCINE.seasonAverage}: the average is ${fmt(FLU_VACCINE.seasonFactor, 3)} of the start, so the start is ${FLU_VACCINE.seasonAverage} / ${fmt(FLU_VACCINE.seasonFactor, 3)} = ${fmt(FLU_VACCINE.start, 3)}. Check against Young's own windows: the sim averages ${fmt(FLU_VACCINE.earlyWindow, 3)} over days 15-90 (measured ${fmt(YOUNG.early.ve / 100, 3)}) and ${fmt(FLU_VACCINE.lateWindow, 3)} over days 91-180 (measured ${fmt(YOUNG.late.ve / 100, 3)}). The start is higher than any figure measured directly.`,
		context:
			'191 test-negative studies, 2017-2022. Same abstract: 48.6% in children, 36.7% at 18-64, 30.6% at 65+. Counts medically attended flu, not every infection, so it may overstate protection against infection.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'young2018-flu-ve-waning-review',
		authors: 'Young B, Sadarangani S, Jiang L, Wilder-Smith A, Chen MI-C',
		title:
			'Duration of Influenza Vaccine Effectiveness: A Systematic Review, Meta-analysis, and Meta-regression of Test-Negative Design Case-Control Studies',
		journal: 'The Journal of Infectious Diseases',
		year: 2018,
		evidence: 'meta-analysis',
		doi: '10.1093/infdis/jix632',
		usedFor: [
			'flu.vaccines.inactivated.waningDays',
			'flu.fullEfficacy',
			'flu.vaccines.inactivated.full.infection'
		],
		quote:
			'Meta-analyses were performed to compare VE 15-90 days after vaccination to VE 91-180 days after vaccination. A significant decline in VE was observed for influenza virus subtype A/H3 (change in VE, -33; 95% confidence interval [CI], -57 to -12) and type B (change in VE, -19; 95% CI, -33 to -6). VE declined for influenza virus subtype A/H1, but this difference was not statistically significant (change in VE -8; 95% CI, -27 to 21).',
		location:
			"Abstract (Results); pooled VE by window from Table 4 'Summary of Findings': A(H3) 45 -> 13 (10,736 cases), B 62 -> 43 (6,424 cases), A(H1) 62 -> 54 (5,148 cases), VE 15-90 days -> 91-180 days",
		why: `Meta-analysis. Vaccine waningDays is worked out as an exponential half-life between the window midpoints (day ${YOUNG.early.day} and day ${YOUNG.late.day}, ${YOUNG.late.day - YOUNG.early.day} days apart), using the mean VE weighted by cases, ${YOUNG.early.ve} -> ${fmt(YOUNG.late.ve, 2)}: ${YOUNG.late.day - YOUNG.early.day} x ln2 / ln(${YOUNG.early.ve} / ${fmt(YOUNG.late.ve, 2)}) = ${fmt(YOUNG.halfLife)} days. By subtype: H3 46, B 157, H1 416 days; unweighted mean 134 days.`,
		context:
			"Vaccine-derived protection against medically attended, laboratory-confirmed flu in test-negative studies; each window is pooled from a different set of studies, and part of the decline may be bias from the test-negative design (Tokars 2020), so real waning may be slower. Range: 78 days if subtype decay rates are averaged by cases instead, and Hu 2022's 77.5 days. Infection-acquired protection lasts years (Ranjeva 2019), which is why the disease's own waningDays is far longer.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, five authors and J Infect Dis 217(5):731-741 match, no relation, update-to or updated-by entries. Abstract quote verbatim in the Consensus record and the DR-NTU manuscript; Table 4 read from the publisher page. Half-lives recomputed: case-weighted 104.9 days, unweighted 134.0, linear 98.3; averaging the decay rates by cases gives 78 days.'
		}
	},
	{
		id: 'hu2022-flu-ve-waning',
		authors: 'Hu W, et al.',
		title:
			'Waning Vaccine Protection against Influenza among Department of Defense Adult Beneficiaries in the United States, 2016–2017 through 2019–2020 Influenza Seasons',
		journal: 'Vaccines',
		year: 2022,
		evidence: 'study',
		doi: '10.3390/vaccines10060888',
		usedFor: ['flu.vaccines.inactivated.waningDays'],
		quote:
			'The adjusted overall VE against any medically attended, laboratory-confirmed influenza decreased from 50% (95% confidence interval (CI): 41–58%) in adults vaccinated 14 to 74 days prior to the onset of influenza-like illness (ILI), to 39% (95% CI: 31–47%) in adults vaccinated 75 to 134 days prior to the onset of ILI, then to 17% (95% CI: 0–32%) in adults vaccinated 135 to 194 days prior to the onset of ILI. … wanes within 180 days after 14 days of influenza vaccination',
		location: 'abstract',
		why: 'Large multi-season study; check on the vaccine half-life. A log-linear fit through the window midpoints (days 44, 104.5 and 164.5) gives 77.5 days, a little shorter than the 105 days from Young 2018, which sets the value as a meta-analysis.',
		context:
			'US Department of Defense adult beneficiaries, inactivated vaccine, 2016-17 to 2019-20. The decline is not steady: 169 days between the first two windows, 50 days between the last two.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, authors and Vaccines 10(6):888 (2022) match, no update or relation entries. Abstract quote verbatim in the Consensus record. Fit recomputed: 77.5 days through the midpoints, 77.4 from the end points alone.'
		}
	},
	{
		id: 'joshi2021-lockdown-mobility',
		authors: 'Joshi YV, et al.',
		title: 'Lockdowns lose one third of their impact on mobility in a month',
		journal: 'Scientific Reports',
		year: 2021,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis or systematic review of how long people keep to a lockdown exists (search, 7 Oct 2026).',
		doi: '10.1038/s41598-021-02133-1',
		usedFor: ['behaviour.lockdownFatigueMeanDays'],
		quote: 'lockdowns lose all their impact on mobility in 112.1 days',
		location: 'abstract',
		why: 'Peer-reviewed, 93 countries, 2020. Lockdown effect on mobility fades fully by about 112 days; a 60-day average point where people start drifting sits inside that.',
		context: 'COVID-19 era',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'petherick2021-pandemic-fatigue',
		authors: 'Petherick A, et al.',
		title:
			'A worldwide assessment of changes in adherence to COVID-19 protective behaviours and hypothesized pandemic fatigue',
		journal: 'Nature Human Behaviour',
		year: 2021,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis or systematic review of how long people keep to a lockdown exists (search, 7 Oct 2026).',
		doi: '10.1038/s41562-021-01181-x',
		usedFor: ['behaviour.lockdownFatigueSdDays'],
		quote: 'less intense in countries with high interpersonal trust',
		location: 'abstract',
		why: 'Largest cross-national study. Fatigue varies between countries, which justifies a non-zero spread; sd 20 itself is an assumption.',
		context: 'COVID-19 era',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'cdc-measles-symptoms',
		authors: 'CDC',
		title: 'Measles Symptoms and Complications',
		journal: 'CDC',
		year: 2026,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/measles/signs-symptoms/index.html',
		usedFor: ['measles.hospitalisedShare'],
		quote: 'About 1 in 5 unvaccinated people in the U.S. who get measles is hospitalized.',
		location: "Section 'Severe complications in children and adults' (last reviewed 29 April 2026)",
		why: 'Official estimate of the hospitalised share of measles cases.',
		context: 'US, unvaccinated cases.',
		verified: { by: 'independent verification pass', on: '2026-10-07', ok: true }
	},
	{
		id: 'cdc-flu-burden-2022-23',
		authors: 'CDC',
		title: 'Estimated Flu Disease Burden 2022-2023 Flu Season',
		journal: 'CDC Flu Burden',
		year: 2023,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/flu-burden/php/data-vis/2022-2023.html',
		usedFor: ['flu.hospitalisedShare'],
		quote:
			'an estimated 31 million flu-related illnesses, 14 million flu-related medical visits, 360,000 flu-related hospitalizations, and 21,000 flu-related deaths',
		location:
			'Summary paragraph; Table 1, all ages: 31,914,978 symptomatic illnesses, 369,372 hospitalizations',
		why: 'Hospitalisations divided by symptomatic illnesses is 1.16%, rounded to 1.2%.',
		context: 'US, all ages, 2022-23 season.',
		verified: { by: 'independent verification pass', on: '2026-10-07', ok: true }
	},
	{
		id: 'cdc-flu-burden-about',
		authors: 'CDC',
		title: 'About Estimated Flu Burden',
		journal: 'CDC Flu Burden',
		year: 2025,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/flu-burden/php/about/index.html',
		usedFor: ['flu.hospitalisedShare'],
		quote:
			'flu has resulted in 9.4 million – 51 million illnesses, 120,000 – 710,000 hospitalizations and 6,300 – 52,000 deaths annually between 2010 and 2025',
		location: 'Main text',
		why: 'Range check: about 1.3% to 1.4% of illnesses are hospitalised across seasons, so 1.2% is in line.',
		context: 'US, 2010-11 to 2024-25 seasons.',
		verified: { by: 'independent verification pass', on: '2026-10-07', ok: true }
	},
	{
		id: 'cdc-pinkbook-varicella',
		authors: 'Centers for Disease Control and Prevention (Marin M, Leung J, et al., eds.)',
		title: 'Chapter 22: Varicella — Epidemiology and Prevention of Vaccine-Preventable Diseases (Pink Book)',
		journal: 'CDC Pink Book (online edition)',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-22-varicella.html',
		usedFor: [
			'chickenpox.silentDays',
			'chickenpox.illDays',
			'chickenpox.mortality',
			'chickenpox.waningDays',
			'chickenpox.hospitalisedShare',
			'chickenpox.about'
		],
		quote:
			'The period of communicability extends from 1 to 2 days before the onset of rash until all lesions have formed crusts.',
		location: "Section 'Varicella' / Epidemiology — Transmission; also Secular Trends, Vaccine Effectiveness",
		why: "silentDays=2 read straight off this sentence. illDays=5 is my own pick: the page says infectiousness lasts 'until all lesions have formed crusts' but gives no day count, and crusting of all lesions typically takes a few days after the rash appears. mortality=0.00002 is worked out from the quoted fatality rates ('approximately 1 per 100,000 cases among children age 1 through 14 years, 6 per 100,000 cases among persons age 15 through 19 years, and 21 per 100,000 cases among adults') as a child-weighted average, since chickenpox is mostly a childhood disease. hospitalisedShare=0.0015 is the midpoint of 'approximately 1 to 2 per 1,000 cases among healthy children'. waningDays=null from 'Recovery from primary varicella infection usually results in lifetime immunity.'",
		context:
			'Official US reference text for vaccine-preventable diseases; the vaccine-effectiveness numbers it quotes come from Marin M et al., Pediatrics 2016, a systematic review and meta-analysis.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened and each quoted phrase confirmed verbatim ('1 to 2 days before the onset of rash', '61% and 100%', '1 per 100,000 cases', '1 to 2 per 1,000 cases', '82%', '92%', 'lifetime immunity'); page last reviewed May 9, 2024; no retraction or withdrawal notice."
		}
	},
	{
		id: 'santermans-2015-vzv-r0',
		authors: 'Santermans E, Goeyvaerts N, Melegaro A, Edmunds WJ, Faes C, Aerts M, Beutels P, Hens N',
		title:
			'The social contact hypothesis under the assumption of endemic equilibrium: Elucidating the transmission potential of VZV in Europe',
		journal: 'Epidemics',
		year: 2015,
		evidence: 'study',
		noReviewReason: 'No meta-analysis or systematic review of chickenpox R0 exists (search, 7 Oct 2026).',
		doi: '10.1016/j.epidem.2014.12.005',
		url: 'https://documentserver.uhasselt.be/bitstream/1942/18637/1/1-s2.0-S175543651500002X-main.pdf',
		usedFor: ['chickenpox.r0'],
		quote: 'R0 ranging from 2.8 in England and Wales to 7.6 in The Netherlands',
		location: 'Abstract',
		why: 'r0=5 is roughly the middle of the quoted 2.8–7.6 range across 12 European countries, so a single preset number is representative rather than tied to one country.',
		context:
			'Estimates from 13 pre-vaccination serological datasets in 12 European countries combined with social-contact survey data; author-institution copy of the published Elsevier article.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: first author E. (Eva) Santermans, Epidemics vol. 11 (2015), DOI 10.1016/j.epidem.2014.12.005; quoted sentence present in the abstract; no retraction notice.'
		}
	},
	{
		id: 'gani-2001-smallpox-r0',
		authors: 'Gani R, Leach S',
		title: 'Transmission potential of smallpox in contemporary populations',
		journal: 'Nature',
		year: 2001,
		evidence: 'study',
		doi: '10.1038/414748a',
		url: 'https://www.nature.com/articles/414748a',
		usedFor: ['smallpox.r0', 'smallpox.about', 'smallpox.coverageToday'],
		quote:
			'Should smallpox recur, such estimates of transmission potential (R0 from 3.5 to 6) predict a reasonably rapid epidemic rise before the implementation of public health interventions, because little residual herd immunity exists now that vaccination has ceased.',
		location: 'Abstract',
		why: "r0=5 is the upper-middle of the quoted 3.5–6 range. The same sentence supports the lesson that population immunity today is negligible. The paper's accompanying point that hospitals roughly doubled early transmission supports treating smallpox spread as concentrated where the very sick are cared for rather than spread evenly by people going about their lives.",
		context:
			'Epidemic modelling of isolated pre-20th-century populations plus 30 sporadic 20th-century European outbreaks; the most cited reconciliation of widely varying earlier R0 claims.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: Nature 414:748–751 (2001), Gani & Leach; quoted abstract sentence confirmed verbatim. A corrigendum (28 February 2002) exists; it is a correction, not a retraction.'
		}
	},
	{
		id: 'cdc-smallpox-signs-symptoms',
		authors: 'Centers for Disease Control and Prevention',
		title: 'Signs and Symptoms of Smallpox',
		journal: 'CDC (cdc.gov)',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/smallpox/signs-symptoms/index.html',
		usedFor: ['smallpox.silentDays', 'smallpox.illDays', 'smallpox.hospitalisedShare', 'smallpox.about'],
		quote: 'At this time, people are usually too sick to carry on their normal activities',
		location: 'Rash stages section (early rash)',
		why: "silentDays=0: the page says 'Smallpox may be contagious during this phase but is most contagious during the next 2 stages', i.e. prodromal transmission is minor, so the preset treats pre-rash infectiousness as zero. illDays=16 is my own pick worked out from the page's timeline — the rash lasts roughly four days before scabbing, 'By the end of the second week after the rash appears, most of the sores have scabbed over', and the person is only 'no longer contagious' once all scabs have fallen off (about three to four weeks); 16 days is a middle value for the practically infectious window. hospitalisedShare=0.9 is my own pick based on the quoted sentence about patients being too sick to carry on normal activities. The same quote is the core evidence that smallpox patients stop mixing, so spread concentrates in households and hospitals.",
		context:
			'CDC clinical description of the eradicated disease, written for health professionals and the public; page last reviewed October 22, 2024.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: title 'Signs and Symptoms of Smallpox | Smallpox | CDC', last reviewed October 22, 2024; the quoted sentence and the phrases 'may be contagious during this phase but is most contagious', 'no longer contagious' and '7 to 19 days' all confirmed verbatim."
		}
	},
	{
		id: 'cdc-smallpox-vaccine',
		authors: 'Centers for Disease Control and Prevention',
		title: 'Smallpox Vaccine',
		journal: 'CDC (cdc.gov)',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/smallpox/vaccines/index.html',
		usedFor: ['smallpox.fullEfficacy', 'smallpox.coverageToday', 'smallpox.vaccines.vaccinia.full.infection'],
		quote:
			'Historically, the vaccine has been effective in preventing smallpox infection in 95% of those vaccinated.',
		location: 'Effectiveness section',
		why: `fullEfficacy=0.95 straight from this sentence. There is no partial course: someone vaccinated decades ago is a waned vaccination, which the vaccine's waningDays covers, and a waned dot keeps its severe protection. The page also states 'Routine smallpox vaccination among the American public stopped in 1972 after the disease was eradicated in the United States', which is the source for almost nobody under about 50 being vaccinated. Its 'about ${SMALLPOX_VACCINE_YEARS[0]} to ${SMALLPOX_VACCINE_YEARS[1]} years' is how long full protection lasts, not a half-life, so waning comes from Nishiura 2006.`,
		context: 'Official CDC page on the smallpox vaccine; last reviewed October 23, 2024.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: phrases '95% of those vaccinated', '3 to 5 years' and 'stopped in 1972' all confirmed verbatim; page last reviewed October 23, 2024."
		}
	},
	{
		id: 'who-smallpox-qa',
		authors: 'World Health Organization',
		title: 'Smallpox (Questions and answers)',
		journal: 'WHO (who.int)',
		year: 2016,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/news-room/questions-and-answers/item/smallpox',
		usedFor: ['smallpox.mortality', 'smallpox.illDays', 'smallpox.coverageToday'],
		quote: 'Smallpox was fatal in up to 30% of cases.',
		location: 'Questions and answers — severity',
		why: "mortality=0.30 taken directly as the historical, untreated variola major case-fatality share. The page's 'The most infectious period is during the first week of illness, although a person with smallpox is still infectious until the last scabs fall off' supports the illDays choice. Its 'Anyone who has been vaccinated against smallpox (in most countries, this means anyone aged 40 or over) will have some level of protection' is the second source for today's low vaccination level — note that the page dates from 2016, so the same cohort is now roughly 50 and over.",
		context: 'WHO Q&A on the eradicated disease; dated 28 June 2016.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: quotes 'fatal in up to 30% of cases', 'most infectious period is during the first week of illness' and 'anyone aged 40 or over' all confirmed verbatim; page dated 28 June 2016, so the age cut-off should be read as 'aged 40 or over in 2016'."
		}
	},
	{
		id: 'cdc-pinkbook-mumps',
		authors: 'Centers for Disease Control and Prevention (Marin M, Leung J, et al., eds.)',
		title: 'Chapter 15: Mumps — Epidemiology and Prevention of Vaccine-Preventable Diseases (Pink Book)',
		journal: 'CDC Pink Book (online edition)',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-15-mumps.html',
		usedFor: [
			'mumps.silentDays',
			'mumps.illDays',
			'mumps.asymptomaticFraction',
			'mumps.mortality',
			'mumps.hospitalisedShare'
		],
		quote: 'Mumps is considered infectious from 2 days before through 5 days after onset of parotitis.',
		location: 'Epidemiology — Transmission; Clinical Features; Vaccine Effectiveness',
		why: "silentDays=2 and illDays=5 read straight off this sentence. asymptomaticFraction=0.20 is the middle of 'approximately 15% to 24% of infections were asymptomatic'. mortality=0.0001 is my own pick: the page only says 'Permanent sequelae and death are very rare in both vaccinated and unvaccinated patients', so I chose a token 1-in-10,000 rather than zero. hospitalisedShare=0.01 is my own pick worked out from 'reported rates of meningitis, encephalitis, pancreatitis, and hearing loss (either transient or permanent) have all been 1% or less' — those are the complications that put someone in a bed. The page also notes 'Since 2006, most cases have been in persons who previously received 2 doses of MMR vaccine', which shows vaccine protection is not permanent (its half-life comes from Lewnard & Grad 2018).",
		context: 'Official US reference text.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice with different questions; the communicability sentence, the '15% to 24%' asymptomatic sentence, the 78%/88% effectiveness sentence, the '1% or less' complication sentence and the 'Since 2006' sentence were all returned verbatim; page last reviewed May 1, 2024; no retraction."
		}
	},
	{
		id: 'gupta-2005-mumps-r0',
		authors: 'Gupta RK, Best J, MacMahon E',
		title: 'Mumps and the UK epidemic 2005',
		journal: 'BMJ',
		year: 2005,
		evidence: 'study',
		noReviewReason: 'No meta-analysis or systematic review of mumps R0 exists (search, 7 Oct 2026).',
		doi: '10.1136/bmj.330.7500.1132',
		url: 'https://www.bmj.com/content/330/7500/1132',
		usedFor: ['mumps.r0'],
		quote:
			'The number of secondary cases of infection expected to result from an index case of mumps in a fully susceptible population (R or basic reproduction number) is 10-12.',
		location: 'Introductory section on epidemiology',
		why: 'r0=11 is the midpoint of the quoted 10–12 range.',
		context:
			'Peer-reviewed BMJ clinical review of mumps epidemiology written during the 2005 UK epidemic; the figure is the standard pre-vaccination estimate, quoted alongside measles at 15–17.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: BMJ 2005;330:1132–1135, Gupta, Best & MacMahon, DOI 10.1136/bmj.330.7500.1132; quoted sentence confirmed verbatim (the article writes 'R' here and 'R0' later for the same quantity); no retraction or correction notice."
		}
	},
	{
		id: 'cdc-pinkbook-pertussis',
		authors: 'Centers for Disease Control and Prevention (Havers FP, Moro PL, Hariri S, Skoff T)',
		title: 'Chapter 16: Pertussis — Epidemiology and Prevention of Vaccine-Preventable Diseases (Pink Book)',
		journal: 'CDC Pink Book (online edition)',
		year: 2022,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-16-pertussis.html',
		usedFor: [
			'pertussis.silentDays',
			'pertussis.illDays',
			'pertussis.mortality',
			'pertussis.hospitalisedShare',
			'pertussis.vaccines.DTaP.seriousPer100kDoses'
		],
		quote:
			'Persons with pertussis are infectious from the beginning of the catarrhal stage through the third week after the onset of paroxysms … Rates of these moderate or severe systemic reactions vary by symptom and vaccine but generally occur in fewer than 1 in 10,000 doses.',
		location:
			'Epidemiology — Transmission; Clinical Features; Vaccine Efficacy; Vaccine Safety (DTaP adverse reactions)',
		why: `illDays=21 read straight off this sentence ('through the third week after the onset of paroxysms'). silentDays=7 is worked out from it together with the page's catarrhal stage duration of 1–2 weeks: infectiousness begins at the start of the catarrhal stage, roughly a week before the recognisable paroxysmal cough, so about 7 days pass before anyone would call it whooping cough. mortality=0.002 is my own value derived from the page's figures of about 15 infant deaths a year against roughly 2,957 reported infant cases a year in 2000–2017 (≈0.5% in infants), scaled down because most reported cases are in older children and adults, among whom deaths are very rare. hospitalisedShare=0.05 is my own pick on the same basis (infant hospitalisations are the bulk of them). The page notes 'Immunity following B. pertussis infection is not permanent.'; the half-lives come from Wendelboe 2005 (infection) and Chit 2018 (vaccine). Vaccine risk: fever of 105°F or higher, febrile seizures, crying for 3 hours or more and floppy episodes occur in fewer than 1 in ${fmt(DTAP_SERIOUS_DOSES)} doses = under ${fmt(100_000 / DTAP_SERIOUS_DOSES)} per 100,000 doses, stored as that upper bound (not all need hospital care). No death caused by DTaP is established (IOM 2003).`,
		context: 'Official US reference text; page last reviewed October 19, 2022.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice with different questions; the communicability sentence, 'Immunity following B. pertussis infection is not permanent.', the 80–85% DTaP efficacy sentence and the infant case/death/hospitalisation counts were all returned verbatim; no retraction."
		}
	},
	{
		id: 'kretzschmar-2010-pertussis-r0',
		authors: 'Kretzschmar M, Teunis PFM, Pebody RG',
		title:
			'Incidence and Reproduction Numbers of Pertussis: Estimates from Serological and Social Contact Data in Five European Countries',
		journal: 'PLoS Medicine',
		year: 2010,
		evidence: 'study',
		noReviewReason: 'No meta-analysis or systematic review of whooping cough R0 exists (search, 7 Oct 2026).',
		doi: '10.1371/journal.pmed.1000291',
		url: 'https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1000291',
		usedFor: ['pertussis.r0', 'pertussis.asymptomaticFraction'],
		quote: 'The basic reproduction numbers are similar across countries at around 5.5.',
		location: 'Abstract — Methods and findings',
		why: "r0=5.5 taken directly. The paper's framing ('continued circulation of the pathogen by mostly asymptomatic and mild infections in adolescents and adults') is also the reason the preset carries a large asymptomatic share.",
		context:
			'Serological data from five European countries combined with social-contact matrices; a next-generation-matrix estimate rather than a single-outbreak figure.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: PLoS Medicine 2010, article e1000291, DOI 10.1371/journal.pmed.1000291, Kretzschmar, Teunis & Pebody; quoted sentence confirmed verbatim; no retraction.'
		}
	},
	{
		id: 'craig-2020-pertussis-asymptomatic',
		authors:
			'Craig R, Kunkel E, Crowcroft NS, Fitzpatrick MC, de Melker H, Althouse BM, Merkel T, Scarpino SV, Koelle K, Friedman L, Arnold C, Bolotin S',
		title: 'Asymptomatic Infection and Transmission of Pertussis in Households: A Systematic Review',
		journal: 'Clinical Infectious Diseases',
		year: 2020,
		evidence: 'systematic-review',
		doi: '10.1093/cid/ciz531',
		url: 'https://academic.oup.com/cid/article-lookup/doi/10.1093/cid/ciz531',
		usedFor: ['pertussis.asymptomaticFraction'],
		quote: 'comprising up to 55.6% of those tested',
		location: 'Abstract — results (asymptomatic household contacts with laboratory-confirmed pertussis)',
		why: "asymptomaticFraction=0.35 is my own pick. The review gives an upper bound, not a pooled estimate: asymptomatic laboratory-confirmed infection reached 55.6% of household contacts tested in the highest study, and mild/atypical illness 'up to 46.2% of all contacts tested'. I chose a value below the maximum because those are ceilings from heterogeneous household studies.",
		context:
			'Systematic review of 26 studies that tested household contacts regardless of symptoms — the best available evidence on silent pertussis infection.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: Clin Infect Dis 2020;70(1):152–161, DOI 10.1093/cid/ciz531, first author Rodger Craig; both the '55.6%' and '46.2%' sentences confirmed verbatim; no retraction. Note the article is dated 2020 in the journal issue although it appeared online in 2019."
		}
	},
	{
		id: 'alimohamadi-2020-covid-r0',
		authors: 'Alimohamadi Y, Taghdir M, Sepandi M',
		title: 'Estimate of the Basic Reproduction Number for COVID-19: A Systematic Review and Meta-analysis',
		journal: 'Journal of Preventive Medicine and Public Health',
		year: 2020,
		evidence: 'meta-analysis',
		doi: '10.3961/jpmph.20.076',
		url: 'https://www.jpmph.org/journal/view.php?doi=10.3961/jpmph.20.076',
		usedFor: ['covid19.r0'],
		quote: 'the pooled R0 for COVID-19 was estimated as 3.32 (95% CI, 2.81 to 3.82)',
		location: 'Abstract — Results',
		why: 'r0=3.32 taken directly as the pooled early-pandemic (ancestral virus) estimate.',
		context:
			'Systematic review and meta-analysis of early 2020 R0 estimates — preferred over any single-country estimate.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: J Prev Med Public Health 2020;53(3):151–157, DOI 10.3961/jpmph.20.076, Alimohamadi, Taghdir & Sepandi; quoted sentence confirmed (printed with '95% CI'); no retraction."
		}
	},
	{
		id: 'byrne-2020-infectious-period',
		authors:
			"Byrne AW, McEvoy D, Collins AB, Hunt K, Casey M, Barber A, Butler F, Griffin J, Lane EA, McAloon C, O'Brien K, Wall P, Walsh KA, More SJ",
		title:
			'Inferred duration of infectious period of SARS-CoV-2: rapid scoping review and analysis of available evidence for asymptomatic and symptomatic COVID-19 cases',
		journal: 'BMJ Open',
		year: 2020,
		evidence: 'review',
		doi: '10.1136/bmjopen-2020-039856',
		url: 'https://bmjopen.bmj.com/content/10/8/e039856',
		usedFor: ['covid19.silentDays', 'covid19omicron.silentDays'],
		quote: 'One study provided approximate median infectious period for asymptomatic cases of 6.5-9.5 days.',
		location: 'Abstract — Results',
		why: "silentDays=2 is the middle of the review's 'Median presymptomatic infectious period across studies varied over <1-4 days'.",
		context:
			'Rapid scoping review pooling virological, contact-tracing and modelling estimates of how long COVID-19 cases are infectious.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: BMJ Open 2020;10:e039856, first author Andrew W. Byrne; both the presymptomatic '<1-4 days' statement and the '6.5-9.5 days' sentence confirmed; no retraction. One caveat: the two reads of the page returned slightly different renderings of the title (the running-head form 'A rapid scoping review of the literature on the infectious period of COVID-19' versus the full article title recorded here), so the title field follows the indexed article title."
		}
	},
	{
		id: 'ward-2024-covid-ihr-ifr',
		authors: 'Ward T, Fyles M, Glaser A, Paton RS, Ferguson W, Overton CE',
		title:
			'The real-time infection hospitalisation and fatality risk across the COVID-19 pandemic in England',
		journal: 'Nature Communications',
		year: 2024,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis of the share of all symptomatic cases admitted to hospital before vaccines was found (search, 7 Oct 2026).',
		doi: '10.1038/s41467-024-47199-3',
		url: 'https://www.nature.com/articles/s41467-024-47199-3',
		usedFor: ['covid19.mortality', 'covid19.hospitalisedShare', 'covid19omicron.hospitalisedShare'],
		quote:
			'The IHR and the IFR in England peaked in January 2021 at 3.39% (95% Credible Intervals (CrI): 2.79, 3.97) and 0.97% (95% CrI: 0.62, 1.36), respectively.',
		location: 'Abstract',
		why: "Both values are worked out from this quote, which is per infection, while the preset is per symptomatic case. With asymptomaticFraction 0.20: mortality = 0.97% / 0.8 = 1.2%, and hospitalisedShare = 3.39% / 0.8 = 4.2%. The January 2021 peak reflects a largely unvaccinated population, closest to the original virus; the paper's later estimates (IFR 0.06%, IHR 0.32%) show how much this fell.",
		context:
			'Bayesian analysis tied to the ONS Coronavirus Infection Survey and REACT, so the denominator is measured infections rather than reported cases.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: Nat Commun 15:4633 (2024), DOI 10.1038/s41467-024-47199-3; quoted sentence confirmed verbatim; no retraction.'
		}
	},
	{
		id: 'chemaitelly-2022-natural-immunity-waning',
		authors:
			'Chemaitelly H, Ayoub HH, Tang P, Coyle P, Yassine HM, Al Thani AA, Al-Kanaani Z, Al-Kuwari E, Jeremijenko A, Kaleeckal AH, Latif AN, Shaik RM, Abdul-Rahim HF, Nasrallah GK, Al-Kuwari MG, Butt AA, Al-Romaihi HE, Al-Thani MH, Al-Khal A, Bertollini R, Abu-Raddad LJ',
		title: 'Duration of immune protection of SARS-CoV-2 natural infection against reinfection',
		journal: 'Journal of Travel Medicine',
		year: 2022,
		evidence: 'study',
		doi: '10.1093/jtm/taac109',
		url: 'https://academic.oup.com/jtm/article-lookup/doi/10.1093/jtm/taac109',
		usedFor: ['covid19.waningDays'],
		quote:
			'Fitting the waning of protection to a Gompertz curve suggested that effectiveness reaches 50% in the 22nd month and < 10% by the 32nd month.',
		location: 'Abstract — Results',
		why: `waningDays comes straight from this sentence: protection reaches 50% in month ${COVID_INFECTION_HALF_LIFE_MONTHS}, so ${COVID_INFECTION_HALF_LIFE_MONTHS} x 365.25 / 12 = ${fmt(COVID_INFECTION_HALF_LIFE_MONTHS * DAYS_PER_MONTH)} days. The preset models immunity as all-or-nothing, so the half-life point is the natural single number to use. Protection against severe reinfection was far more durable (97.3%, with no evidence of waning), which this one-number preset cannot express.`,
		context:
			'Three matched national retrospective cohort studies in Qatar covering February 2020 to June 2022, among unvaccinated people with a documented primary infection.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: J Travel Med 2022;29:taac109, DOI 10.1093/jtm/taac109, first author Hiam Chemaitelly; the '85.5%' and '50% in the 22nd month' sentences confirmed verbatim. A correction dated 28 October 2022 is noted on the record; there is no retraction."
		}
	},
	{
		id: 'who-ebola-factsheet',
		authors: 'World Health Organization',
		title: 'Ebola disease (fact sheet)',
		journal: 'WHO (who.int)',
		year: 2025,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease',
		usedFor: ['ebola.mortality', 'ebola.silentDays', 'ebola.illDays', 'ebola.about'],
		quote: 'The average Ebola disease case fatality rate is around 50%.',
		location: 'Key facts / Transmission',
		why: "mortality=0.50 taken directly (the fact sheet adds 'Case fatality rates have varied from 25-90% in past outbreaks'). silentDays=0 from 'People cannot transmit the disease before they have symptoms.' illDays=10 is my own pick: the fact sheet only says 'they remain infectious as long as their blood contains the virus', with no day count, and 10 days sits between symptom onset and death or recovery. The same page carries the two real exceptions the lesson needs: 'Burial ceremonies that involve direct contact with the body of a person who has died can also contribute to the transmission of Ebola disease' and 'Health and care workers have frequently been infected while treating patients with Ebola disease. This occurs through close contact with patients when infection control precautions are not strictly practiced.' It also notes 'Early intensive supportive care with rehydration and the treatment of symptoms improves survival', which is why outbreaks are deadliest where care is poor.",
		context: "WHO's official fact sheet, last updated 24 April 2025.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: title 'Ebola disease', last updated 24 April 2025; all quoted sentences confirmed. One wording caveat: the infectiousness sentence was rendered as 'People remain infectious as long as their blood contains the virus.' on the first read and 'they remain infectious as long as their blood contains the virus.' on the second (the clause follows the preceding sentence), so the clause form is the one quoted here."
		}
	},
	{
		id: 'vankerkhove-2015-ebola-parameters',
		authors: 'Van Kerkhove MD, Bento AI, Mills HL, Ferguson NM, Donnelly CA',
		title:
			'A review of epidemiological parameters from Ebola outbreaks to inform early public health decision-making',
		journal: 'Scientific Data',
		year: 2015,
		evidence: 'review',
		doi: '10.1038/sdata.2015.19',
		url: 'https://www.nature.com/articles/sdata201519',
		usedFor: ['ebola.r0', 'ebola.mortality'],
		quote: 'estimates of R0 for Ebola Zaire ranged from 1.4-4.7',
		location: 'Results / parameter summary for Zaire ebolavirus',
		why: "r0=1.8 sits in the lower part of the quoted 1.4-4.7 range, matching the West African epidemic's country-level estimates (about 1.7-2.0) rather than the highest historical figures. The same review's 'Ebola Zaire virus is the most lethal with an overall estimated CFR ranging from 69 to 88%' is the basis for the note that untreated historical mortality was far above the WHO 50% average.",
		context:
			'Comprehensive compilation of Ebola epidemiological parameters from 40 years of outbreaks, assembled to parameterise transmission models.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: Scientific Data 2015, article 150019, DOI 10.1038/sdata.2015.19; both the R0 range and the CFR range confirmed; no retraction.'
		}
	},
	{
		id: 'faye-2015-conakry-transmission-chains',
		authors:
			'Faye O, Boelle P-Y, Heleze E, Faye O, Loucoubar C, Magassouba N, Soropogui B, Keita S, Gakou T, Bah EI, Koivogui L, Sall AA, Cauchemez S',
		title:
			'Chains of transmission and control of Ebola virus disease in Conakry, Guinea, in 2014: an observational study',
		journal: 'The Lancet Infectious Diseases',
		year: 2015,
		evidence: 'study',
		doi: '10.1016/S1473-3099(14)71075-8',
		url: 'https://www.thelancet.com/journals/laninf/article/PIIS1473-3099(14)71075-8/fulltext',
		usedFor: ['ebola.about'],
		quote: '82% (119 of 145) of transmission occurred in the community and 72% (105) between family members',
		location: 'Abstract — findings',
		why: "Quantifies where Ebola actually spreads. The same abstract reports each non-health-worker case infecting 'a mean of 2.3 people (95% CI 1.6-3.2): 1.4 (0.9-2.2) in the community, 0.4 (0.1-0.9) in hospitals, and 0.5 (0.2-1.0) at funerals', and that after infection control was introduced 'the reproduction number in hospitals and at funerals reduced to lower than 0.1'. That split supports modelling Ebola as spreading in households, hospitals and funerals rather than through ordinary mixing, and shows those exceptional routes shut down when care and burial practices improve.",
		context:
			'Observational reconstruction of transmission chains for 193 confirmed and probable cases in Conakry and two other Guinean regions in 2014.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: The Lancet Infectious Diseases, published 22 January 2015; the '2.3 people', 'lower than 0.1' and '82% (119 of 145)' quotes all confirmed verbatim; no retraction. The publisher page served to me did not display the full author list, volume or pages, so those citation details come from the indexed record rather than from the page itself."
		}
	},
	{
		id: 'cdc-ervebo-vaccine',
		authors: 'Centers for Disease Control and Prevention',
		title: 'Ebola Vaccine Product Information (ERVEBO)',
		journal: 'CDC (cdc.gov)',
		year: 2025,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/vhf/ebola/clinicians/vaccine',
		usedFor: ['ebola.about'],
		quote: 'No one who was vaccinated immediately developed Ebola disease 10 or more days after vaccination.',
		location: 'Vaccine effectiveness / Guinea ring vaccination trial section',
		why: `The ring-vaccination trial found no cases, which is not a real-world figure, so protection comes from Meakin 2024 (${Math.round(EBOLA_VACCINE.infection * 100)}%). There is no partial course, so partialEfficacy is left out: the page says ERVEBO is approved 'as a single dose administration'. The page also notes 'ERVEBO does not provide protection against other species of orthoebolaviruses or orthomarburgviruses', which is why the Ebola vaccine must not be reused for the Marburg preset.`,
		context: 'CDC clinician page on the licensed Zaire ebolavirus vaccine; last reviewed 30 January 2025.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: title 'Ebola Vaccine Product Information | Ebola | CDC', last reviewed January 30, 2025; the 'single dose administration', 'does not provide protection against other species' and trial-result sentences all confirmed verbatim."
		}
	},
	{
		id: 'who-marburg-factsheet',
		authors: 'World Health Organization',
		title: 'Marburg virus disease (fact sheet)',
		journal: 'WHO (who.int)',
		year: 2025,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/news-room/fact-sheets/detail/marburg-virus-disease',
		usedFor: [
			'marburg.mortality',
			'marburg.silentDays',
			'marburg.illDays',
			'marburg.fullEfficacy',
			'marburg.about'
		],
		quote: 'The average MVD case fatality rate is around 50%.',
		location: 'Key facts / Transmission / Treatment',
		why: "mortality=0.50 taken directly, with the page's 'Case fatality rates have varied from 24% to 88% in past outbreaks.' as the range. silentDays=0 from 'People cannot transmit the disease before they have symptoms.' fullEfficacy is 0, and nobody is vaccinated, because of 'Currently there are no vaccines or antiviral treatments approved for MVD.' The exceptional routes are the same as for Ebola and come from this page: 'Burial ceremonies that involve direct contact with the body of the deceased can also contribute to the transmission of Marburg virus.' and 'Healthcare workers have frequently been infected while treating patients with MVD.' The page's note that 'Early intensive supportive care including rehydration and treatment of specific symptoms, can improve survival' is why outbreaks remain deadliest where care is poor.",
		context: "WHO's official fact sheet, dated 20 January 2025.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: title 'Marburg virus disease', dated 20 January 2025; all seven quoted sentences confirmed verbatim."
		}
	},
	{
		id: 'ajelli-2012-marburg-transmission',
		authors: 'Ajelli M, Merler S',
		title: 'Transmission Potential and Design of Adequate Control Measures for Marburg Hemorrhagic Fever',
		journal: 'PLoS ONE',
		year: 2012,
		evidence: 'study',
		doi: '10.1371/journal.pone.0050948',
		url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0050948',
		usedFor: ['marburg.r0', 'marburg.illDays', 'marburg.about'],
		quote:
			'Such factors, along with the extremely high severity and fatality, support the rare occurrence of large epidemics in human populations.',
		location: 'Abstract',
		why: "r0=1.59 from the abstract's 'the basic reproduction number to be R0 = 1.59 (95%CI: 1.53-1.66)'. illDays=8 is my own pick, derived from the quoted generation-time distribution ('mean 9 days (95%CI: 8.2-10 days)'): if the average gap between one case and the next is 9 days, the infectious window is of that order, and I shortened it slightly because transmission is concentrated in late illness. The quoted sentence is the clearest published statement of the burn-out lesson, and the paper's finding that isolating cases 'no later than 2-3 days after symptoms onset is sufficient to contain an outbreak' shows how little slack such a pathogen has.",
		context:
			'Analysis of the largest documented Marburg epidemic (Angola 2005, 329 deaths) combined with viral-load data from non-human primates.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: PLoS ONE 2012;7(12):e50948, DOI 10.1371/journal.pone.0050948, Ajelli & Merler; the R0, generation-time and 'rare occurrence of large epidemics' quotes all confirmed; no retraction."
		}
	},
	{
		id: 'cdc-pinkbook-rubella',
		authors: 'Centers for Disease Control and Prevention (Hall E, Wodi AP, et al., eds.)',
		title: 'Chapter 20: Rubella — Epidemiology and Prevention of Vaccine-Preventable Diseases (Pink Book)',
		journal: 'CDC Pink Book (online edition)',
		year: 2021,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-20-rubella.html',
		usedFor: [
			'rubella.silentDays',
			'rubella.illDays',
			'rubella.asymptomaticFraction',
			'rubella.mortality',
			'rubella.hospitalisedShare',
			'rubella.about',
			'rubella.vaccines.MMR.waningDays'
		],
		quote:
			'Rubella is most contagious when the rash first appears, but virus may be shed from 7 days before to 7 days after rash onset.',
		location: 'Epidemiology — Transmission; Clinical Features; Vaccine Characteristics',
		why: "silentDays=7 and illDays=7 read straight off this sentence. asymptomaticFraction=0.50 from 'Symptoms are often mild, and up to 50% of infections may be subclinical or inapparent.' The vaccine's waningDays=null from 'Follow-up studies indicate that 1 dose of vaccine confers long-term, probably lifelong, protection.' (immunity after infection comes from WHO 2020) mortality=0.00001 and hospitalisedShare=0.001 are my own picks: the chapter reports no case-fatality or hospitalisation rate, only that encephalitis occurs in about 1 in 6,000 cases and 'may be fatal', so I chose token values well below 1 in 10,000 deaths. The high subclinical share is also the basis for the low bedridden value.",
		context:
			'Official US reference text; page last reviewed August 18, 2021. The serious burden of rubella is congenital rubella syndrome in pregnancy, which this per-case preset does not represent.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: chapter title 'Chapter 20: Rubella', last reviewed August 18, 2021; all four quoted phrases ('7 days before to 7 days after rash onset', 'up to 50% of infections may be subclinical or inapparent', the single-dose seroconversion sentence and 'long-term, probably lifelong, protection') confirmed verbatim; no retraction or withdrawal notice."
		}
	},
	{
		id: 'papadopoulos-2022-rubella-r0',
		authors: 'Papadopoulos T, Vynnycky E',
		title:
			'Estimates of the basic reproduction number for rubella using seroprevalence data and indicator-based approaches',
		journal: 'PLoS Computational Biology',
		year: 2022,
		evidence: 'study',
		noReviewReason: 'No meta-analysis or systematic review of rubella R0 exists (search, 7 Oct 2026).',
		doi: '10.1371/journal.pcbi.1008858',
		url: 'https://researchonline.lshtm.ac.uk/id/eprint/4666072/',
		usedFor: ['rubella.r0'],
		quote: 'R0 was <5, 5-10 and >10 for 81, 14 and 3 settings respectively',
		location: 'Abstract — results',
		why: "r0=5 is worked out from this quote rather than copied: the study reports a distribution over 98 settings, with the large majority below 5, so 5 is a defensible upper-middle single value for a general-audience preset. The preprint version of the same work puts it as 'The basic reproduction number was less than 5 for over half of the settings'.",
		context:
			"Analysis of rubella seroprevalence data from 98 settings using several estimation approaches; published in a peer-reviewed journal (the record read here is the authors' institutional repository entry for it).",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: title, both authors (Timos Papadopoulos; Emilia Vynnycky), PLoS Computational Biology 18 (2022), article e1008858, DOI 10.1371/journal.pcbi.1008858 all confirmed, and the quoted sentence confirmed; no retraction. Caveat: the publisher's own page (journals.plos.org) could not be opened during this session because the fetch proxy rate-limited that domain, so both reads were of the LSHTM repository record, cross-checked once against the bioRxiv preprint of the same study."
		}
	},
	{
		id: 'who-varicella-position-paper-2014',
		authors: 'World Health Organization (Strategic Advisory Group of Experts on Immunization)',
		title: 'Varicella and herpes zoster vaccines: WHO position paper, June 2014',
		journal: 'Weekly Epidemiological Record 89(25):265-288',
		year: 2014,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/publications/i/item/who-wer-8925-265-288',
		usedFor: ['chickenpox.asymptomaticFraction'],
		quote:
			'VZV is a highly contagious herpes virus which causes both varicella (chickenpox), usually during childhood, and herpes zoster (shingles)',
		location: 'Introduction / Epidemiology',
		why: "This is a worked-out value, not a figure any source states: no official source I could read quantifies subclinical primary varicella. It is worked out from two quoted facts. First, this position paper's statement that infection with VZV is what 'causes ... varicella (chickenpox)' in childhood, together with 'In temperate high-income countries in the pre-vaccination era, >90% infections occurred before adolescence' — i.e. essentially the whole susceptible population passes through a recognised illness. Second, the CDC Pink Book's clinically measured household figure, 'Secondary attack rates among susceptible household contacts of persons with varicella are between 61% and 100%': those attack rates are counted from visible disease, and a rate reaching 100% leaves no room for a large silent fraction. 0.05 is therefore a small non-zero allowance for unrecognised or very mild cases rather than a measured share. The paper's separate remark that 'subclinical reinfection is common' is about reinfection of already-immune people, not primary infection, and is deliberately not used here.",
		context:
			"WHO's formal position paper on varicella vaccines, published in the Weekly Epidemiological Record; the global official reference for varicella policy.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice; title confirmed as 'Varicella and herpes zoster vaccines: WHO position paper, June 2014', Weekly Epidemiological Record vol. 89 no. 25, 20 June 2014; the quoted sentence and the '>90% infections occurred before adolescence' and 'usually confers immunity for life' sentences all confirmed verbatim. Quotes were read from the NITAG Resource Centre's copy of the WER issue, because who.int's own item page serves a download rather than readable text; the link points at WHO's own page, confirmed to resolve with the same title and reference number on 2026-10-07; no retraction."
		}
	},
	{
		id: 'who-smallpox-eradication-subclinical',
		authors: 'Fenner F, Henderson DA, Arita I, Jezek Z, Ladnyi ID (World Health Organization)',
		title: 'Smallpox and Its Eradication — Chapter 1: Clinical Features',
		journal: 'World Health Organization, Geneva',
		year: 1988,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://iris.who.int/handle/10665/39485',
		usedFor: ['smallpox.asymptomaticFraction'],
		quote:
			'This serological evidence indicates that subclinical infection that was accompanied by enough replication of virus to stimulate the production of complement-fixing and haemagglutinin-inhibiting antibodies occurred in many of the vaccinated close contacts of cases of variola major.',
		location: 'Chapter 1, Clinical Features — section on subclinical infection',
		why: "smallpox.asymptomaticFraction=0 is worked out from this quote rather than copied. The WHO eradication history records subclinical variola infection as something seen in people who were already protected: it 'occurred in many of the vaccinated close contacts', and 'Variola virus was occasionally recovered from the throat swabs of such subjects, sometimes for several days in succession, but most of them had been vaccinated and never developed symptoms.' It adds only 'suggestive but inconclusive evidence that inapparent infection occurred among subjects who had recovered from smallpox years before.' In an unvaccinated, previously uninfected population — which is what the preset models, and what today's population is — silent infection is not a documented phenomenon, so 0 is the right value. If a scenario included vaccinated contacts, a small silent fraction would belong among them.",
		context:
			"The official WHO history of smallpox and its eradication, the standard reference for a disease that can no longer be studied; linked at WHO's own repository record.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice (the second read requested the full sentences with no ellipses); all three sentences confirmed word for word, and the file identified as Chapter 1 (Clinical Features) of 'Smallpox and Its Eradication'. Quotes were read from the LSU Law Center's public mirror of the chapter; the link points at WHO's IRIS record, confirmed on 2026-10-07 to be 'Smallpox and its eradication' (Fenner, Henderson, Arita, Jezek, Ladnyi; WHO, 1988). Caveat: the mirror serves the chapter PDF without its title page, so the editors, publisher and 1988 date come from the standard citation for the work rather than from the page itself; no retraction (and none is possible for a 1988 WHO monograph)."
		}
	},
	{
		id: 'cdc-smallpox-clinical-signs',
		authors: 'Centers for Disease Control and Prevention',
		title: 'Clinical Signs and Symptoms of Smallpox',
		journal: 'CDC (cdc.gov)',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/smallpox/hcp/clinical-signs/index.html',
		usedFor: ['smallpox.waningDays', 'smallpox.silentDays', 'smallpox.mortality'],
		quote: 'Recovery from smallpox gives the patient prolonged immunity to re-infection with variola virus.',
		location: 'Clinical course / immunity',
		why: "waningDays=null follows from this sentence: CDC describes immunity after recovery as 'prolonged', with no stated end, so for a simulator that models immunity as either present or gone, treating survivor immunity as not waning is the faithful reading. ('Prolonged' is weaker than 'lifelong', so this is the one place in the smallpox preset where null is a simplification of the source.) The page also independently supports two values already in the preset: silentDays=0, from 'During this time, the infected person does not have symptoms, is not contagious, and may feel fine', and mortality=0.30, from 'the case-fatality rate differed for the different clinical forms, but it was approximately 30% overall in unvaccinated individuals.'",
		context: "CDC's clinician-facing clinical description of smallpox; last reviewed October 23, 2024.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened: title 'Clinical Signs and Symptoms of Smallpox | Smallpox | CDC', last reviewed October 23, 2024; all three quoted sentences confirmed verbatim. Both reads also confirmed that the page makes no claim that asymptomatic variola infection did not occur, which is why that value rests on the WHO eradication history instead."
		}
	},
	{
		id: 'buitrago-garcia-2020-asymptomatic-sars-cov-2',
		authors: 'Buitrago-Garcia D, Egli-Gany D, Counotte MJ, Hossmann S, Imeri H, Ipekci MA, Salanti G, Low N',
		title:
			'Occurrence and transmission potential of asymptomatic and presymptomatic SARS-CoV-2 infections: A living systematic review and meta-analysis',
		journal: 'PLOS Medicine 17(9):e1003346',
		year: 2020,
		evidence: 'meta-analysis',
		doi: '10.1371/journal.pmed.1003346',
		usedFor: ['covid19.asymptomaticFraction', 'covid19.hospitalisedShare'],
		quote:
			'The overall estimate of the proportion of people who become infected with SARS-CoV-2 and remain asymptomatic throughout infection was 20% (95% confidence interval [CI] 17–25)',
		location: 'Abstract — results',
		why: "covid19.asymptomaticFraction=0.20 taken directly from this pooled estimate. The same abstract is also relevant to how the model treats silent cases: 'The secondary attack rate was slightly lower in contacts of people with asymptomatic infection than those with symptomatic infection (relative risk 0.35, 95% CI 0.10-1.27)' — asymptomatic COVID-19 cases do transmit, unlike the filovirus picture below, but less efficiently.",
		context:
			'Living systematic review and meta-analysis (94 studies), Institute of Social and Preventive Medicine, Bern; ancestral virus, 2020.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			note: 'Quote re-checked against the peer-reviewed PLOS Medicine version on 2026-10-07 (earlier checks used the medRxiv v3 preprint of the same review, same 20% figure).',
			ok: true
		}
	},
	{
		id: 'glynn-2017-asymptomatic-ebola',
		authors:
			'Glynn JR, Bower H, Johnson S, Houlihan CF, Montesano C, Scott JT, Semple MG, Bangura MS, Kamara AJ, Kamara O, Mansaray SH, Sesay D, Turay C, Dicks S, Guetiya Wadoum RE, Colizzi V, Checchi F, Samuel D, Tedder RS',
		title:
			'Asymptomatic infection and unrecognised Ebola virus disease in Ebola-affected households in Sierra Leone: a cross-sectional study using a new non-invasive assay for antibodies to Ebola virus',
		journal: 'The Lancet Infectious Diseases',
		year: 2017,
		evidence: 'study',
		doi: '10.1016/S1473-3099(17)30111-1',
		url: 'https://discovery-pp.ucl.ac.uk/id/eprint/1544866/1/Houlihan-C_asymptomatic%20infection_Ebola%20virus.pdf',
		usedFor: ['ebola.asymptomaticFraction', 'marburg.asymptomaticFraction', 'ebola.about'],
		quote:
			'This new highly specific and sensitive assay showed asymptomatic infection with Ebola virus was uncommon despite high exposure.',
		location: 'Abstract — interpretation',
		why: "This is the study behind the recommendation to set ebola.asymptomaticFraction to 0 in this model. Measured share: 'Among asymptomatic contacts, 2.6% (1.2-4.7; 10 of 388) with no symptoms tested positive.' Epidemiological weight: 'The low prevalence suggests asymptomatic infection contributes little to herd immunity in Ebola, and even if infectious, would account for few transmissions.' Since this simulator keeps asymptomatic cases infectious and mobile, carrying a 27% silent fraction (the Dean 2016 meta-analysis figure used earlier in this document) would make the model assert silent Ebola spreaders, which no study has demonstrated; 0 is the honest setting, and 0.026 is the alternative if a non-infectious silent compartment is wanted. The same reasoning is applied to Marburg by analogy, supported by its even lower seroprevalence.",
		context:
			'Cross-sectional study of 481 household contacts of survivors from the Kerry Town Ebola Treatment Centre, using an oral-fluid anti-glycoprotein IgG assay validated at 100% specificity and 95.9% sensitivity — the most direct test of whether silent Ebola infection happens.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice: The Lancet Infectious Diseases, published online 27 February 2017, DOI 10.1016/S1473-3099(17)30111-1, first author Judith R Glynn; all three quoted sentences confirmed verbatim; no retraction. Read from UCL Discovery's open-access copy of the accepted article because thelancet.com returned 403 to this session."
		}
	},
	{
		id: 'rimoin-2018-ebola-antibodies-40-years',
		authors:
			'Rimoin AW, Lu K, Bramble MS, Steffen I, Doshi RH, Hoff NA, Mukadi P, Nicholson BP, Alfonso VH, Olinger G, Sinai C, Bomponda PL, Kabamba J, Lokonga JP, Muyembe-Tamfum JJ, Simmons G, Wright LL, Schieffelin JS',
		title:
			'Ebola Virus Neutralizing Antibodies Detectable in Survivors of the Yambuku, Zaire Outbreak 40 Years after Infection',
		journal: 'The Journal of Infectious Diseases',
		year: 2018,
		evidence: 'study',
		noReviewReason:
			'No review of how long immunity lasts after Ebola was found; this long follow-up study is the best evidence.',
		doi: '10.1093/infdis/jix584',
		url: 'https://academic.oup.com/jid/article-lookup/doi/10.1093/infdis/jix584',
		usedFor: ['ebola.waningDays'],
		quote:
			"Interestingly, a subset of these survivors' serum antibodies could still neutralize live virus 40 years postinitial infection.",
		location: 'Abstract — results',
		why: "waningDays=null is worked out from this quote. The study followed survivors of the first recorded Ebola outbreak (Yambuku, 1976) and 'extend[ed] the known duration of response from 11 years postinfection to at least 40 years after symptomatic infection', with 86% (12/14) still reactive to glycoprotein. Forty years of detectable neutralising antibody is longer than any epidemic a simulator will run, so modelling survivor immunity as not waning is faithful. Two caveats a careful reader should keep: antibody persistence is a correlate of protection, not a demonstration of it, and only a subset (4 of 14) still neutralised live virus.",
		context:
			'Serological follow-up of 14 survivors of the 1976 Yambuku outbreak in the Democratic Republic of the Congo, four decades later.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice: J Infect Dis 2018;217(2):223-231, DOI 10.1093/infdis/jix584, first author Anne W. Rimoin; the '40 years postinitial infection' sentence and the 'from 11 years postinfection to at least 40 years' statement confirmed verbatim; no retraction."
		}
	},
	{
		id: 'who-ebola-treatment-centre',
		authors: 'World Health Organization',
		title: 'Ebola disease (fact sheet)',
		journal: 'WHO (who.int)',
		year: 2025,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease',
		usedFor: ['ebola.hospitalisedShare'],
		quote:
			'Patients should be isolated in a designated treatment centre for early care and to avoid transmission at home.',
		location: 'Prevention and control',
		why: "hospitalisedShare=1 follows from this sentence read together with 'Early intensive supportive care including rehydration and treatment of specific symptoms, can improve survival.' WHO's advice is that every patient — suspected as well as confirmed — belongs in a treatment centre bed, both for their own survival and to stop household transmission. There is no mild, treat-at-home tier of symptomatic Ebola in this guidance, so every symptomatic case in the model should occupy a bed. The second half of the quoted sentence is also the mechanism behind the burn-out lesson: a bed is simultaneously treatment and removal from the mixing population.",
		context:
			"WHO's official Ebola fact sheet, last updated 24 April 2025; same page as the Ebola transmission and fatality quotes earlier in this document, cited separately here for the bed-occupancy value.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened specifically for this quote: 'Patients should be isolated in a designated treatment centre for early care and to avoid transmission at home.' confirmed verbatim, as was the supportive-care sentence; page title 'Ebola disease', last updated 24 April 2025."
		}
	},
	{
		id: 'semancik-2024-filovirus-seroprevalence',
		authors:
			'Semancik CS, Whitworth HS, Price MA, Yun H, Postler TS, Zaric M, Kilianski A, Cooper CL, Kuteesa M, Talasila S, Malkevich N, Gupta SB, Francis SC',
		title:
			'Seroprevalence of Antibodies to Filoviruses with Outbreak Potential in Sub-Saharan Africa: A Systematic Review to Inform Vaccine Development and Deployment',
		journal: 'Vaccines',
		year: 2024,
		evidence: 'systematic-review',
		doi: '10.3390/vaccines12121394',
		url: 'https://www.mdpi.com/2076-393X/12/12/1394',
		usedFor: ['marburg.asymptomaticFraction'],
		quote: 'with MARV seroprevalence mostly ranging from 0 to 3%',
		location: 'Abstract — results (third finding)',
		why: "marburg.asymptomaticFraction=0 is worked out from this quote. The review found Marburg antibody seroprevalence 'substantially lower than EBOV or SUDV antibody seroprevalence, even in outbreak-affected areas and in populations at a moderate or high risk of infection', mostly 0-3%. Since the directly measured Ebola evidence (Glynn 2017) shows silent filovirus infection is uncommon and would account for few transmissions even if infectious, and Marburg's seroprevalence is lower still, 0 is the honest setting for a model in which silent cases keep spreading. 0.03 is the alternative if a non-infectious silent compartment is wanted. The review is candid about the gap: 'little is known about the burden of asymptomatic infection or undiagnosed disease'.",
		context:
			'PROSPERO-registered systematic review (CRD42023415358) of 87 articles reporting filovirus antibody seroprevalence across sub-Saharan Africa, written to inform vaccine trial design.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice: Vaccines 2024;12(12):1394, DOI 10.3390/vaccines12121394; both the '0 to 3%' and 'little is known about the burden of asymptomatic infection' quotes confirmed verbatim; no retraction. Minor caveat: the two reads rendered the author list differently (the second named the last author, Suzanna C. Francis, as 'first author'); the order recorded here follows the article's own byline, with Semancik first and Francis senior."
		}
	},
	{
		id: 'natesan-2016-filovirus-antibody-persistence',
		authors:
			'Natesan M, Jensen SM, Keasey SL, Kamata T, Kuehne AI, Stonier SW, Lutwama JJ, Lobel L, Dye JM, Ulrich RG',
		title:
			'Human Survivors of Disease Outbreaks Caused by Ebola or Marburg Virus Exhibit Cross-Reactive and Long-Lived Antibody Responses',
		journal: 'Clinical and Vaccine Immunology',
		year: 2016,
		evidence: 'study',
		noReviewReason:
			'No review of how long immunity lasts after Marburg was found; this follow-up study is the best evidence.',
		doi: '10.1128/CVI.00107-16',
		url: 'https://journals.asm.org/doi/10.1128/CVI.00107-16',
		usedFor: ['marburg.waningDays'],
		quote:
			'persistent levels of antibodies to GP, NP, and VP40 were maintained for up to 14 years after infection',
		location: 'Abstract / results summary',
		why: 'marburg.waningDays=null is worked out from this quote. The study profiled survivors of Marburg, Sudan and Bundibugyo outbreaks in Uganda and found antibody responses lasting up to 14 years, far longer than any run of this simulator, so treating survivor immunity as not waning is faithful to the evidence. Two honest limits: the longest intervals in the study are for Sudan virus survivors (12-14 years) and Bundibugyo (7 years), while the Marburg samples were collected about a year after infection, so the 14-year figure is a filovirus finding rather than a Marburg-specific one; and antibody persistence is a correlate of protection, not proof of it. A separate study of Marburg survivors found neutralising-antibody responses to be limited, so this value is the least firmly grounded in the whole set.',
		context:
			'Proteome-wide antibody profiling of filovirus survivors from Ugandan outbreaks, carried out by USAMRIID with Makerere University and Ben-Gurion University collaborators.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Opened twice: Clin Vaccine Immunol 2016;23(8), DOI 10.1128/CVI.00107-16, first author Mohan Natesan; the 'up to 14 years after infection' quote confirmed verbatim both times; no retraction (the article carries a 'Spotlight Selection' designation). The caveat about which cohort supplies the 14-year interval is recorded in the why field rather than hidden."
		}
	},
	{
		id: 'who-marburg-treatment-centre',
		authors: 'World Health Organization',
		title: 'Marburg virus disease (fact sheet)',
		journal: 'WHO (who.int)',
		year: 2025,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/news-room/fact-sheets/detail/marburg-virus-disease',
		usedFor: ['marburg.hospitalisedShare'],
		quote:
			'Patients suspected or confirmed for MVD should be isolated in a designated treatment centre for early care and to avoid transmission at home.',
		location: 'Treatment and vaccines',
		why: "hospitalisedShare=1 follows from this sentence together with 'Early intensive supportive care including rehydration and treatment of specific symptoms, can improve survival.' As with Ebola, WHO's guidance admits every symptomatic patient to a treatment centre rather than leaving a mild tier at home, so every symptomatic case in the model should occupy a bed — and because there is no approved vaccine or antiviral for Marburg, that bed is the entire intervention.",
		context:
			"WHO's official Marburg fact sheet, dated 20 January 2025; same page as the Marburg transmission and fatality quotes earlier in this document, cited separately here for the bed-occupancy value.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Re-opened specifically for this quote: the isolation sentence and the supportive-care sentence both confirmed verbatim in the 'Treatment and vaccines' section; page title 'Marburg virus disease', dated 20 January 2025."
		}
	},
	{
		id: 'meyerowitzkatz2020-covid-ifr',
		authors: 'Meyerowitz-Katz G, Merone L',
		title:
			'A systematic review and meta-analysis of published research data on COVID-19 infection fatality rates',
		journal: 'International Journal of Infectious Diseases',
		year: 2020,
		evidence: 'meta-analysis',
		doi: '10.1016/j.ijid.2020.09.1464',
		usedFor: [
			'covid19.infectionFatalityRate',
			'covid19.mortality',
			'covid19omicron.infectionFatalityRate',
			'covid19omicron.mortality'
		],
		quote:
			'The meta-analysis demonstrated a point estimate of IFR of 0.68% (0.53%-0.82%) with high heterogeneity (p < 0.001).',
		location: 'Abstract (results)',
		why: 'Meta-analysis of the infection fatality rate before vaccines. The infection fatality rate 0.68% is stored as covid19.infectionFatalityRate; mortality per symptomatic case is worked out in config as 0.68% / (1 - asymptomaticFraction 0.2) = 0.85%.',
		context: 'Studies from many countries, 2020, before vaccines',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; doi.org resolved (302); no retraction found by web search.'
		}
	},
	{
		id: 'alene2021-covid-serial-incubation',
		authors: 'Alene M, Yismaw L, Assemie MA, Ketema DB, Gietaneh W, Birhan TY',
		title: 'Serial interval and incubation period of COVID-19: a systematic review and meta-analysis',
		journal: 'BMC Infectious Diseases',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1186/s12879-021-05950-x',
		usedFor: ['covid19.silentDays', 'covid19omicron.silentDays'],
		quote: 'the weighted pooled mean serial interval of COVID-19 was 5.2 (95%CI: 4.9-5.5) days',
		location:
			'Abstract (results); the same abstract gives a pooled incubation period of 6.5 (95%CI: 5.9-7.1) days',
		why: 'Meta-analysis: the pooled serial interval (5.2 days) is shorter than the incubation period (6.5 days), so people infect others about 1.3 days before symptoms. Supports a silent contagious phase of about 2 days.',
		context: 'Studies from many countries, 2020',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; doi.org check rate-limited (429), DOI from Consensus record; no retraction found by web search.'
		}
	},
	{
		id: 'rahmani-a-2022-covid-shedding',
		authors: 'Rahmani A, Dini G, Leso V, Montecucco A, Kusznir Vitturi B, Iavicoli I, Durando P',
		title:
			'Duration of SARS-CoV-2 shedding and infectivity in the working age population: a systematic review and meta-analysis',
		journal: 'La Medicina del Lavoro',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.23749/mdl.v113i2.12724',
		url: 'https://mattioli1885journals.com/index.php/lamedicinadellavoro/article/view/12724',
		mirrorUrl: 'https://iris.unige.it/retrieve/9b992393-39f0-41b6-8aaa-2e00efada06c/03-mdl-12724-1.pdf',
		usedFor: ['covid19.illDays'],
		quote:
			'Overall, a mean duration of RT-PCR positivity after symptom onset was found equal to 27.9 days (95%CI 23.3-32.5), while the mean duration of replicant competent virus isolation was 7.3 days (95%CI 5.7-8.8).',
		location: 'Abstract (Results)',
		why: "A pooled mean of how long live virus can be grown after symptoms start (7.3 days), so it matches the Omicron figure (Wu 2023, 5.16 days), which is also a pooled mean of live virus. Measured slightly differently: this counts from symptom onset to the last positive culture, while Wu counts from the earlier of onset or first positive test to the day after the last positive culture, so on Wu's clock this would be about a day longer. No review pools the 2020 virus on Wu's exact clock (search, 7 Oct 2026).",
		context:
			'Studies published 1 Dec 2019 to 10 Sep 2021, before Omicron; 20 studies, 866 people, mostly working age. The immunocompetent subgroup mean is 6.3 days.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Checked in two copies: the publisher record page (Med Lav 2022;113(2):e2022014) and the publisher PDF in the University of Genoa repository; authors, year, journal and DOI match and the quote is verbatim; no correction or retraction found. doi.org itself was blocked.'
		}
	},
	{
		id: 'cevik2021-covid-shedding',
		authors: 'Cevik M, Tate M, Lloyd O, Maraolo AE, Schafers J, Ho A',
		title:
			'SARS-CoV-2, SARS-CoV, and MERS-CoV viral load dynamics, duration of viral shedding, and infectiousness: a systematic review and meta-analysis',
		journal: 'The Lancet Microbe',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1016/s2666-5247(20)30172-5',
		usedFor: ['covid19.about'],
		quote:
			'No study detected live virus beyond day 9 of illness, despite persistently high viral loads, which were inferred from cycle threshold values.',
		location: 'Abstract (findings)',
		why: 'About-page context: no live virus was found after day 9 of illness, although tests stayed positive far longer. It pools only how long tests stay positive, not how long live virus lasts, so the contagious days come from Rahmani 2022 instead.',
		context: 'Studies from many countries, 2020',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; doi.org resolved (302); no retraction found by web search. Published online 2020, issue 2021.'
		}
	},
	{
		id: 'stein2023-covid-past-infection',
		authors: 'COVID-19 Forecasting Team (Stein C, Nassereldine H, Sorensen RJD, et al.)',
		title: 'Past SARS-CoV-2 infection protection against re-infection: a systematic review and meta-analysis',
		journal: 'The Lancet',
		year: 2023,
		evidence: 'meta-analysis',
		doi: '10.1016/s0140-6736(22)02465-5',
		usedFor: [
			'covid19.waningDays',
			'covid19.afterInfection.infection',
			'covid19.afterInfection.severe',
			'covid19omicron.afterInfection.infection',
			'covid19omicron.afterInfection.severe'
		],
		quote:
			'Protection from re-infection from ancestral, alpha, and delta variants declined over time but remained at 78·6% (49·8-93·6) at 40 weeks. Table S2, week 40: ancestral, Alpha and Delta reinfection 78.6% (49.8-93.6), severe disease 90.2% (69.7-97.5); Omicron BA.1 reinfection 36.1% (24.4-51.3), severe disease 88.9% (84.7-90.9).',
		location: 'Abstract (findings); appendix Table S2 (starts p 50; week-40 row p 62)',
		why: `Meta-analysis: protection from a past infection stayed at ${fmt(STEIN_40_WEEKS.preOmicron.reinfection * 100, 1)}% at ${STEIN_40_WEEKS.weeks} weeks against pre-Omicron variants, consistent with protection falling to about half after roughly two years (${fmt(COVID_INFECTION_HALF_LIFE_MONTHS * DAYS_PER_MONTH)} days, from Chemaitelly 2022). Reinfection and severe protection come from the same table and the same week (${STEIN_40_WEEKS.weeks}), so the protection against severe illness left for a reinfection is worked out as 1 - (1 - severe) / (1 - reinfection): ${fmt(breakthroughSevereProtection(STEIN_40_WEEKS.preOmicron.reinfection, STEIN_40_WEEKS.preOmicron.severe), 3)} before Omicron and ${fmt(breakthroughSevereProtection(STEIN_40_WEEKS.ba1.reinfection, STEIN_40_WEEKS.ba1.severe), 3)} for BA.1. The BA.1 pair is protection from mostly pre-Omicron infections against BA.1 reinfection, not Omicron against Omicron.`,
		context:
			'Studies from many countries; non-vaccinated comparisons or studies adjusted for vaccination; hybrid immunity excluded',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Appendix Table S2 week 40 (p 62): reinfection 78.6% / 36.1% (BA.1), severe 90.2% / 88.9%; Methods vaccination wording confirmed; not retracted.'
		}
	},
	{
		id: 'muzembo2024-ebola-r0',
		authors: 'Muzembo BA, Kitahara K, Ntontolo NP, Ohno A, Khatiwada J, Dutta S, Miyoshi SI',
		title: 'The basic reproduction number (R0) of ebola virus disease: a systematic review and meta-analysis',
		journal: 'Travel Medicine and Infectious Disease',
		year: 2024,
		evidence: 'meta-analysis',
		doi: '10.1016/j.tmaid.2023.102685',
		usedFor: ['ebola.r0'],
		quote: 'The overall pooled mean Ebola R0 was 1.95 (95 % CI 1.74-2.15)',
		location: 'Abstract (results)',
		why: 'Meta-analysis of Ebola R0 estimates; the pooled mean 1.95 is used.',
		context: 'Ebola outbreaks in Africa, 1976-2022',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; doi.org check rate-limited (429), DOI from Consensus record; no retraction found by web search.'
		}
	},
	{
		id: 'costantino2018-smallpox-r0',
		authors: 'Costantino V, Kunasekaran MP, Chughtai AA, MacIntyre CR',
		title:
			'How Valid Are Assumptions About Re-emerging Smallpox? A Systematic Review of Parameters Used in Smallpox Mathematical Models',
		journal: 'Military Medicine',
		year: 2018,
		evidence: 'systematic-review',
		doi: '10.1093/milmed/usx092',
		usedFor: ['smallpox.r0'],
		quote:
			'In 25/34 studies, R0 ranged between 3 and 5, generally lower than the R0 calculated from past outbreaks.',
		location: 'Abstract (results)',
		why: 'Systematic review of smallpox models: most used R0 between 3 and 5. The value 5 sits at the top of that range, matching Gani 2001 from historical outbreaks in unvaccinated populations.',
		context: 'Modelling studies of smallpox in modern populations',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; no retraction found by web search; doi.org not checked separately.'
		}
	},
	{
		id: 'dean2016-ebola-asymptomatic',
		authors: 'Dean NE, Halloran ME, Yang Y, Longini IM',
		title:
			'Transmissibility and Pathogenicity of Ebola Virus: A Systematic Review and Meta-analysis of Household Secondary Attack Rate and Asymptomatic Infection',
		journal: 'Clinical Infectious Diseases',
		year: 2016,
		evidence: 'meta-analysis',
		doi: '10.1093/cid/ciw114',
		usedFor: ['ebola.asymptomaticFraction', 'ebola.about'],
		quote:
			'We estimate that 27.1% (95% CI, 14.5%-39.6%) of Ebola infections are asymptomatic. … The greatest risk factor was the provision of nursing care (SAR, 47.9% [95% CI, 23.3%-72.6%]).',
		location: 'Abstract (results)',
		why: "Meta-analysis: about 27% of Ebola infections have no symptoms, but there is no evidence those people pass it on. The model sets asymptomaticFraction to 0 because it only counts cases that spread the disease; the About page says so. About page: the strongest single piece of evidence that Ebola spreads almost only to people physically caring for someone too ill to move, set against 'little transmission occurring in its absence (SAR, 0.8% [95% CI, 0%-2.3%])'. Its 27% asymptomatic estimate is not used: Glynn 2017 found silent infection uncommon, and no study shows silent cases spreading it.",
		context: 'Ebola serosurveys, Africa',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; no retraction found by web search; doi.org not checked separately.'
		}
	},
	{
		id: 'cuomodannenburg2024-marburg-review',
		authors: 'Cuomo-Dannenburg G, McCain K, McCabe R, Unwin HJT, Doohan P, Nash RK, et al.',
		title:
			'Marburg virus disease outbreaks, mathematical models, and disease parameters: a systematic review',
		journal: 'The Lancet Infectious Diseases',
		year: 2024,
		evidence: 'systematic-review',
		doi: '10.1016/s1473-3099(23)00515-7',
		usedFor: ['marburg.r0'],
		quote: 'Only one study presented a mathematical model of Marburg virus transmission.',
		location:
			'Abstract; the main text (full-text excerpt) adds "Reproduction number estimates were reported in two studies"',
		why: 'Systematic review of Marburg parameters: it confirms there is no pooled R0, only two studies reporting one, so the single-study value stays.',
		context: 'Marburg outbreaks, 1967-2023',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote checked in full-text excerpt via Consensus; indexed in PubMed (38040006) and PMC (PMC7615873) per web search, no retraction found; doi.org not checked separately.'
		}
	},
	{
		id: 'perez-guzman-2023-omicron',
		authors: 'Perez-Guzman PN, Knock E, Imai N, et al.',
		title: 'Epidemiological drivers of transmissibility and severity of SARS-CoV-2 in England',
		journal: 'Nature Communications',
		year: 2023,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis gives Omicron R0 or severity in people with no immunity; pooled severity studies compare Omicron with Delta in partly immune populations.',
		doi: '10.1038/s41467-023-39661-5',
		usedFor: [
			'covid19omicron.r0',
			'covid19omicron.infectionFatalityRate',
			'covid19omicron.hospitalisedShare',
			'covid19omicron.mortality',
			'covid19omicron.mortalityByAge',
			'covid19omicron.hospitalisedByAge'
		],
		quote:
			'Omicron (BA.1) had the highest basic reproduction number at 8.4 (95% credible interval (CrI) 7.8-9.1).',
		location:
			'Abstract, as corrected by the Author Correction (Nat Commun 2023, doi 10.1038/s41467-023-44062-9); the same abstract gives the basic infection fatality ratio as 1.2% for wildtype and 0.7% for Omicron',
		why: 'R0 8.4 from the corrected abstract. Severity: Omicron infection fatality = original x (0.7 / 1.2) = 0.583, applied to the original-virus infection fatality and hospital rates (worked out). Applying the same ratio to hospital admission is an assumption; the About page says so.',
		context: 'England, 2020-2022, adjusted for immunity',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote taken from the Author Correction, which changes R0 from 8.3 to 8.4 and keeps the 1.2% and 0.7% figures.'
		}
	},
	{
		id: 'liu-rocklov-2022-omicron-r',
		authors: 'Liu Y, Rocklöv J',
		title:
			'The effective reproductive number of the Omicron variant of SARS-CoV-2 is several times relative to Delta',
		journal: 'Journal of Travel Medicine',
		year: 2022,
		evidence: 'review',
		doi: '10.1093/jtm/taac037',
		usedFor: ['covid19omicron.r0'],
		quote: 'The Omicron variant has an average basic and effective reproduction number of 8.2 and 3.6.',
		location: 'Abstract',
		why: 'Review that agrees with an Omicron R0 of about 8.',
		context: 'Studies of Omicron, 2021-2022',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Second search record matched title, authors, year, DOI and quote. Retraction check through Crossref/PMC was not possible (rate limit and captcha); no retraction notice seen in the search record.'
		}
	},
	{
		id: 'wu-2022-incubation-variants',
		authors: 'Wu Y, Kang L, Guo Z, Liu J, Liu M, Liang W',
		title:
			'Incubation Period of COVID-19 Caused by Unique SARS-CoV-2 Strains: A Systematic Review and Meta-analysis',
		journal: 'JAMA Network Open',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1001/jamanetworkopen.2022.28008',
		usedFor: ['covid19omicron.silentDays'],
		quote: '3.42 days (95% CI, 2.88-3.96 days) for the Omicron variant',
		location: 'Abstract, Results',
		why: 'Pooled Omicron incubation period, 3.42 days. Together with the pooled serial interval (Madewell 2023, 3.2 days) it gives the gap behind silentDays.',
		context: 'Studies from many countries, 2020-2022',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Second search record matched. Retraction check through Crossref/PMC was not possible (rate limit and captcha); no retraction notice seen in the search record.'
		}
	},
	{
		id: 'shang-2022-omicron-asymptomatic',
		authors: 'Shang W, Kang L, Cao G, et al.',
		title:
			'Percentage of Asymptomatic Infections among SARS-CoV-2 Omicron Variant-Positive Individuals: A Systematic Review and Meta-Analysis',
		journal: 'Vaccines',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.3390/vaccines10071049',
		usedFor: ['covid19omicron.asymptomaticFraction'],
		quote:
			'The pooled percentage of asymptomatic infections was 32.40% (95% CI: 25.30−39.51%) among SARS-CoV-2 Omicron variant-positive individuals.',
		location: 'Abstract, Results',
		why: '0.324 directly.',
		context: 'Studies from many countries, 2021-2022',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Second search record matched. Retraction check through Crossref/PMC was not possible (rate limit and captcha); no retraction notice seen in the search record.'
		}
	},
	{
		id: 'mohammed-2023-omicron-ve',
		authors: 'Mohammed H, Pham-Tran DD, Yeoh ZYM, Wang B, McMillan M, Andraweera PH, Marshall HS',
		title:
			'A Systematic Review and Meta-Analysis on the Real-World Effectiveness of COVID-19 Vaccines against Infection, Symptomatic and Severe COVID-19 Disease Caused by the Omicron Variant (B.1.1.529)',
		journal: 'Vaccines',
		year: 2023,
		evidence: 'meta-analysis',
		doi: '10.3390/vaccines11020224',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9965204/',
		usedFor: [
			'covid19omicron.vaccines.covid-original.full.severe',
			'covid19omicron.vaccines.covid-updated.full.severe'
		],
		quote:
			'VE against severe Omicron infection decreased from 63.6% (95%CI: 57.5–69.7%) at three months to 48.3% (95%CI: 39.0–57.6%) at six months following the primary vaccination series (Figure 5).',
		location:
			"Results 3.2.3 (severe disease by time since the course); overall figures in 3.2.1 and 3.2.3. Symptomatic infection, 3.2.2: 'The pooled VE estimate against symptomatic Omicron infection for all ages and vaccine types was 23.4% (95%CI: 13.5–33.3%, I2 = 99.6%)'.",
		why: `A full course of the original vaccine against severe Omicron disease, compared with unvaccinated people: ${OMICRON_VACCINE.originalSevere} at three months, near the dose like the infection figure from Menegale 2023. The review's overall figures, ${MOHAMMED_AVERAGED.infection} against any infection and ${MOHAMMED_AVERAGED.severe} against severe disease, average over months of waning, and the sim adds its own waning, so starting from them would count waning twice. The updated vaccine's protection is worked out on top of this (Cheng 2024), so old and new vaccines sit on the same footing.`,
		context:
			"Search to 1 Aug 2022 (BA.1/BA.2). Full course, 14 days or more after it; comparator unvaccinated. 'Any type' means studies did not say whether people had symptoms. Pools mRNA, AZD1222, CoronaVac and Ad26 courses, so not mRNA-only (BNT162b2 alone 38.1% against any infection). Severe disease is a composite (hospitalisation 59.1%, emergency department 14.2%, ventilation 14.2%, ICU 6.1%, death 6.1%), pooled over all follow-up from 14 days on: 63.6% at 3 months, 48.3% at 6 months, then steady at 49.7%. No one-dose figure.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Crossref: title, seven authors, Vaccines 11(2):224 (online 19 Jan 2023) match; no update-to, updated-by or relation entries. PMC9965204 full text: the severe-by-time sentence (63.6% at three months, 48.3% at six) confirmed verbatim in Results 3.2.3, and the same three-month value in the abstract; the overall figures and the 23.4% symptomatic sentence also found. is_retracted false.'
		}
	},
	{
		id: 'tan-2022-omicron-children-partial',
		authors: 'Tan SHX, Cook AR, Heng D, Ong B, Lye DC, Tan KB',
		title: 'Effectiveness of BNT162b2 Vaccine against Omicron in Children 5 to 11 Years of Age',
		journal: 'The New England Journal of Medicine',
		year: 2022,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis gives one-dose protection against severe Omicron disease: Shao 2022’s one-dose row is infection only, and Mohammed 2023 covers completed courses only. Shao’s pooled figure is used for infection.',
		doi: '10.1056/nejmoa2203209',
		usedFor: ['covid19omicron.vaccines.covid-original.partial.severe'],
		quote:
			'Among partially vaccinated children, vaccine effectiveness was 13.6% (95% confidence interval [CI], 11.7 to 15.5) against all SARS-CoV-2 infections, 24.3% (95% CI, 19.5 to 28.9) against PCR-confirmed SARS-CoV-2 infection, and 42.3% (95% CI, 24.9 to 55.7) against Covid-19-related hospitalization',
		location: 'Abstract, Results; definitions in Abstract, Methods',
		why: `Worked out: Tan's matched pair, ${OMICRON_ONE_DOSE.tan.infection} against infection and ${OMICRON_ONE_DOSE.tan.severe} against hospital, gives a breakthrough factor of 1 - (1 - ${OMICRON_ONE_DOSE.tan.severe}) / (1 - ${OMICRON_ONE_DOSE.tan.infection}) = ${fmt(OMICRON_ONE_DOSE.breakthrough, 3)}. Kept at Shao 2022's ${OMICRON_ONE_DOSE.infection} against infection, one dose's severe protection is 1 - (1 - ${OMICRON_ONE_DOSE.infection}) x (1 - ${fmt(OMICRON_ONE_DOSE.breakthrough, 3)}) = ${fmt(OMICRON_ONE_DOSE.severe, 3)}. Using ${OMICRON_ONE_DOSE.tan.severe} as published would break the pair.`,
		context:
			"Singapore, children aged 5-11, Jan-Apr 2022; compared with unvaccinated children. Biased low: the partial window starts 1 day after dose 1 ('≥1 day after the first dose of vaccine and up to 6 days after the second dose'), so it includes the first two weeks, when no protection is expected yet. Counts reported infections only.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Checked at abstract level: DOI matches in OpenAlex and the Consensus record; title, six authors, N Engl J Med 2022;387(6):525-532 match; the quote and the definitions of reported infection and of partial vaccination are verbatim in the abstract. OpenAlex is_retracted false. Full text paywalled, not read.'
		}
	},
	{
		id: 'britten-1932-phr-1918-canvass',
		authors: 'Britten RH',
		title:
			'The Incidence of Epidemic Influenza, 1918-19: A Further Analysis According to Age, Sex, and Color of the Records of Morbidity and Mortality Obtained in Surveys of 12 Localities',
		journal: 'Public Health Reports 47(6):303-337',
		year: 1932,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis or systematic review gives numeric age-specific 1918 case fatality; this canvass is the primary dataset behind the published curves.',
		doi: '10.2307/4580340',
		mirrorUrl: 'https://stacks.cdc.gov/view/cdc/68997/cdc_68997_DS1.pdf',
		usedFor: [
			'flu1918.mortality',
			'flu1918.mortalityByAge',
			'flu1918.hospitalisedShare',
			'flu1918.hospitalisedByAge'
		],
		quote:
			'Fatality of influenza and of pneumonia by age, in all surveyed localities during epidemic of 1918-19 (percentage of cases which died)',
		location:
			"Table 28, p. 332 (fatality by age); Table 7, p. 311 (cases by age: 'Incidence of influenza among canvassed persons in each age group in all surveyed localities during the epidemic of 1918-19')",
		why: 'Deaths per case by age from Table 28, banded with the case counts in Table 7: 0-14 0.0115, 15-64 0.0195, 65+ 0.0410 (worked out); overall 1.7% as published. The W shape (peaks under 1, at 25-29 and at 70+) shows only at single ages. Hospital share is set equal to deaths per case in each band, as a lower bound: everyone who died of it needed a bed, and no 1918 hospital figure exists.',
		context: 'US house-to-house canvass of 1918-19 (about 130,000 people in 18 localities)',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Scanned PDF on CDC Stacks read twice through text extraction. The Table 28 rows matched on both reads. The table title is quoted from the extraction. Article title and pages 303-337 confirmed. Morabia 2021 independently confirms the 25-29 (~3%), 45-49 (<1.5%), 70+ (5.1%) and 'Table 28, p332' values. Table 7 check: the 65-69 count was read once as 332 and once as 392; 332 fits the printed rate of 135/1,000 (332/2,456 = 0.135) and is used. The 40-44 count printed as 2,219 does not fit its rate of 256/1,000, and age rows sum to 42,354 against 42,920; effect on band values is under 0.01 percentage points. The JSTOR DOI 10.2307/4580340 was later found and matches the title, journal and pages; no retraction applies to a 1932 government report."
		}
	},
	{
		id: 'morabia-2021-1918-canvass',
		authors: 'Morabia A',
		title:
			'The US Public Health Service House-to-House Canvass Survey of the Morbidity and Mortality of the 1918 Influenza Pandemic',
		journal: 'American Journal of Public Health 111(3):438-445',
		year: 2021,
		evidence: 'study',
		doi: '10.2105/ajph.2020.306025',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7893349/',
		usedFor: [
			'flu1918.mortality',
			'flu1918.mortalityByAge',
			'flu1918.hospitalisedShare',
			'flu1918.hospitalisedByAge'
		],
		quote:
			'The CFR rose to nearly 3% in the group aged 25 to 29 years and fell to less than 1.5% among those aged 45 to 49 years, but in people aged 70 years and older it rose again, reaching 5.1%.',
		location: 'Results of the National House-to-House Surveys (citing Britten, Table 28, p332)',
		why: 'Peer-reviewed reanalysis that confirms the Britten Table 28 values used for the bands.',
		context: 'Reanalysis of the US 1918-19 canvass',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'PMC page read twice. Quote word for word, with the paragraph around it. Journal, volume, pages and DOI read from PMC. No correction or retraction notice shown.'
		}
	},
	{
		id: 'cdc-1918-pandemic-page',
		authors: 'US Centers for Disease Control and Prevention',
		title: '1918 Pandemic (H1N1 virus)',
		journal: 'CDC (archived web page)',
		year: 2019,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://archive.cdc.gov/www_cdc_gov/flu/pandemic-resources/1918-pandemic-h1n1.html',
		usedFor: ['flu1918.fullEfficacy'],
		quote:
			'With no vaccine to protect against influenza infection and no antibiotics to treat secondary bacterial infections that can be associated with influenza infections, control efforts worldwide were limited to non-pharmaceutical interventions.',
		location: 'Main text',
		why: 'No vaccine existed in 1918, so its efficacy is 0 and nobody is vaccinated.',
		context: 'Worldwide, 1918-1919',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Page opened twice; both quotes present. Official page.'
		}
	},
	{
		id: 'fraser-2011-1918-households',
		authors: 'Fraser C, Cummings DAT, Klinkenberg D, Burke DS, Ferguson NM',
		title: 'Influenza transmission in households during the 1918 pandemic.',
		journal: 'American Journal of Epidemiology',
		year: 2011,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis estimates the asymptomatic share in 1918; this household analysis is the only estimate.',
		doi: '10.1093/aje/kwr122',
		usedFor: ['flu1918.asymptomaticFraction'],
		quote:
			'The authors estimated a very low probability of asymptomatic infection, a previously unknown parameter for this pandemic, consistent with an unusually virulent virus.',
		location: 'Abstract',
		why: 'The authors estimate a very low chance of infection without symptoms; no number is given, so the model uses 0.',
		context: 'US households, 1918',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Second search record matched. Retraction check through Crossref/PMC was not possible (rate limit and captcha); no retraction notice seen in the search record.'
		}
	},
	{
		id: 'white-pagano-2008-1918-serial',
		authors: 'White LF, et al.',
		title: 'Transmissibility of the Influenza Virus in the 1918 Pandemic',
		journal: 'PLoS ONE',
		year: 2008,
		evidence: 'study',
		noReviewReason: 'No systematic review estimates 1918-specific latent or infectious periods.',
		doi: '10.1371/journal.pone.0001498',
		usedFor: ['flu1918.silentDays', 'flu1918.illDays'],
		quote:
			'The results that we have presented suggest that the average serial interval for pandemic influenza in 1918 was consistently between three and four, regardless of the setting.',
		location: 'Discussion',
		why: '1918 serial interval of 3-4 days. No 1918-specific contagious periods exist, so the seasonal flu timings (1 day silent, 4 days ill) are used as an assumption; this serial interval shows they are reasonable.',
		context: 'US and European 1918 outbreaks',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Quote checked in full-text excerpt via Consensus. The Consensus record lists 'L. White et al.'; only the first author was confirmed, so the rest are given as et al. Title, journal, year and DOI match. No retraction notice seen."
		}
	},
	{
		id: 'vink-2014-serial-intervals',
		authors: 'Vink MA, Bootsma MCJ, Wallinga J',
		title: 'Serial intervals of respiratory infectious diseases: a systematic review and analysis',
		journal: 'American Journal of Epidemiology',
		year: 2014,
		evidence: 'systematic-review',
		doi: '10.1093/aje/kwu209',
		usedFor: ['flu1918.silentDays', 'flu1918.illDays'],
		quote:
			'The reported values of the mean serial interval of influenza A(H1N1) and pandemic influenza A(H1N1)pdm09 ranged from 1.9 to 5 days (Table 2).',
		location: 'Results, Influenza',
		why: 'Pooled context: H1N1 serial intervals of 1.9-5 days (pooled pdm09 mean 2.8 days), consistent with the 1918 estimate of 3-4 days.',
		context: 'Influenza A(H1N1) outbreaks',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Quote checked in full-text excerpt via Consensus. The PDF text breaks 'influenza' with a ligature ('in /uniFB02 uenza'), which is normalised here. Authors from the title-page excerpt. No retraction notice seen."
		}
	},
	{
		id: 'worldbank-pop-0014',
		authors: 'World Bank (World Development Indicators), via FRED, Federal Reserve Bank of St. Louis',
		title:
			'Population ages 0-14 (% of total population) for World, European Union, United Kingdom, Nigeria and Japan (series SPPOP0014TOZSWLD, SPPOP0014TOZSEUU, SPPOP0014TOZSGBR, SPPOP0014TOZSNGA, SPPOP0014TOZSJPN)',
		journal: 'FRED economic data (mirror of World Bank indicator SP.POP.0014.TO.ZS)',
		year: 2025,
		evidence: 'official',
		publisher: 'World Bank',
		url: 'https://data.worldbank.org/indicator/SP.POP.0014.TO.ZS',
		mirrorUrl: 'https://fred.stlouisfed.org/series/SPPOP0014TOZSWLD',
		usedFor: ['population.ageMix', 'population.ukAgeMix', 'population.youngAgeMix', 'population.oldAgeMix'],
		quote:
			'2025: World 24.40906; European Union 14.20743; United Kingdom 16.96477; Nigeria 40.51972; Japan 11.23840',
		location: 'FRED series pages, latest observation (2025)',
		why: `Share aged 0-14: EU ${fmt(WORLD_BANK_AGES_2025.EU.under15, 2)}% (the general default population), UK ${fmt(WORLD_BANK_AGES_2025.UK.under15, 2)}% (the England preset), and Nigeria (${fmt(WORLD_BANK_AGES_2025.Nigeria.under15, 2)}%) and Japan (${fmt(WORLD_BANK_AGES_2025.Japan.under15, 2)}%) as the young and old populations of the age lesson.`,
		context: 'European Union, United Kingdom, Nigeria and Japan, 2025',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Values read from the FRED mirror of the World Bank indicator, opened twice.'
		}
	},
	{
		id: 'worldbank-pop-65up',
		authors: 'World Bank (World Development Indicators), via FRED, Federal Reserve Bank of St. Louis',
		title:
			'Population ages 65 and above (% of total population) for World, European Union, United Kingdom, Nigeria and Japan (series SPPOP65UPTOZSWLD, SPPOP65UPTOZSEUU, SPPOP65UPTOZSGBR, SPPOP65UPTOZSNGA, SPPOP65UPTOZSJPN)',
		journal: 'FRED economic data (mirror of World Bank indicator SP.POP.65UP.TO.ZS)',
		year: 2025,
		evidence: 'official',
		publisher: 'World Bank',
		url: 'https://data.worldbank.org/indicator/SP.POP.65UP.TO.ZS',
		mirrorUrl: 'https://fred.stlouisfed.org/series/SPPOP65UPTOZSWLD',
		usedFor: ['population.ageMix', 'population.ukAgeMix', 'population.youngAgeMix', 'population.oldAgeMix'],
		quote:
			'2025: World 10.40243; European Union 22.44279; United Kingdom 19.70269; Nigeria 3.06954; Japan 29.99410',
		location: 'FRED series pages, latest observation (2025)',
		why: `Share aged 65+: EU ${fmt(WORLD_BANK_AGES_2025.EU.over64, 2)}%, UK ${fmt(WORLD_BANK_AGES_2025.UK.over64, 2)}%, Nigeria ${fmt(WORLD_BANK_AGES_2025.Nigeria.over64, 2)}%, Japan ${fmt(WORLD_BANK_AGES_2025.Japan.over64, 2)}%. The 15-64 share is worked out as the rest (EU ${fmt(100 - WORLD_BANK_AGES_2025.EU.under15 - WORLD_BANK_AGES_2025.EU.over64, 2)}%).`,
		context: 'European Union, United Kingdom, Nigeria and Japan, 2025',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Values read from the FRED mirror of the World Bank indicator, opened twice.'
		}
	},
	{
		id: 'eurostat-deaths-pop-2023',
		authors: 'Eurostat',
		title:
			'Deaths by age and sex (demo_magec); Population on 1 January by broad age group and sex (demo_pjanbroad)',
		journal: 'Eurostat database',
		year: 2026,
		evidence: 'official',
		publisher: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_magec?format=JSON&geo=EU27_2020&sex=T&time=2023&lang=EN',
		usedFor: ['population.backgroundDeathRate'],
		quote:
			'TOTAL=4856197; population EU27_2020 1 Jan 2023: Y_LT15 66,433,028; Y15-64 285,755,090; Y_GE65 95,507,232',
		location:
			'demo_magec EU27_2020, 2023, all single ages; demo_pjanbroad https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjanbroad?format=JSON&geo=EU27_2020&sex=T&time=2023&lang=EN',
		why: 'Worked out: summed single-age deaths 0-14 = 19,177, 15-64 = 699,423, 65+ = 4,137,597 (sum 4,856,197 = published total). Dividing by population gives 0.000289, 0.00245 and 0.0433 per person per year.',
		context: 'EU-27, 2023',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: Y_LT15 population and death TOTAL re-confirmed. A second full read gave values shifted by one age, so the Y14 value was checked with a single-code query (654, matching the first read). Other single ages were not re-queried because of a rate limit.'
		}
	},
	{
		id: 'eurostat-uk-deaths-2018-5yr',
		authors: 'Eurostat',
		title: 'Deaths by age group, sex and NUTS 3 region (demo_r_magec3), United Kingdom, 2018',
		journal: 'Eurostat database',
		year: 2026,
		evidence: 'official',
		publisher: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_r_magec3?format=JSON&geo=UK&sex=T&time=2018&lang=EN',
		usedFor: ['population.ukBackgroundDeathRate'],
		quote:
			'Total 614,313; Less than 5 years 3,228; From 5 to 9 years 301; From 10 to 14 years 347; From 15 to 19 years 966; From 20 to 24 years 1,571; From 25 to 29 years 2,148; From 30 to 34 years 2,939; From 35 to 39 years 4,244; From 40 to 44 years 5,858; From 45 to 49 years 10,064; From 50 to 54 years 14,998; From 55 to 59 years 21,043; From 60 to 64 years 28,112; From 65 to 69 years 41,218; From 70 to 74 years 61,885; From 75 to 79 years 74,876; From 80 to 84 years 98,768; From 85 to 89 years 111,927; 90 years or over 129,820',
		location: 'demo_r_magec3, geo=UK, sex=T, time=2018 (dataset updated 2026-09-22)',
		why: 'Band sums: 0-14 3,876; 15-64 91,943; 65+ 518,494. These add to 614,313, exactly the published total. Divided by the mean of 1 Jan 2018 and 1 Jan 2019 population: 0.000326, 0.00217 and 0.0426 deaths per person per year.',
		context: 'United Kingdom, 2018',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "API read twice. The second full read gave 61,885 for 65-69, a one-row shift; a third, single-category query (age=Y65-69) returned 41,218, matching the first read. The first read's rows sum exactly to the published total. Total, under 5, 10-14, 15-19, 40-44, 60-64, 85-89 and 90+ matched on both reads."
		}
	},
	{
		id: 'eurostat-uk-population-2018-2019-5yr',
		authors: 'Eurostat',
		title: 'Population on 1 January by age group and sex (demo_pjangroup), United Kingdom, 2018 and 2019',
		journal: 'Eurostat database',
		year: 2026,
		evidence: 'official',
		publisher: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjangroup?format=JSON&geo=UK&sex=T&time=2019&lang=EN',
		usedFor: [
			'population.ukBackgroundDeathRate',
			'covid19.mortalityByAge',
			'covid19.hospitalisedByAge',
			'covidAgeIfr.UK_2019_AGE_GROUPS',
			'covid19omicron.mortalityByAge',
			'covid19omicron.hospitalisedByAge'
		],
		quote:
			'2019: Total 66,647,112; Less than 5 years 3,885,007; From 5 to 9 years 4,146,546; From 10 to 14 years 3,908,395; From 15 to 19 years 3,661,722; From 20 to 24 years 4,170,514; From 25 to 29 years 4,527,006; From 30 to 34 years 4,485,180; From 35 to 39 years 4,387,779; From 40 to 44 years 4,008,205; From 45 to 49 years 4,457,239; From 50 to 54 years 4,668,822; From 55 to 59 years 4,351,807; From 60 to 64 years 3,716,512; From 65 to 69 years 3,384,532; From 70 to 74 years 3,286,389; From 75 to 79 years 2,281,501; From 80 to 84 years 1,695,137; 85 years or over 1,624,819',
		location:
			'demo_pjangroup, geo=UK, sex=T, time=2019 and time=2018 (2018 total 66,273,576; bands 11,871,549 / 42,309,960 / 12,092,067)',
		why: 'Denominator for the UK background death rates: the mean of the 1 January 2018 and 2019 populations by band.',
		context: 'United Kingdom, 1 January 2018 and 2019',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'The 2019 band sums match demo_pjanbroad exactly (11,939,948 / 42,434,786 / 12,272,378, as cited in vaccine-risks.md). The 2018 total matches demo_pjanbroad (66,273,576), read separately. The 5-year groups were each read once; the matching sums act as the second check.'
		}
	},
	{
		id: 'cdc-flu-burden-2018-19',
		authors: 'US Centers for Disease Control and Prevention',
		title:
			'Estimated Flu-Related Illnesses, Medical visits, Hospitalizations, and Deaths in the United States — 2018–2019 Flu Season',
		journal: 'CDC (archived web page)',
		year: 2021,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://archive.cdc.gov/www_cdc_gov/flu/about/burden/2018-2019.html',
		usedFor: ['flu.mortalityByAge', 'flu.hospitalisedByAge'],
		quote: 'Older adults also accounted for 75% of flu-related deaths',
		location:
			'Table 1 (illnesses, medical visits, hospitalizations, deaths by age group) and the sentence below it',
		why: 'Worked out from Table 1. Symptomatic illnesses / hospitalisations / deaths: 0-4 3,018,815 / 21,046 / 216; 5-17 6,622,851 / 18,159 / 156; 18-49 9,794,700 / 54,978 / 1,590; 50-64 7,224,769 / 76,617 / 4,396; 65+ 2,247,586 / 204,326 / 21,261; all 28,908,721 / 375,126 / 27,619. 0-17 (stands in for 0-14): deaths 372/9,641,666 = 0.0000386, hospital 39,205/9,641,666 = 0.004066. 18-64 (stands in for 15-64): deaths 5,986/17,019,469 = 0.0003517, hospital 131,595/17,019,469 = 0.007732. 65+: deaths 21,261/2,247,586 = 0.009459, hospital 204,326/2,247,586 = 0.09091. Denominator is symptomatic illness, so each value is a share of symptomatic cases.',
		context: 'US, 2018-19 season; bands 0-17 and 18-64 stand in for 0-14 and 15-64',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Page opened twice; all table numbers matched. Official page; retraction not applicable.'
		}
	},
	{
		id: 'bobrovitz-2023-omicron-reinfection',
		authors:
			'Bobrovitz N, Ware H, Ma X, Li Z, Hosseini R, Cao C, Selemon A, Whelan M, Premji Z, Issa H, Cheng B, Abu Raddad LJ, Buckeridge DL, Van Kerkhove MD, Piechotta V, Higdon MM, Wilder-Smith A, Bergeri I, Feikin DR, Arora RK, Patel MK, Subissi L',
		title:
			'Protective effectiveness of previous SARS-CoV-2 infection and hybrid immunity against the omicron variant and severe disease: a systematic review and meta-regression',
		journal: 'The Lancet Infectious Diseases',
		year: 2023,
		evidence: 'systematic-review',
		doi: '10.1016/s1473-3099(22)00801-5',
		usedFor: ['covid19omicron.waningDays'],
		quote:
			'The effectiveness of previous infection against reinfection was 65·2% (95% CI 52·9 to 75·9) at 3 months, dropping to 24·7% (16·4 to 35·5) at 12 months',
		location: 'Results; Table 2 (any infection)',
		why: `Measures how well a past infection stops reinfection with Omicron, mostly earlier infections against later Omicron sublineages. That fits the Omicron-era disease, which stands for a virus that kept drifting. Worked out: a straight line between ${BOBROVITZ.early.protection}% at ${BOBROVITZ.early.month} months and ${BOBROVITZ.late.protection}% at ${BOBROVITZ.late.month} months falls to half at ${fmt(BOBROVITZ.halfMonths, 2)} months x 365.25 / 12 = ${fmt(BOBROVITZ.halfLife)} days, matching the half-way meaning of covid19.waningDays.`,
		context:
			'Studies from many countries, 2021-2022: mostly earlier infections protecting against later Omicron sublineages',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Checked against Crossref metadata and the published PDF in the University of Victoria repository (the Lancet site returned 403). The quote is from the Results; the abstract words it differently. No correction or retraction.'
		}
	},
	{
		id: 'madewell-2023-omicron-serial',
		authors: 'Madewell ZJ, Yang Y, Longini IM Jr, Halloran ME, Vespignani A, Dean NE',
		title: 'Rapid review and meta-analysis of serial intervals for SARS-CoV-2 Delta and Omicron variants',
		journal: 'BMC Infectious Diseases',
		year: 2023,
		evidence: 'meta-analysis',
		doi: '10.1186/s12879-023-08407-5',
		usedFor: ['covid19omicron.silentDays'],
		quote:
			'The pooled mean serial interval for Delta was 3.9 days (95% CI: 3.4–4.3) (20 studies) and Omicron was 3.2 days (95% CI: 2.9–3.5) (20 studies).',
		location: 'Abstract, Results',
		why: "Worked out with the variant rule: the Omicron gap (incubation 3.42 - serial interval 3.2 = 0.22 days) over the 2020 gap (6.5 - 5.2 = 1.3 days) scales the 2020 virus's 2 silent days: 2 x 0.22 / 1.3 = 0.34, stored as 0.3. No review gives Omicron's presymptomatic period directly.",
		context: 'Studies from many countries, 2021-2023',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Checked on PMC (PMC10291789); the publisher site was blocked.'
		}
	},
	{
		id: 'wu-2023-omicron-shedding',
		authors: 'Wu Y, Guo Z, Yuan J, Cao G, Wang Y, Gao P, Liu J, Liu M',
		title:
			'Duration of viable virus shedding and polymerase chain reaction positivity of the SARS-CoV-2 Omicron variant in the upper respiratory tract: a systematic review and meta-analysis',
		journal: 'International Journal of Infectious Diseases',
		year: 2023,
		evidence: 'meta-analysis',
		doi: '10.1016/j.ijid.2023.02.011',
		usedFor: ['covid19omicron.illDays'],
		quote:
			'The pooled duration of viable virus shedding of the SARS-CoV-2 Omicron variant in the upper respiratory tract was 5.16 days (95% CI: 4.18-6.14)',
		location: 'Abstract, Results',
		why: 'Pooled days of live (infectious) virus for Omicron, rounded to 5.',
		context: 'Studies from many countries, 2021-2022',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Checked against Crossref metadata and Consensus full-text excerpts; PMC and ScienceDirect were blocked. No correction or retraction.'
		}
	},
	{
		id: 'yu-2008-1918-survivor-antibodies',
		authors:
			'Yu X, Tsibane T, McGraw PA, House FS, Keefer CJ, Hicar MD, Tumpey TM, Pappas C, Perrone LA, Martinez O, Stevens J, Wilson IA, Aguilar PV, Altschuler EL, Basler CF, Crowe JE Jr',
		title: 'Neutralizing antibodies derived from the B cells of 1918 influenza pandemic survivors',
		journal: 'Nature',
		year: 2008,
		evidence: 'study',
		noReviewReason:
			'No review measures how long immunity to the 1918 virus lasted; this study of survivors is the direct evidence.',
		doi: '10.1038/nature07231',
		usedFor: ['flu1918.waningDays'],
		quote:
			'Here we show that of the 32 individuals tested that were born in or before 1915, each showed seroreactivity with the 1918 virus, nearly 90 years after the pandemic.',
		location: 'Abstract',
		why: 'Survivors still had antibodies to the 1918 virus about 90 years later, so immunity to it does not fade in the model (waningDays null).',
		context: 'US survivors of the 1918 pandemic, tested about 2007',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'A 2012 corrigendum (10.1038/nature11235) corrects one antibody sequence and one virus name and states the conclusions are unaffected; it does not touch the serology quoted.'
		}
	},
	{
		id: 'taubenberger-morens-2006',
		authors: 'Taubenberger JK, Morens DM',
		title: '1918 Influenza: the Mother of All Pandemics',
		journal: 'Emerging Infectious Diseases',
		year: 2006,
		evidence: 'review',
		doi: '10.3201/eid1201.050979',
		url: 'https://wwwnc.cdc.gov/eid/article/12/1/05-0979_article',
		usedFor: ['flu1918.about'],
		quote:
			'Jordan showed that from 1900 to 1917, the 5- to 15-year age group accounted for 11% of total influenza cases, while the >65-year age group accounted for 6% of influenza cases. But in 1918, cases in the 5- to 15-year-old group jumped to 25% of influenza cases (compatible with exposure to an antigenically novel virus strain), while the >65 age group only accounted for 0.6% of the influenza cases, findings consistent with previously acquired protective immunity caused by an identical or closely related viral protein to which older persons had once been exposed.',
		location:
			"Main text, section on age-specific clinical influenza (citing Jordan, ref. 21); see also Figure 3 panel A and the sentence 'Persons <35 years of age in 1918 had a disproportionately high influenza incidence (Figure 3, panel A).'",
		why: 'Shows that older people made up far fewer 1918 influenza cases (over-65s: 0.6% of cases in 1918 vs 6% in 1900-1917) and that people under 35 had disproportionately high incidence, supporting a lower attack rate in older people.',
		context:
			"These are shares of cases, not age-specific attack rates; Figure 3A (incidence per 1,000 by age, USPHS house-to-house surveys, 8 states, 1918) is graphical only. The excerpt renders '>' as the HTML entity '&gt;'.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote confirmed verbatim in the full published article (EID 2006;12(1):15-22) from a university-hosted copy; the DOI printed in the article matches, and Crossref and Consensus records agree on title, authors, year and journal. doi.org and the CDC page were blocked.'
		}
	},
	{
		id: 'mamelund-2016-missed-summer-wave',
		authors: 'Mamelund SE, Haneberg B, Mjaaland S',
		title:
			'A Missed Summer Wave of the 1918–1919 Influenza Pandemic: Evidence From Household Surveys in the United States and Norway',
		journal: 'Open Forum Infectious Diseases',
		year: 2016,
		evidence: 'study',
		noReviewReason:
			'No review with readable age-specific 1918 attack-rate figures was accessible; this primary survey reanalysis gives the direct age-morbidity evidence.',
		doi: '10.1093/ofid/ofw040',
		usedFor: ['flu1918.about'],
		quote:
			'When relating the reported ILI-rates to age, in both areas of Maryland during the second wave, and in Bergen during the first wave, it appeared that the disease was most frequent in school-age children and young adults, with low morbidity rates in the very young children and steadily declining values in older individuals, creating inverted U-shaped curves.',
		location: "Discussion; abstract Results: 'Individuals <40 years had the highest morbidity'",
		why: 'Primary household-survey data (Baltimore, rural Maryland, Bergen) showing 1918 illness rates falling steadily with age from about 30 years.',
		context:
			'Self-reported influenza-like illness, not laboratory-confirmed infection; age-specific rates are shown in figures only. The authors attribute the lower morbidity in older people to immunity from the 1889-1890 pandemic.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'OFID 2016;3(1):ofw040. Checked in the Norwegian Institute of Public Health repository record and the Consensus full-text record; authors, year, journal and DOI match and the quote is verbatim; no correction found.'
		}
	},
	{
		id: 'covid19-forecasting-team-2022-ifr',
		authors: 'COVID-19 Forecasting Team (Sorensen R, et al.)',
		title:
			'Variation in the COVID-19 infection–fatality ratio by age, time, and geography during the pre-vaccine era: a systematic analysis',
		journal: 'The Lancet',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1016/S0140-6736(21)02867-1',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8871594/',
		usedFor: [
			'covid19.mortalityByAge',
			'covidAgeIfr.COVID19_IFR_PERCENT_BY_AGE',
			'covid19omicron.mortalityByAge'
		],
		quote:
			'Age-specific IFR estimates form a J shape, with the lowest IFR occurring at age 7 years (0·0023%, 95% uncertainty interval [UI] 0·0015–0·0039) and increasing exponentially through ages 30 years (0·0573%, 0·0418–0·0870), 60 years (1·0035%, 0·7002–1·5727), and 90 years (20·3292%, 14·6888–28·9754).',
		location:
			"Abstract (Findings); single-year values from Table 1 'COVID-19 IFR estimates by age' (ages 1-100), stored in covidAgeIfr.ts",
		why: 'Pooled global pre-vaccine death rate for every single year of age, preferred over Levin 2020, whose deaths include care homes. Bands are worked out in code with UK 2019 ages: 0-14 0.0034%, 15-64 0.33%, 65+ 6.66% per infection (6.10% to 7.48% depending on how 85+ splits by age), 1.43% overall for UK ages. The all-ages 0.68% (Meyerowitz-Katz) stays the headline; this is higher because it uses UK ages, which are older than the populations behind the all-ages figure.',
		context:
			"Infections from 15 April 2020 to 1 January 2021, before vaccines and widespread variants. No row for age 0, so age 0 takes age 1's value. One correction notice (Lancet 399:1468, DOI 10.1016/S0140-6736(22)00666-3, online 14 April 2022) only moves Tanzania and Uganda in Table 2 and leaves Table 1 unchanged. Check against England: Ward 2024 gives an England pre-vaccine peak IFR of 0.97% per infection (January 2021), so these bands' 1.43% for UK ages is 1.48 times that, within the 1.5x the project allows without review.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Abstract quote confirmed in the Consensus full-text record and the author-hosted PDF; Table 1 read from that PDF with two spot-checks. Crossref lists exactly one correction (update-to), which does not touch Table 1; twelve Table 1 rows were compared between the original and corrected versions and are identical.'
		}
	},
	{
		id: 'herrera-esposito-2022-severe-by-age',
		authors: 'Herrera-Esposito D, de los Campos G',
		title:
			'Age-specific rate of severe and critical SARS-CoV-2 infections estimated with multi-country seroprevalence studies',
		journal: 'BMC Infectious Diseases',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1186/s12879-022-07262-0',
		url: 'https://bmcinfectdis.biomedcentral.com/articles/10.1186/s12879-022-07262-0',
		usedFor: [
			'covid19.hospitalisedByAge',
			'covidAgeIfr.COVID19_SEVERE_PERCENT_BY_GROUP',
			'covid19omicron.hospitalisedByAge'
		],
		quote:
			'Examples of this are the rate of severe infections (Infection-severe rate, ISR), which we define as infections resulting in hospitalization or out-of-hospital death',
		location:
			'Background, paragraph 1 (definition); Additional file 1, Table S1 (5-year ages to 85+), stored in covidAgeIfr.ts',
		why: "The only multi-country meta-analysis of severe cases by age per infection before vaccines. Weighted by UK 2019 ages: 0-14 0.13%, 15-64 2.35%, 65+ 18.7% per infection. It counts deaths outside hospital as severe, so beds for 65+ are slightly high; in England and Wales 67.8% of 2020 COVID-19 deaths happened in hospital (ONS weekly deaths, week ending 1 January 2021). That definition matches the model's assumption that as many deaths as possible happen in hospital. For UK ages the bands give 4.97% per infection, above Ward 2024's all-ages 3.39%; each figure matches its own source, and the About page gives both.",
		context:
			'Serosurveys from early to mid 2020 in 16 high-income locations, England included. The paper says rates for under-10s may be too low; its alternative 0-9 figure (0.42%) would make 0-14 0.34%.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref confirms title, authors, journal, volume 22 article 311, 29 March 2022, with no correction or retraction; PMC metadata (PMC8962942) is_retracted false. Full text and supplement Table S1 read from the PMC open-data bucket.'
		}
	},
	{
		id: 'kow-2021-bnt-ma',
		authors: 'Kow CS, Hasan SS',
		title:
			'Real-world effectiveness of BNT162b2 mRNA vaccine: a meta-analysis of large observational studies',
		journal: 'Inflammopharmacology',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1007/s10787-021-00839-2',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8266992/',
		usedFor: [
			'covid19.fullEfficacy',
			'covid19.partialEfficacy',
			'covid19.vaccines.covid-original.full.infection',
			'covid19.vaccines.covid-original.partial.infection'
		],
		quote:
			'confirmed COVID-19 was defined in the clinical trial as the presence of symptoms and positive RT-PCR test for SARS-CoV-2; while the included studies of our meta-analyses, confirmed COVID-19 was defined as positive RT-PCR test for SARS-CoV-2 regardless of the presence of symptoms. … pooled HR of 0.12 (95% confidence interval: 0.08–0.16; Fig. 2) 14 days or more after the second dose, and thus vaccine effectiveness of 88% (95% confidence interval: 84%–92%).',
		location:
			'Discussion, first paragraph (outcome definition); Results (pooled estimates, Fig. 2). Also from Results: one dose 14 days or more 42% (HR) / 53% (IRR), 21 days or more 58% / 59%; two doses 7 days or more 82% (HR) / 91% (IRR) / 81% (OR), 14 days or more 88% (HR) / 96% (IRR).',
		why: "Check on Liu 2021's infection values for the mRNA vaccine alone, with the same any-infection outcome (RT-PCR positive regardless of symptoms): two doses 0.82-0.96 against Liu's 0.85, one dose 0.42-0.59 against Liu's 0.41. Liu sets the values because it pools all vaccines and gives hospital figures too.",
		context:
			"BNT162b2 only; 19 observational studies, mostly early 2021 (original strain and Alpha); variant-specific studies and studies reporting only hospitalisation or death were excluded, so it has no severe-disease figure. The abstract misprints the two-dose interval as '95% (95% confidence interval: 96–97%)'; the Results figures are used.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'DOI matches in the PMC open-data metadata (PMC8266992) and OpenAlex; title, authors, Inflammopharmacology 2021;29(4):1075-90 match. All figures and the definition quote found in the PMC full text. is_retracted false; no correction notice.'
		}
	},
	{
		id: 'yegorov-2025-flu-severe-ma',
		authors:
			'Yegorov S, Patel OD, Sharma H, Khan T, Gupta R, Yao M, Sritharan A, Silverman N, Pullenayegum E, Miller MS, Loeb M',
		title:
			'Effectiveness of influenza vaccination to prevent severe disease: a systematic review and meta-analysis of test-negative design studies',
		journal: 'Clinical Microbiology and Infection',
		year: 2025,
		evidence: 'meta-analysis',
		doi: '10.1016/j.cmi.2025.09.023',
		usedFor: ['flu.vaccines.inactivated.full.severe'],
		quote:
			'Pooled IVE was 42% (95% CI: 39-44) against influenza-associated hospitalisation (very low certainty)',
		location: 'Abstract, Results',
		why: `Flu vaccine prevents ${FLU_VACCINE.severeAverage} of flu hospital admissions over a season, all ages, counted in everyone vaccinated. Paired with Guo's ${FLU_VACCINE.seasonAverage} season figure it gives a breakthrough factor of ${fmt(breakthroughSevereProtection(FLU_VACCINE.seasonAverage, FLU_VACCINE.severeAverage), 3)}; the sim keeps that factor at its ${fmt(FLU_VACCINE.start, 3)} start, so severe is 1 - (1 - ${fmt(FLU_VACCINE.start, 3)}) x (1 - ${fmt(breakthroughSevereProtection(FLU_VACCINE.seasonAverage, FLU_VACCINE.severeAverage), 3)}) = ${fmt(FLU_VACCINE.severe, 3)}. Keeping ${FLU_VACCINE.severeAverage} beside the new start would make breakthrough cases sicker than the unvaccinated.`,
		context:
			'165 test-negative studies to Sept 2024; adults and children. Higher in seasons with a good vaccine match, but the by-match figure was not in the accessible text. Online 2025, in print Feb 2026.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, 11 authors and journal match; no update or retraction fields. The abstract contains the quote verbatim.'
		}
	},
	{
		id: 'rondy-2017-flu-hosp-ma',
		authors: 'Rondy M, El Omeiri N, Thompson MG, Levêque A, Moren A, Sullivan SG',
		title:
			'Effectiveness of influenza vaccines in preventing severe influenza illness among adults: A systematic review and meta-analysis of test-negative design case-control studies',
		journal: 'Journal of Infection',
		year: 2017,
		evidence: 'meta-analysis',
		doi: '10.1016/j.jinf.2017.09.010',
		usedFor: ['flu.vaccines.inactivated.full.severe'],
		quote:
			'Between 2010-11 and 2014-15, the pooled seasonal IVE was 41% (95%CI:34;48) for any influenza (51% (95%CI:44;58) among people aged 18-64y and 37% (95%CI:30;44) among ≥65 years).',
		location: 'Abstract, Results',
		why: "An independent pooled estimate against flu hospital admission in adults (0.41) that agrees with Yegorov's 0.42.",
		context: '30 hospital test-negative studies, adults, 2010-11 to 2014-15.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, six authors, Journal of Infection, 2017 match; no update or retraction fields. The abstract contains the quote verbatim.'
		}
	},
	{
		id: 'marin-2016-varicella-ma',
		authors: 'Marin M, Marti M, Kambhampati A, Jeram SM, Seward JF',
		title: 'Global Varicella Vaccine Effectiveness: A Meta-analysis',
		journal: 'Pediatrics',
		year: 2016,
		evidence: 'meta-analysis',
		doi: '10.1542/peds.2015-3741',
		usedFor: ['chickenpox.vaccines.varicella.partial.severe'],
		quote:
			'The pooled 2-dose VE against all varicella was 92% (95% CI: 88%-95%), with similar estimates by study design. … The pooled 1-dose VE was 81% (95% confidence interval [CI]: 78%-84%) against all varicella and 98% (95% CI: 97%-99%) against moderate/severe varicella with no significant association between VE and vaccine type or study design (P > .1).',
		location: 'Abstract, Results',
		why: `One dose prevents ${MARIN.partial} of chickenpox and ${MARIN.partialSevere} of moderate or severe chickenpox, mostly measured years after the dose: a breakthrough factor of ${fmt(breakthroughSevereProtection(MARIN.partial, MARIN.partialSevere), 3)}. The sim starts one dose at Bolormaa's ${BOLORMAA_ONE_DOSE_YEAR1} and keeps that factor, so severe is 1 - (1 - ${BOLORMAA_ONE_DOSE_YEAR1}) x (1 - ${fmt(breakthroughSevereProtection(MARIN.partial, MARIN.partialSevere), 3)}) = ${fmt(CHICKENPOX_PARTIAL_SEVERE, 3)}. No pooled two-dose severe figure exists, so the full course uses the one-dose figure, because a full course includes it. Two doses: ${MARIN.full}, averaged over years, so not the start.`,
		context: 'Post-licensure studies 1995-2014, healthy children.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Crossref: title, five authors, Pediatrics, 2016 match; no update or retraction fields. Both quoted sentences (two doses 92%; one dose 81% against all chickenpox and 98% against moderate or severe) confirmed verbatim in the Abstract, Results.'
		}
	},
	{
		id: 'oster-2022-mrna-myocarditis',
		authors: 'Oster ME, Shay DK, Su JR, et al.',
		title:
			'Myocarditis Cases Reported After mRNA-Based COVID-19 Vaccination in the US From December 2020 to August 2021',
		journal: 'JAMA',
		year: 2022,
		evidence: 'study',
		doi: '10.1001/jama.2021.24110',
		noReviewReason:
			'Not the value source: Ling 2022 (meta-analysis) sets it. Kept because Ling pools myocarditis with pericarditis and gives its age and sex rows for all COVID-19 vaccines only; Oster gives myocarditis alone after mRNA vaccines by age, sex and dose, with chart-reviewed cases. US reports likely undercount.',
		usedFor: [
			'covid19.vaccines.covid-original.seriousPer100kDoses',
			'covid19omicron.vaccines.covid-original.seriousPer100kDoses',
			'covid19omicron.vaccines.covid-updated.seriousPer100kDoses'
		],
		quote:
			'The rates of myocarditis were highest after the second vaccination dose in adolescent males aged 12 to 15 years (70.7 per million doses of the BNT162b2 vaccine), in adolescent males aged 16 to 17 years (105.9 per million doses of the BNT162b2 vaccine), and in young men aged 18 to 24 years (52.4 and 56.3 per million doses of the BNT162b2 vaccine and the mRNA-1273 vaccine, respectively).',
		location:
			"Abstract, Results; also 'Among 192 405 448 persons receiving a total of 354 100 845 mRNA-based COVID-19 vaccines ... 1626 of these reports met the case definition of myocarditis' and 'Approximately 96% of persons (784/813) were hospitalized'",
		why: `Myocarditis only, from US reports: ${fmt(OSTER.cases)} cases in ${fmt(OSTER.doses)} doses = ${fmt(OSTER.per100k, 3)} per 100,000, far higher in young men after dose 2 (105.9 per million at 16-17). The value comes from Ling 2022's meta-analysis (myocarditis or pericarditis, ${fmt(per100kFromPerMillion(MRNA_SERIOUS.myopericarditisPerMillion), 2)} per 100,000); Oster is kept for the mRNA-specific age and sex detail step 5 uses.`,
		context:
			'US passive reports (VAERS), Dec 2020 - Aug 2021, within 7 days of a dose; likely under-counted.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref confirms title, authors, JAMA 2022, no retraction relation; abstract quote re-read verbatim in a second search. Full text blocked by CAPTCHA.'
		}
	},
	{
		id: 'cdc-covid-vaccine-safety-2025',
		authors: 'Centers for Disease Control and Prevention',
		title: 'Coronavirus Disease 2019 (COVID-19) Vaccine Safety',
		journal: 'CDC Vaccine Safety',
		year: 2025,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/vaccine-safety/vaccines/covid-19.html',
		usedFor: [
			'covid19.vaccines.covid-original.deathsPer100kDoses',
			'covid19omicron.vaccines.covid-original.deathsPer100kDoses',
			'covid19omicron.vaccines.covid-updated.deathsPer100kDoses'
		],
		quote:
			'Anaphylaxis occurs at a rate of approximately 5 cases per one million vaccine doses administered. … COVID-19 vaccines do not increase the risk of death from non-COVID causes when compared to those who have not been vaccinated.',
		location: 'Sections on anaphylaxis and deaths (last updated 31 January 2025)',
		why: `Context beside Cho 2023's death rate: vaccinated people did not die more often from non-COVID causes, which fits a cause of death as rare as at least ${fmt(CHO.per100k, 3)} per 100,000 doses (about 1 in ${fmt(Math.round(1e5 / CHO.per100k / 1e6))} million). Anaphylaxis comes from Greenhawt 2021, a meta-analysis, rather than this page's 'about 5 per million'.`,
		context:
			"US official page; also: 'most patients (80%) were considered by their cardiologist or other healthcare provider to have either fully or probably fully recovered' from myocarditis at 3 months or more.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened; all quoted strings confirmed verbatim.'
		}
	},
	{
		id: 'xu-2021-covid-vaccine-mortality',
		authors:
			'Xu S, Huang R, Sy LS, Glenn SC, Ryan DS, Morrissette K, Shay DK, Vazquez-Benitez G, Glanz JM, Klein NP, McClure D, Liles EG, Weintraub ES, Tseng HF, Qian L',
		title:
			'COVID-19 Vaccination and Non-COVID-19 Mortality Risk — Seven Integrated Health Care Organizations, United States, December 14, 2020-July 31, 2021',
		journal: 'MMWR Morbidity and Mortality Weekly Report',
		year: 2021,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/mmwr/volumes/70/wr/mm7043e2.htm',
		usedFor: [
			'covid19.vaccines.covid-original.deathsPer100kDoses',
			'covid19omicron.vaccines.covid-original.deathsPer100kDoses',
			'covid19omicron.vaccines.covid-updated.deathsPer100kDoses'
		],
		quote: 'There is no increased risk for mortality among COVID-19 vaccine recipients.',
		location:
			"Summary box; also 'COVID-19 vaccine recipients had lower rates of non–COVID-19 mortality than did unvaccinated persons after adjusting for age, sex, race and ethnicity, and study site.'",
		why: `Context beside Cho 2023's death rate: deaths among vaccinated people were not above those in the unvaccinated, which fits a cause of death as rare as at least ${fmt(CHO.per100k, 3)} per 100,000 doses; a study this size cannot see it.`,
		context:
			'US Vaccine Safety Datalink; MMWR 70(43):1520-1524. Covers Pfizer, Moderna and Janssen. A healthy-vaccinee effect may partly explain the lower rate.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened; both sentences confirmed verbatim; authors and citation confirmed.'
		}
	},
	{
		id: 'cdc-flu-gbs-2024',
		authors: 'Centers for Disease Control and Prevention',
		title: 'Guillain-Barré Syndrome and Flu Vaccine',
		journal: 'CDC Influenza (Flu)',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/flu/vaccine-safety/guillainbarre.html',
		usedFor: ['flu.vaccines.inactivated.seriousPer100kDoses'],
		quote:
			'If there is an increased risk of GBS following flu vaccination, it is small, on the order of one to two additional GBS cases per million doses of flu vaccine administered.',
		location:
			"Main text; also 'Most people recover fully from GBS, but some people have long-term nerve damage.' and 'In some cases, people have died of GBS, usually from difficulty breathing.'",
		why: `GBS ${FLU_SERIOUS.gbsPerMillion[0]} to ${FLU_SERIOUS.gbsPerMillion[1]} per million doses (the middle is used) plus anaphylaxis ${FLU_SERIOUS.anaphylaxisPerMillion} per million (McNeil 2016) = ${fmt(FLU_SERIOUS.per100k, 3)} per 100,000 doses. No death is established (Miller 2015, IOM 2012).`,
		context:
			"The risk is stated conditionally ('if there is an increased risk'), so this is an upper estimate. Last updated 17 September 2024.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened; quotes confirmed verbatim.'
		}
	},
	{
		id: 'mcneil-2016-anaphylaxis',
		authors:
			'McNeil MM, Weintraub ES, Duffy J, Sukumaran L, Jacobsen SJ, Klein NP, Hambidge SJ, Lee GM, Jackson LA, Irving SA, King JP, Kharbanda EO, Bednarczyk RA, DeStefano F',
		title: 'Risk of anaphylaxis after vaccination in children and adults',
		journal: 'Journal of Allergy and Clinical Immunology',
		year: 2016,
		evidence: 'study',
		doi: '10.1016/j.jaci.2015.07.048',
		noReviewReason:
			'The only meta-analysis of anaphylaxis after non-COVID vaccines found (Pennisi 2025) covers adults only and counts per person rather than per dose, with very wide uncertainty, so it cannot set a per-dose rate; it has no IPV stratum in its abstract. McNeil 2016 is the largest active-surveillance study with chart-confirmed cases and per-dose denominators; it has no IPV-alone row, so IPV uses its all-vaccine rate.',
		usedFor: ['flu.vaccines.inactivated.seriousPer100kDoses', 'polio.vaccines.IPV.seriousPer100kDoses'],
		quote:
			'The rate of anaphylaxis was 1.31 (95% CI, 0.90-1.84) per million vaccine doses. The incidence did not vary significantly by age, and there was a nonsignificant female predominance. Vaccine-specific rates included 1.35 (95% CI, 0.65-2.47) per million doses for inactivated trivalent influenza vaccine',
		location: 'Abstract, Results',
		why: `Flu: ${FLU_SERIOUS.anaphylaxisPerMillion} per million added to GBS (CDC) gives ${fmt(FLU_SERIOUS.per100k, 3)} per 100,000 doses. IPV has no vaccine-specific serious risk (CDC), so the all-vaccine anaphylaxis rate ${ALL_VACCINE_ANAPHYLAXIS_PER_MILLION} per million = ${fmt(per100kFromPerMillion(ALL_VACCINE_ANAPHYLAXIS_PER_MILLION), 3)} per 100,000 doses is used.`,
		context:
			'US Vaccine Safety Datalink 2009-2011, 25.2 million doses, chart-confirmed cases; same across age bands.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref confirms title, authors and journal, print year 2016; no update or retraction relation; abstract quote re-read in a second search.'
		}
	},
	{
		id: 'moro-2022-varicella-vaers',
		authors: 'Moro PL, et al.',
		title:
			'Safety Surveillance of Varicella Vaccines in the Vaccine Adverse Event Reporting System, United States, 2006-2020',
		journal: 'Journal of Infectious Diseases',
		year: 2022,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis of serious events after chickenpox vaccine was found; this is the largest US surveillance analysis (132.8 million doses).',
		doi: '10.1093/infdis/jiac306',
		usedFor: [
			'chickenpox.vaccines.varicella.seriousPer100kDoses',
			'chickenpox.vaccines.varicella.deathsPer100kDoses'
		],
		quote:
			'During 2006-2020, approximately 132.8 million VAR doses were distributed; 40 684 reports were received in VAERS (30.6/100 000 doses distributed), with 4.1% classified as serious (1.3/100 000 doses distributed).',
		location:
			"Abstract, Results; also 'AEs associated with evidence of vaccine strain varicella-zoster virus (vVZV) infection included meningitis, encephalitis, herpes zoster, and 6 deaths (all in immunocompromised persons with contraindications for vaccination).'",
		why: `1.3 serious reports per 100,000 doses, used as is: an upper bound, since a serious report is not proof the vaccine caused it. Deaths are worked out: ${MORO.deaths} vaccine-strain deaths in ${fmt(MORO.doses / 1e6, 1)} million doses = ${fmt(MORO.per100k, 4)} per 100,000 doses. All were in people with weakened immune systems who should not have had this vaccine; that is said beside the number rather than leaving it out.`,
		context: 'US passive surveillance, 2006-2020.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Second search confirmed title, first author, journal, year, DOI and quotes. Only the first author is given; no retraction seen.'
		}
	},
	{
		id: 'miller-2015-deaths-after-vaccination',
		authors: 'Miller E, et al.',
		title: 'Deaths following vaccination: What does the evidence show?',
		journal: 'Vaccine',
		year: 2015,
		evidence: 'review',
		doi: '10.1016/j.vaccine.2015.05.023',
		noReviewReason:
			'IOM 2012 (systematic review) judged the evidence on seasonal influenza vaccine and GBS inadequate to accept or reject causation but does not discuss deaths; no systematic review or meta-analysis of deaths caused by influenza vaccine was found. This CDC-authored review is the source that addresses vaccine-caused death directly.',
		usedFor: ['flu.vaccines.inactivated.deathsPer100kDoses', 'polio.vaccines.OPV.deathsPer100kDoses'],
		quote:
			'Approximately 5% of Guillain-Barré syndrome cases are fatal [52], but given the indeterminate association between influenza vaccination and GBS, risk of death from vaccine-associated GBS would have to be considered theoretical. … Rare cases where a known or plausible theoretical risk of death following vaccination exists include anaphylaxis, … Guillain-Barré syndrome after inactivated influenza vaccine, … and vaccine-associated paralytic poliomyelitis from oral poliovirus vaccine.',
		location:
			'Section 4.4 (Guillain–Barré syndrome after seasonal and 2009 H1N1 inactivated influenza vaccines); Abstract',
		why: `Flu: a death from vaccine-linked GBS is only theoretical, so deaths are 'none established'. If the link were causal, ${FLU_SERIOUS.gbsPerMillion[0]}-${FLU_SERIOUS.gbsPerMillion[1]} GBS cases per million doses x 4.6% fatal (Censi 2024, GBS after COVID-19 vaccines) would be ${fmt(per100kFromPerMillion(FLU_SERIOUS.gbsPerMillion[0] * 0.046), 4)}-${fmt(per100kFromPerMillion(FLU_SERIOUS.gbsPerMillion[1] * 0.046), 4)} per 100,000 doses, shown only as context. OPV: names vaccine-caused paralysis as a cause of death, which backs the worked-out OPV rate.`,
		context:
			'Review by CDC authors; it also warns against reading reports of deaths after vaccination as caused by it.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Second search confirmed title, first author, journal, year, DOI and quote. Only the first author is given.'
		}
	},
	{
		id: 'lane-1969-smallpox-complications',
		authors: 'Lane JM, et al.',
		title: 'Complications of smallpox vaccination, 1968',
		journal: 'New England Journal of Medicine',
		year: 1969,
		evidence: 'study',
		noReviewReason:
			'Routine smallpox vaccination ended before pooled analyses of its complications were made; this 1968 US national survey is still the standard reference.',
		doi: '10.1056/NEJM196911272812201',
		usedFor: [
			'smallpox.vaccines.vaccinia.seriousPer100kDoses',
			'smallpox.vaccines.vaccinia.deathsPer100kDoses'
		],
		quote:
			'There were 74 complications and one death per 1,000,000 primary vaccinations. Morbidity and mortality rates were highest for infants, with 112 complications and five deaths per 1,000,000 primary vaccinations.',
		location: 'Abstract',
		why: `${LANE.complicationsPerMillion} complications per million primary vaccinations = ${fmt(per100kFromPerMillion(LANE.complicationsPerMillion), 1)} per 100,000 (not all serious, so an upper bound); ${LANE.deathsPerMillion} death per million = ${fmt(per100kFromPerMillion(LANE.deathsPerMillion), 1)} per 100,000 (infants 0.5). These deaths were caused by the vaccine.`,
		context:
			"US 1968, NYCBH vaccinia strain; deaths from postvaccinial encephalitis, vaccinia necrosum and eczema vaccinatum. Today's populations may fare worse because more people have weakened immunity or eczema.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened in a second search; title, first author, journal, year, DOI and quote confirmed. Only the first author is given.'
		}
	},
	{
		id: 'choi-2021-acip-ebola',
		authors:
			'Choi MJ, Cossaboom CM, Whitesell AN, Dyal JW, Joyce A, Morgan RL, Campos-Outcalt D, Person M, Ervin E, Yu YC, Rollin PE, Harcourt BH, Atmar RL, Bell BP, Helfand R, Damon IK, Frey SE',
		title:
			'Use of Ebola Vaccine: Recommendations of the Advisory Committee on Immunization Practices, United States, 2020',
		journal: 'MMWR Recommendations and Reports',
		year: 2021,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/mmwr/volumes/70/rr/rr7001a1.htm',
		usedFor: [
			'ebola.vaccines.rVSV-ZEBOV.seriousPer100kDoses',
			'ebola.vaccines.rVSV-ZEBOV.deathsPer100kDoses'
		],
		quote:
			'Overall, reported vaccine-related serious adverse events were rare. Across 12 clinical trials, out of 15,399 persons who received the vaccine, three serious adverse events were judged to be related or possibly related to the vaccine: one febrile reaction, one anaphylactic reaction, and one influenza-like illness. All resolved without sequelae.',
		location: "'Vaccine-Related Serious Adverse Events' section; MMWR Recomm Rep 70(1):1-12",
		why: `Worked out: ${CHOI.events} / ${fmt(CHOI.people)} people = ${fmt(CHOI.per100k, 1)} per 100,000; the vaccine is one dose, so this is also per 100,000 doses. All three resolved with no lasting harm and no vaccine-related death is reported, so deaths are 'none established'.`,
		context: 'Clinical-trial data (rVSV-ZEBOV); MMWR 70(1):1-12.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened; quotes confirmed verbatim; authors and issue confirmed.'
		}
	},
	{
		id: 'liu-2021-realworld-ve-meta',
		authors: 'Liu Q, Qin C, Liu M, Liu J',
		title:
			'Effectiveness and safety of SARS-CoV-2 vaccine in real-world studies: a systematic review and meta-analysis',
		journal: 'Infectious Diseases of Poverty',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1186/s40249-021-00915-3',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8590867/',
		usedFor: [
			'covid19.fullEfficacy',
			'covid19.partialEfficacy',
			'covid19.vaccines.covid-original.full.infection',
			'covid19.vaccines.covid-original.full.severe',
			'covid19.vaccines.covid-original.partial.infection',
			'covid19.vaccines.covid-original.partial.severe'
		],
		quote:
			'For the first dose of SARS-CoV-2 vaccines, the pooled VE was 41% (95% CI: 28–54%) for the prevention of SARS-CoV-2 infection, 52% (95% CI: 31–73%) for the prevention of symptomatic COVID-19, 66% (95% CI: 50–81%) for the prevention of hospital admissions … For the second dose of SARS-CoV-2 vaccines, the pooled VE was 85% (95% CI: 81–89%) for the prevention of SARS-CoV-2 infection, 97% (95% CI: 97–98%) for the prevention of symptomatic COVID-19, 93% (95% CI: 89–96%) for the prevention of hospital admissions',
		location:
			"Results, 'Vaccine effectiveness for different clinical outcomes of COVID-19', and Table 1. Timing subgroups for infection: one dose 14 days or more 48%, 21 days or more 56%; two doses 14 days or more 81%.",
		why: 'One meta-analysis of real-world use gives all four numbers on the same outcomes: two doses 0.85 against infection and 0.93 against hospital admission; one dose 0.41 and 0.66. Hospital admission is counted in everyone vaccinated, so it fits the severe slot. Kow & Hasan 2021 checks the infection values for the mRNA vaccine alone.',
		context:
			'Observational studies to 22 Jul 2021: original strain and Alpha (some Gamma and Delta in a separate analysis). The outcome is laboratory-confirmed infection, kept separate from symptomatic COVID-19; that it includes screening of people without symptoms is inferred from the included studies (e.g. Zacay, Angel, Hall/SIREN), not stated by the authors. Pools all vaccine types, mostly mRNA (BNT162b2, some mRNA-1273), with some CoronaVac and ChAdOx1 studies. Heterogeneity is very high (I² about 99%). No mRNA-only figures for one dose, two doses or hospital admission are given (only infection after a full course in Fig. 2B: BNT162b2 89%, mRNA-1273 97%), so the entry stays pooled. Its risks are those of the mRNA vaccines; the rare blood clots with low platelets (TTS) after the AstraZeneca vaccine are a known harm of a vaccine this sim does not model, and the About page says so.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'DOI matches in the PMC open-data metadata (PMC8590867 v1 and v2) and OpenAlex; title, authors, Infect Dis Poverty 2021;10:132 match. Full text gives 85% and 41% against infection, 93% and 66% against hospitalisation. is_retracted false; no correction notice. The screening reading is an inference from the included studies, not a statement in the paper.'
		}
	},
	{
		id: 'feikin-2022-covid-ve-duration',
		authors:
			"Feikin DR, Higdon MM, Abu-Raddad LJ, Andrews N, Araos R, Goldberg Y, Groome MJ, Huppert A, O'Brien KL, Smith PG, Wilder-Smith A, Zeger S, Deloria Knoll M, Patel MK",
		title:
			'Duration of effectiveness of vaccines against SARS-CoV-2 infection and COVID-19 disease: results of a systematic review and meta-regression',
		journal: 'The Lancet',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1016/S0140-6736(22)00152-0',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8863502/',
		usedFor: ['covid19.vaccines.covid-original.waningDays'],
		quote:
			'COVID-19 vaccine efficacy or effectiveness against severe disease remained high, although it did decrease somewhat by 6 months after full vaccination. By contrast, vaccine efficacy or effectiveness against infection and symptomatic disease decreased approximately 20-30 percentage points by 6 months. … On average, vaccine efficacy or effectiveness against SARS-CoV-2 infection decreased from 1 month to 6 months after full vaccination by 21·0 percentage points (95% CI 13·9–29·8) among people of all ages',
		location: 'Summary: Interpretation; Findings',
		why: `Worked out: half-life assuming exponential decay from Liu 2021's ${FEIKIN.start} with the Findings' ${fmt(FEIKIN.drop * 100, 1)}-point fall against infection between months 1 and 6 (5 x 365.25 / 12 = ${fmt(FEIKIN.windowDays, 1)} days): ${FEIKIN.start} -> ${fmt(FEIKIN.end, 2)} gives ${fmt(FEIKIN.windowDays, 1)} x ln2 / ln(${FEIKIN.start} / ${fmt(FEIKIN.end, 2)}) = ${fmt(FEIKIN.exponential)} days; a straight-line fall reaches half of ${FEIKIN.start} after ${fmt(FEIKIN.straightLine)} days. The middle of the two, ${fmt(FEIKIN.halfLife)} days, is used. Over the whole 20-30 point range in the Interpretation, the exponential gives about 240-390 days.`,
		context:
			"Meta-regression of 18 studies, all before Omicron spread widely; 78 vaccine-specific evaluations (Pfizer 38, Moderna 23, Janssen 9, AstraZeneca 8). Gives falls in percentage points, not a starting value, so the half-life depends on the starting value taken from Liu 2021. In its own words, protection against severe disease 'remained high, although it did decrease somewhat by 6 months' (a 10.0-point fall). Two correction notices: 10.1016/S0140-6736(22)00428-7 fixes one label in Table 4; 10.1016/S0140-6736(23)00331-8 (23 Feb 2023) corrects the appendix's meta-regression methods. Neither changes the figures in the abstract.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, authors, The Lancet 399(10328):924-944 (March 2022) match; updated-by lists two errata and no retraction. The first erratum, read on thelancet.com, fixes a label in Table 4 (column 1, row 5), corrected online 4 April 2022; the second could not be opened in that pass. Interpretation and Findings quotes verbatim in the abstract; full text read in PMC8863502.'
		}
	},
	{
		id: 'menegale-2023-waning-meta',
		authors:
			"Menegale F, Manica M, Zardini A, Guzzetta G, Marziano V, d'Andrea V, Trentini F, Ajelli M, Poletti P, Merler S",
		title:
			'Evaluation of Waning of SARS-CoV-2 Vaccine–Induced Immunity: A Systematic Review and Meta-analysis',
		journal: 'JAMA Network Open',
		year: 2023,
		evidence: 'meta-analysis',
		doi: '10.1001/jamanetworkopen.2023.10650',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10157431/',
		usedFor: [
			'covid19omicron.vaccines.covid-original.waningDays',
			'covid19omicron.vaccines.covid-updated.waningDays',
			'covid19omicron.fullEfficacy',
			'covid19omicron.vaccines.covid-original.full.infection',
			'covid19omicron.vaccines.covid-updated.full.infection'
		],
		quote:
			'The estimated half-life of vaccine-induced immunity against laboratory-confirmed SARS-CoV-2 infection was 540 days (95% CI, 494-596 days) for Delta and 143 days (95% CI, 108-220 days) for Omicron. … We estimated that the VE against laboratory-confirmed Omicron infection was 44.4% (95% CI, 37.7%-51.1%) at 1 month after completion of any primary vaccination cycle, 20.7% (95% CI, 15.1%-26.4%) at 6 months, and 13.4% (95% CI, 7.8%-18.9%) at 9 months (Figure 3 and eFigure 8 in Supplement 1).',
		location:
			"Results, laboratory-confirmed infection paragraph (half-life) and 'VE Against Laboratory-Confirmed Infection' (the 1-, 6- and 9-month figures); model in Methods: 'VE(t) = Ae−w t … We estimated the mean half-life of vaccine-induced protection as log(2)/w + 14 days'",
		why: `Worked out: the paper's ${MENEGALE.reported}-day half-life is defined as log(2)/w + ${MENEGALE.rampUp} days, a pure exponential decay plus a ${MENEGALE.rampUp}-day ramp-up after the dose. The model's waning is pure exponential decay, so the half-life used is log(2)/w = ${MENEGALE.reported} - ${MENEGALE.rampUp} = ${MENEGALE.halfLife} days. Used for the original vaccine against Omicron infection, and, as an assumption, for the updated vaccine too: it is taken to wane like the original against Omicron, because no pooled waning figure for the bivalent vaccine against an unvaccinated comparator was found. The second sentence gives the start the sim uses for the original vaccine against infection: ${OMICRON_VACCINE.originalInfection} one month after the course, on the same footing as the half-life.`,
		context:
			'40 studies of original (ancestral) vaccines; Omicron BA.1/BA.2. Pooled VE against laboratory-confirmed Omicron infection 44.4% at 1 month, 20.7% at 6 months and 13.4% at 9 months after the primary course. Laboratory-confirmed infection mixes symptomatic and under-counted symptomless infections. No severe-disease analysis.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: "DOI matches in the PMC open-data metadata (PMC10157431) and OpenAlex; title, authors, JAMA Netw Open 2023;6(5):e2310650 match. Quote and the exponential model found in the full text, including the half-life definition 'log(2)/w + 14 days'. The month-1 sentence (44.4% at 1 month, 20.7% at 6 months) confirmed verbatim in Results, 'VE Against Laboratory-Confirmed Infection' (second pass, 8 Oct). is_retracted false; no correction notice."
		}
	},
	{
		id: 'cheng-2024-bivalent-rve-meta',
		authors: 'Cheng M-Q, Li R, Weng Z-Y, Song G',
		title: 'Relative effectiveness of bivalent COVID-19 vaccine: a systematic review and meta-analysis',
		journal: 'Frontiers in Medicine',
		year: 2024,
		evidence: 'meta-analysis',
		doi: '10.3389/fmed.2023.1322396',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10879625/',
		usedFor: [
			'covid19omicron.fullEfficacy',
			'covid19omicron.vaccines.covid-updated.full.infection',
			'covid19omicron.vaccines.covid-updated.full.severe'
		],
		quote:
			'Meta-analysis results showed, compared with the monovalent vaccines (MVs), the relative effectiveness (rVE) of the BVs in COVID-19-associated infections/symptomatic infections, illnesses, hospitalizations, and deaths was 30.90% [95% confidence interval (CI), 8.43–53.37], 39.83% (95% CI, 27.34–52.32), 59.70% (95% CI, 44.08–75.32), and 72.23% (95% CI, 62.08–82.38), respectively.',
		location: 'Abstract, Results; repeated in the Discussion',
		why: `Worked out: Cheng gives the bivalent vaccine's protection relative to the original vaccine, not against unvaccinated people, so it is applied on top of the original vaccine's figures near the dose (Menegale 2023 for infection, Mohammed 2023 for severe disease): infection 1 - (1 - ${OMICRON_VACCINE.bivalentRelativeInfection}) x (1 - ${OMICRON_VACCINE.originalInfection}) = ${fmt(stacked(OMICRON_VACCINE.bivalentRelativeInfection, OMICRON_VACCINE.originalInfection), 3)}, and severe disease (hospital admission) 1 - (1 - ${OMICRON_VACCINE.bivalentRelativeSevere}) x (1 - ${OMICRON_VACCINE.originalSevere}) = ${fmt(stacked(OMICRON_VACCINE.bivalentRelativeSevere, OMICRON_VACCINE.originalSevere), 3)}. This keeps the original and updated vaccines on the same footing, both against unvaccinated people.`,
		context:
			"Systematic review and meta-analysis of 22 observational studies, search to 4 Nov 2023; bivalent (BA.1 or BA.4-5) boosters against original monovalent doses. Infection and symptomatic infection are pooled together (I² = 99.6%). No waning estimate. As a check in words only: Ma 2025's meta-analysis of the XBB.1.5 vaccine gives 0.529 against infection in the first month, but its full text could not be checked and it measures added protection in people who were already immune, so it is not used.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'DOI matches in the PMC open-data metadata (PMC10879625) and OpenAlex; title, four authors, Front Med (Lausanne) 2024;10:1322396 match; confirmed as a systematic review and meta-analysis (PRISMA). Full text gives 30.90% (8.43-53.37) and 59.70% (44.08-75.32). is_retracted false; no correction notice.'
		}
	},
	{
		id: 'ranjeva2019-flu-infection-protection',
		authors: 'Ranjeva S, Subramanian R, Fang VJ, et al.',
		title: 'Age-specific differences in the dynamics of protective immunity to influenza',
		journal: 'Nature Communications',
		year: 2019,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis or systematic review of how long protection after flu infection lasts, with a figure that can be read as a half-life, was found.',
		doi: '10.1038/s41467-019-09652-6',
		url: 'https://www.nature.com/articles/s41467-019-09652-6',
		usedFor: ['flu.waningDays'],
		quote:
			'In adults, the model favors non-HI-correlated protection against H3N2, with a half-life of 4.1y (95% CI (3.2, 5.5)) (Table1).',
		location:
			"Results; Table 1. Abstract: 'Protection against circulating strains wanes to half of peak levels 3.5–7 years after infection in both age groups, and wanes faster against influenza A(H3N2) than A(H1N1)pdm09.'",
		why: `Already a half-life of infection-acquired protection: H3N2 in adults, ${RANJEVA_HALF_LIFE_YEARS} years = ${fmt(RANJEVA_HALF_LIFE_YEARS * DAYS_PER_YEAR, 1)} days. H3N2 is the faster-waning subtype; the abstract range is 3.5-7 years (1,278-2,557 days), and adults against H1N1pdm09 about 6.4 years.`,
		context:
			"Hong Kong household cohort; mechanistic models fitted to repeated blood samples. Measures protection 'against circulating strains', so it includes the effect of the virus drifting.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, nine authors, Nat Commun 10, article 1660 (10 April 2019) match; only relation is a preprint (not used); no correction or retraction. Abstract and Results quotes verbatim; Table 1 lists H3N2 adults 4.1y [3.2, 5.5]. 4.1 years recomputed as 1,497.5 days.'
		}
	},
	{
		id: 'lewnard-grad-2018-mumps-waning',
		authors: 'Lewnard JA, Grad YH',
		title: 'Vaccine waning and mumps re-emergence in the United States',
		journal: 'Science Translational Medicine',
		year: 2018,
		evidence: 'study',
		noReviewReason:
			'A pooled re-analysis of six vaccine-effectiveness studies, not a formal meta-analysis. Cochrane (Di Pietrantonj 2021) pools effectiveness without time since the dose, so it can’t be paired with a half-life; Lewnard fits starting protection and waning together across six studies. The antibody meta-analysis (Schenk 2021) measures antibodies, not protection.',
		doi: '10.1126/scitranslmed.aao5945',
		usedFor: [
			'mumps.vaccines.MMR.waningDays',
			'mumps.fullEfficacy',
			'mumps.partialEfficacy',
			'mumps.vaccines.MMR.full.infection',
			'mumps.vaccines.MMR.partial.infection'
		],
		quote:
			'Applying our estimate of the vaccine waning rate to a model of exponentially distributed durations of protection, we estimated that immunity persists, on average, 27.4 years [95% confidence interval (CI), 16.7 to 51.1 years] after receipt of any dose. … we thus expected that 25% may lose protection within 7.9 years (95% CI, 4.7 to 14.7 years), 50% within 19.0 years (95% CI, 11.2 to 35.4 years), and 75% within 38.0 years (95% CI, 22.4 to 70.8 years). … At 6 months after vaccine receipt (the earliest time point assessed in primary studies), we estimate that 96.4% (94.0 to 97.8%) of recipients are protected; we apply this as our estimate of the probability of vaccine take.',
		location:
			"Results, vaccine waning estimate; Fig. 1 legend, panels B (take) and E (no difference by dose); abstract: 'wanes on average 27 years (95% confidence interval, 16 to 51 years)'",
		why: `Read off '50% within ${fmt(LEWNARD_HALF_LIFE_YEARS, 1)} years': the source uses exponential waning like the model, so ${fmt(LEWNARD_HALF_LIFE_YEARS, 1)} x 365.25 = ${fmt(LEWNARD_HALF_LIFE_YEARS * DAYS_PER_YEAR, 2)} days (95% CI 4,091-12,930 days). Check: 27.4 x ln2 = 18.99 years. Starting protection is the paper's take, ${LEWNARD_TAKE}, for one dose or two: Fig. 1E finds no difference in waning after a first or second dose, so the gap seen in the field is mostly time since the last dose.`,
		context:
			'Six published mumps vaccine-effectiveness studies pooled, plus a US transmission model; the clock runs from the last dose. The 3.6% who never respond to the vaccine are covered by the efficacy values, not by waning.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Crossref: title, authors, Sci Transl Med 10(433):eaao5945 (21 March 2018) match; only relation is a preprint (not used); no update-to or updated-by. Results and abstract quotes verbatim, including the 96.4% take at 6 months (Results and Fig. 1B) and no difference by dose (Fig. 1E). 19.0 x 365.25 recomputed as 6,939.75 days.'
		}
	},
	{
		id: 'who-2007-mumps-position-paper',
		authors: 'World Health Organization',
		title: 'Mumps virus vaccines: WHO position paper',
		journal: 'Weekly Epidemiological Record 82(7)',
		year: 2007,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/publications/i/item/WHO-WER8207-51-60',
		usedFor: ['mumps.waningDays'],
		quote: 'Natural infection with this virus is thought to confer lifelong protection.',
		location:
			"Weekly Epidemiological Record 82(7):51-60, 16 February 2007; last sentence of the first 'Summary and conclusions' paragraph",
		why: "waningDays=null for infection-acquired immunity: WHO says natural infection is thought to protect for life, far longer than any run. The CDC Pink Book chapter on mumps does not say this (it notes only that reinfection has been reported), so WHO's position paper is the official source.",
		context:
			"Background also says: 'In general, natural infection confers lifelong protection against the disease, but recurrent mumps attacks have been reported.' The model does not show reinfection.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: "Separate verification pass, 7 Oct 2026 (not the pass that found it): quote exact in the English text, and the French matches. WHO's catalogue gives pp. 51-60 but the PDF's own page markers read 50-59, so the location is given by section rather than page."
		}
	},
	{
		id: 'chit2018-acellular-pertussis-ve-waning',
		authors: 'Chit A, Zivaripiran H, Shin T, et al.',
		title:
			'Acellular pertussis vaccines effectiveness over time: A systematic review, meta-analysis and modeling study',
		journal: 'PLOS ONE',
		year: 2018,
		evidence: 'meta-analysis',
		doi: '10.1371/journal.pone.0197970',
		url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0197970',
		usedFor: ['pertussis.vaccines.DTaP.waningDays'],
		quote:
			'We estimate initial childhood series absolute VE is 91% (95% CI: 87% to 95%) and declines at 9.6% annually. … the primary acellular pertussis series (5-dose DTaP) … VEexpected=VEbaseline e−λ(time)',
		location:
			"Abstract; Results (primary series: 'estimated at 91% … and declined by 9.6% per year'); Methods (objectives and the exponential model)",
		why: `Used for waning only: the childhood series decays by ${CHIT.decayPerYear} a year, a half-life of ln2 / ${CHIT.decayPerYear} = ${fmt(CHIT.halfLifeYears, 2)} years = ${fmt(CHIT.halfLife)} days. Its ${CHIT.start} starting figure is fitted and the study was funded by the vaccine's maker, so the start comes from Fulton 2016 (${PERTUSSIS_VACCINE.full}) instead; the gap is under 10%.`,
		context:
			'US and other high-income settings. The full 6-dose series with the adolescent Tdap booster is 85% falling 11.7% a year (by year 3 49%, year 5 37%, year 7 28%). The childhood absolute figures are partly modelled: they come from transforming relative odds ratios. A fit to the five pooled points gives 2,839 days. Eight of the nine authors worked for Sanofi Pasteur, which makes pertussis vaccine and funded the study.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Separate verification pass, 7 Oct 2026: the childhood (5-dose DTaP) series figures, 91% and 9.6% a year, confirmed verbatim in the abstract and Results of the PMC text (PMC6005504); 85% falling 11.7% is the 6-dose series with the adolescent booster. Half-life ln2 / 0.096 = 7.22 years = 2,637 days reproduced. No correction notice in PMC.'
		}
	},
	{
		id: 'mcgirr-fisman-2015-dtap-duration',
		authors: 'McGirr A, Fisman DN',
		title: 'Duration of Pertussis Immunity After DTaP Immunization: A Meta-analysis',
		journal: 'Pediatrics',
		year: 2015,
		evidence: 'meta-analysis',
		doi: '10.1542/peds.2014-1729',
		usedFor: ['pertussis.vaccines.DTaP.waningDays'],
		quote:
			'For every additional year after the last dose of DTaP, the odds of pertussis increased by 1.33 times (95% confidence interval: 1.23-1.43). Assuming 85% vaccine efficacy, we estimated that 10% of children vaccinated with DTaP would be immune to pertussis 8.5 years after the last dose.',
		location: 'Abstract (Results)',
		why: `Check only: ${MCGIRR.start * 100}% immune falling to ${MCGIRR.end * 100}% in ${MCGIRR.years} years gives an exponential half-life of ${fmt(MCGIRR.exponential)} days, or ${fmt(MCGIRR.straightLine)} days if the fall is a straight line. Both are shorter than the ${fmt(CHIT.halfLife)} days from Chit 2018's childhood series, which sets the value as the newer meta-analysis with yearly estimates; McGirr assumes 85% at the start and measures time since the last dose, so it suggests faster waning than the value used.`,
		context:
			"11 studies of 3- or 5-dose DTaP in children; the paper's exact model of failure over time is not confirmed (full text not read).",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Crossref: title, authors, Pediatrics 135(2):331-343 (1 Feb 2015) match; only relation is an F1000 review; no correction or retraction. Abstract quote verbatim. Half-lives recomputed: 1,006 days exponential, 1,759 linear.'
		}
	},
	{
		id: 'wendelboe2005-pertussis-immunity-duration',
		authors: 'Wendelboe AM, Van Rie A, Salmaso S, Englund JA',
		title: 'Duration of Immunity Against Pertussis After Natural Infection or Vaccination',
		journal: 'The Pediatric Infectious Disease Journal',
		year: 2005,
		evidence: 'systematic-review',
		doi: '10.1097/01.inf.0000160914.59160.41',
		usedFor: ['pertussis.waningDays'],
		quote:
			'A review of the published data on duration of immunity reveals estimates that infection-acquired immunity against pertussis disease wanes after 4-20 years and protective immunity after vaccination wanes after 4-12 years.',
		location: 'Abstract',
		why: `Worked out: the middle of the ${WENDELBOE_YEARS[0]}-${WENDELBOE_YEARS[1]} years after infection is ${(WENDELBOE_YEARS[0] + WENDELBOE_YEARS[1]) / 2} years = ${fmt(WENDELBOE_HALF_LIFE)} days, treated as a half-life. The review gives times by which waning occurs in individual studies, not half-lives, so this is an approximation.`,
		context:
			"Mostly whole-cell vaccine era. Wearing & Rohani 2009 cite this review as '7-20 years' for natural immunity; the 4-20 here is the review's own abstract.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'DOI found and confirmed. Crossref: title, four authors, Pediatr Infect Dis J 24(5 Suppl):S58-S61 (May 2005) match; no update or relation entries. Abstract wording verbatim; full text not read.'
		}
	},
	{
		id: 'famulare2018-opv-waning',
		authors: 'Famulare M, Selinger C, McCarthy KA, Eckhoff PA, Chabot-Couture G',
		title: 'Assessing the stability of polio eradication after the withdrawal of oral polio vaccine',
		journal: 'PLOS Biology 16(4):e2002468',
		year: 2018,
		evidence: 'study',
		noReviewReason:
			'No systematic review or meta-analysis estimates how OPV-induced gut immunity against infection decays with time since the last dose. The two higher-ranked sources in this area measure gut immunity at a single point after a primary series, with no time axis: Grassly 2019 network meta-analysis (10.1016/s1473-3099(19)30301-9) and Hird & Grassly 2012 systematic review and meta-analysis (10.1371/journal.ppat.1002599).',
		doi: '10.1371/journal.pbio.2002468',
		url: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468',
		mirrorUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5942853/',
		usedFor: ['polio.vaccines.OPV.waningDays'],
		quote:
			'We modeled waning as a power-law decay [83] during the months since last immunization, NAb(t) ∝ t-λ, with exponent λ = 0.87 (0.73–1.02) (S1 Text Eq F). … Our waning model (S1 Text Eq F, Fig 4) predicts that without reinfection, typical peak OPV-equivalent antibody titers (NAb = 2,048) decline to typical three-dose healthy child immunity (NAb = 512) in 5 (4–7) months and to typical two-dose immunity (NAb = 64) in an additional 4 (2–10) years. … Susceptibility is also strongly impacted by immunity, with the expected fraction shedding after Sabin 2 challenge dropping below half at all relevant doses for NAb ≥ 64 (Fig 7B).',
		location:
			"Methods, 'Waning immunity' (power-law model); Results, paragraph after the Fig 7 caption (titre milestones); Results, last sentence of the paragraph introducing Fig 7 (NAb ≥ 64); Methods, 'Oral susceptibility to infection' (unprotected shedding approaches 1)",
		why: `Worked out: protection against infection is taken as 1 minus the share shedding after challenge, which is about half once antibodies fall to 64. Peak immunity (2,048) reaches 64 in ${FAMULARE.months} months plus ${FAMULARE.years} years = ${fmt(FAMULARE.halfLife / DAYS_PER_YEAR, 2)} years = ${fmt(FAMULARE.halfLife)} days (the reported windows give 850 to 3,865 days). Check: a 32-fold fall under t^-0.87 takes 32^(1/0.87) = 53.7 times as long, month 1 to month 54, about 4.5 years.`,
		context:
			"Gut immunity against infection and shedding after a full OPV series, not protection against paralysis, which is lifelong (cdc-pinkbook-polio). An order-of-magnitude figure that leans towards faster waning: NAb 64 is a threshold, and unprotected shedding is below 1 at realistic doses. The decay is a power law, so an exponential with this half-life overstates waning after about 5 years (the same model has 'residual immunity' persisting for life).",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'DOI resolves to PLOS Biology 2018;16(4):e2002468; authors, year and journal match. All quotes found verbatim in the PMC open-access text (PMC5942853.1); locations corrected. Arithmetic reproduced. No correction or retraction on the PLOS or PMC pages; registries (Europe PMC, OpenAlex) could not be reached.'
		}
	},
	{
		id: 'bolormaa2025-varicella-duration',
		authors: 'Bolormaa E, Lee YH, Choe YJ, Choe SA',
		title:
			'Varicella Vaccine Effectiveness and Duration of Protection: A Systematic Review and Meta-Analysis',
		journal: 'Journal of Korean Medical Science 40:e286',
		year: 2025,
		evidence: 'meta-analysis',
		doi: '10.3346/jkms.2025.40.e286',
		url: 'https://jkms.org/DOIx.php?id=10.3346%2Fjkms.2025.40.e286',
		usedFor: [
			'chickenpox.vaccines.varicella.waningDays',
			'chickenpox.fullEfficacy',
			'chickenpox.partialEfficacy',
			'chickenpox.vaccines.varicella.full.infection',
			'chickenpox.vaccines.varicella.partial.infection',
			'chickenpox.vaccines.varicella.partial.severe'
		],
		quote:
			'For single-dose vaccines, VE decreased from 87.8% (81.4–94.4%; I2 = 96.0%) one-year post-vaccination … For two-dose vaccinations, VE decreased from 93.5% (92.1-94.9; I2 = 31.6%) in the first year to 49.6% (46.5-82.7; I2 = 100%) by nine years post-vaccination (Table 3). … The duration of protection showed a slight decline over time. Evidence suggests that both one and two doses of the varicella vaccine offer short-term protection, though this protection wanes rapidly.',
		location:
			"Results, paragraph beginning 'Thirteen studies assessed the duration of varicella vaccine protection (Table 2)', with Tables 2 and 3; conclusion in the Abstract",
		why: `Worked out from the two-dose series (a full course): exponential fall from ${BOLORMAA.early.ve}% at year ${BOLORMAA.early.year} to ${BOLORMAA.late.ve}% at year ${BOLORMAA.late.year}, half-life ${fmt(BOLORMAA.halfLife / DAYS_PER_YEAR, 2)} years = ${fmt(BOLORMAA.halfLife)} days. The only meta-analysis found that reports effectiveness by year since vaccination. Low confidence; see context. Its year-1 figures, ${BOLORMAA.early.ve / 100} for two doses and ${BOLORMAA_ONE_DOSE_YEAR1} for one, are where protection starts, on the same footing as the half-life.`,
		context:
			"Mostly observational outbreak studies. The year-9 two-dose estimate has I2 = 100% and a confidence interval that does not contain its own point estimate as printed. The one-dose series rises again (65.2% at year 6, 70.2% at year 7, 81.8% at year 10), so a fit over all its points implies a half-life of decades; it is not used. Pawaskar 2022's network meta-analysis of trials found no waning over 10 years, so the plausible range runs from about 6 years to no meaningful waning.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Results paragraph and abstract conclusion confirmed verbatim at jkms.org, including the one-dose 87.8% at year one; the abstract continues "wanes rapidly", so it is quoted in full. Arithmetic reproduced. Tables 2-3 themselves not opened (prose values only, so the text figures 87.8% and 93.5% are used, not the tables\' two-decimal values). No retraction visible on the publisher page; registries could not be reached.'
		}
	},
	{
		id: 'pawaskar2022-varicella-nma',
		authors: 'Pawaskar M, et al.',
		title: 'Relative efficacy of varicella vaccines: network meta-analysis of randomized controlled trials',
		journal: 'Current Medical Research and Opinion',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1080/03007995.2022.2091334',
		usedFor: ['chickenpox.vaccines.varicella.waningDays'],
		quote:
			'MBNMA indicated that protection against varicella was sustained without waning over the 10 year follow-up.',
		location: 'Abstract (Results)',
		why: 'The counterpoint to Bolormaa 2025, cited so the disagreement is visible: trials alone show no waning over 10 years. Not used for the value because it gives no year-by-year series and covers trial settings with little exposure.',
		context:
			'8 randomised trials of Varivax, Varilrix, Priorix-Tetra and Sinovac vaccines; efficacy in trials, not effectiveness in use.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'DOI, journal, year and quote confirmed from the abstract record; the publisher page (403) and volume/pages were not read. No retraction seen.'
		}
	},
	{
		id: 'who-wer-2024-sage-ebola',
		authors: 'World Health Organization, Strategic Advisory Group of Experts on Immunization',
		title:
			'Extraordinary meeting of the Strategic Advisory Group of Experts on Immunization on Ebola vaccination, May 2024: conclusions and recommendations',
		journal: 'Weekly Epidemiological Record 99(27):355-362',
		year: 2024,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/publications/i/item/WER-9927-355-362',
		mirrorUrl: 'https://www.nitag-resource.org/sites/default/files/2024-07/WER9927-eng-fre.pdf',
		usedFor: ['ebola.vaccines.rVSV-ZEBOV.waningDays'],
		quote:
			'Duration of protective clinical efficacy has not been formally assessed but Ebola-specific antibodies after rVSVΔG-ZEBOV-GP vaccination have been shown to be sustained without evidence of waning for at least 5 years.',
		location: "p. 356, section 'rVSVΔG-ZEBOV-GP vaccine'; revaccination guidance on p. 359",
		why: 'waningDays null: WHO finds no evidence of waning for at least 5 years, so no half-life is established. Huttner 2023 shows the same flat antibody levels from year 1 to year 5.',
		context:
			'Based on antibody persistence, not clinical protection over time, which has not been formally assessed; null is a statement about 5 years, not decades. WHO still offers ring contacts vaccinated more than 6 months earlier an extra dose (p. 359).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Published WER wording and pages confirmed by two agreeing reads of the official bilingual PDF (mirror); WHO IRIS returned 403, so not compared character by character there.'
		}
	},
	{
		id: 'huttner2023-rvsv-zebov-5-year',
		authors: 'Huttner A, et al.',
		title:
			'Antibody responses to recombinant vesicular stomatitis virus-Zaire Ebolavirus vaccination for Ebola virus disease across doses and continents: 5-year durability',
		journal: 'Clinical Microbiology and Infection 29(12):1587-1594',
		year: 2023,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis or systematic review of how long rVSV-ZEBOV protection lasts exists; the official source (WHO SAGE 2024) sets the value and this is the cohort behind it.',
		doi: '10.1016/j.cmi.2023.08.026',
		usedFor: ['ebola.vaccines.rVSV-ZEBOV.waningDays'],
		quote:
			'ZEBOV-GP ELISA IgG GMTs plateaued, with no declining trend from 1 year through the last time point assessed (1147.8 [95% CI 874.3-1507.0] at Y1 versus 1548.1 [95% CI 1136.6-2108.5] at Y5 in Geneva volunteers receiving ≥10 million plaque-forming units of rVSV-ZEBOV)',
		location:
			"Abstract (Results); 'titres drop to approximately 50% of their peak 1 year post-vaccination' in the Introduction",
		why: 'Supports null: binding antibodies do not fall between year 1 and year 5, so no half-life can be fitted. The halving from peak to year 1 is the response settling after vaccination, not waning, and is not converted.',
		context:
			'168 healthy adults from the 2014-2015 trials in Geneva (5 years) and Lambaréné, Gabon (4 years); antibody levels only.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Abstract and Introduction quotes confirmed verbatim; pages corrected to 29(12):1587-1594 (PMID 37661067) and the published title used. No retraction seen; registries could not be reached.'
		}
	},
	{
		id: 'iom-2012-adverse-effects-vaccines',
		authors: 'Institute of Medicine (Stratton K, Ford A, Rusch E, Clayton EW, eds.)',
		title: 'Adverse Effects of Vaccines: Evidence and Causality',
		journal: 'National Academies Press',
		year: 2012,
		evidence: 'systematic-review',
		doi: '10.17226/13164',
		url: 'https://nap.nationalacademies.org/read/13164/chapter/6',
		usedFor: [
			'measles.vaccines.MMR.deathsPer100kDoses',
			'mumps.vaccines.MMR.deathsPer100kDoses',
			'rubella.vaccines.MMR.deathsPer100kDoses',
			'flu.vaccines.inactivated.deathsPer100kDoses'
		],
		quote:
			'The evidence convincingly supports a causal relationship between MMR vaccine and measles inclusion body encephalitis in individuals with demonstrated immunodeficiencies. … Furthermore, measles inclusion body encephalitis is confined to immunodeficient patients and is inevitably fatal. … No studies were identified in the literature for the committee to evaluate the risk of measles inclusion body encephalitis after the administration of MMR vaccine.',
		location:
			'Chapter 4 (Measles, Mumps, and Rubella Vaccine), measles inclusion body encephalitis: Conclusion 4.1 (about p. 126), mechanistic evidence (about p. 125), epidemiologic evidence (about p. 122); Appendix D, Table D-1 (influenza vaccine and GBS: "Inadequate")',
		why: "MMR: deaths caused by the vaccine are established, but only in people with immune deficiencies, for whom it isn't recommended, and no study gives a rate, so the kind is 'established-no-rate'. Flu: the committee found the evidence on flu vaccine and Guillain-Barré syndrome inadequate to accept or reject causation, which backs 'none-established' alongside Miller 2015.",
		context:
			'US expert committee review with systematic literature searches and explicit causality categories. The committee attributes the MMR finding to the measles component. Of the fatal cases it reviews, one has the virus confirmed as the vaccine strain (Bitnun 1999). It also finds MMR and tetanus-toxoid vaccines cause anaphylaxis ("convincingly supports"), without reporting deaths.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Conclusion 4.1, the "inevitably fatal" sentence, the no-studies sentence and the Table D-1 rows confirmed on the NAP openbook pages; printed page numbers came from a page summariser, so they are approximate. doi.org not reachable; the DOI follows NAP record 13164.'
		}
	},
	{
		id: 'iom-2003-vaccines-sudi',
		authors: 'Institute of Medicine (Stratton K, Almario DA, Wizemann TM, McCormick MC, eds.)',
		title: 'Immunization Safety Review: Vaccinations and Sudden Unexpected Death in Infancy',
		journal: 'National Academies Press',
		year: 2003,
		evidence: 'systematic-review',
		doi: '10.17226/10649',
		url: 'https://nap.nationalacademies.org/read/10649/chapter/2',
		usedFor: ['pertussis.vaccines.DTaP.deathsPer100kDoses'],
		quote:
			'The committee concludes that the evidence is inadequate to accept or reject a causal relationship between DTaP vaccine and SIDS. … The present committee concludes that the evidence favors acceptance of a causal relationship between diphtheria toxoid and whole cell pertussis vaccine and death due to anaphylaxis in infants. … despite the more than 50 years subsequent to the publication of that case report and despite the widespread use of vaccines in infants, the committee could not identify in the medical literature any additional reports of death in infants due to vaccine-related anaphylaxis.',
		location: 'Executive Summary, pp. 6-8',
		why: 'No death has been shown to be caused by the acellular vaccine (DTaP): sudden infant death is not linked, and the one documented anaphylaxis death, in 1946, followed the older whole-cell vaccine. So the kind is none-established.',
		context:
			'US expert committee review. It also finds the evidence favours rejecting a link between multiple vaccines and sudden infant death.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'All three sentences confirmed in the NAP Executive Summary, pp. 6-8 (page numbers from a page summariser).'
		}
	},
	{
		id: 'cdc-acip-2024-ipv-etr',
		authors: 'Advisory Committee on Immunization Practices (CDC)',
		title:
			'ACIP Evidence to Recommendations for Booster Doses of Inactivated Poliovirus Vaccine (IPV) Among Adults Aged ≥18 Years',
		journal: 'CDC',
		year: 2024,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/acip/evidence-to-recommendations/booster-IPV-polio-vax-adults-etr.html',
		usedFor: ['polio.vaccines.IPV.deathsPer100kDoses'],
		quote:
			'No serious adverse events have been causally associated with use of the current formulation of IPV.',
		location: "'Benefits and Harms' section (page dated 5 September 2024)",
		why: 'An official statement that no serious harm, and so no death, has been shown to be caused by IPV: none-established.',
		context:
			"Also: 'Data from more than 20 years of use as part of the routine childhood vaccination schedule have demonstrated that IPV has an excellent safety profile.'",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Both sentences confirmed in the Benefits and Harms section.'
		}
	},
	{
		id: 'halperin-2017-rvsv-zebov-phase3-safety',
		authors: 'Halperin SA, Arribas JR, Rupp R, et al.',
		title:
			'Six-Month Safety Data of Recombinant Vesicular Stomatitis Virus–Zaire Ebola Virus Envelope Glycoprotein Vaccine in a Phase 3 Double-Blind, Placebo-Controlled Randomized Study in Healthy Adults',
		journal: 'Journal of Infectious Diseases 215(12):1789-1798',
		year: 2017,
		evidence: 'study',
		noReviewReason:
			'Supports the official ACIP review (Choi 2021), which carries the value; the systematic reviews found (Bache 2020, Zarro 2025) give no explicit statement about vaccine-related deaths in their abstracts.',
		doi: '10.1093/infdis/jix189',
		usedFor: ['ebola.vaccines.rVSV-ZEBOV.deathsPer100kDoses'],
		quote:
			'Twenty-one SAEs and 2 deaths were reported, all assessed by investigators as unrelated to vaccine. … no vaccine-related SAEs or deaths.',
		location: 'Abstract (Results; Conclusions)',
		why: 'An explicit statement that no death was caused by the vaccine in a placebo-controlled trial, supporting none-established.',
		context: '1,061 vaccinated and 133 given placebo, followed for 6 months.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Abstract wording confirmed. Volume and pages not confirmed (no PMC copy; publisher not opened).'
		}
	},
	{
		id: 'cho-2023-korea-vaccine-myocarditis',
		authors: 'Cho JY, Kim KH, Lee N, et al.',
		title: 'COVID-19 vaccination-related myocarditis: a Korean nationwide study',
		journal: 'European Heart Journal 44(24):2234-2243',
		year: 2023,
		evidence: 'study',
		noReviewReason:
			'Systematic reviews of vaccine myocarditis (e.g. Ishisaka 2023) report all-cause deaths among cases without judging cause; Cho 2023 is the only nationwide study found with official expert judgement of cause, autopsy-proven vaccine-caused deaths and complete dose counts.',
		doi: '10.1093/eurheartj/ehad339',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10290868/',
		usedFor: [
			'covid19.vaccines.covid-original.deathsPer100kDoses',
			'covid19omicron.vaccines.covid-original.deathsPer100kDoses',
			'covid19omicron.vaccines.covid-updated.deathsPer100kDoses'
		],
		quote:
			'Eight out of 21 deaths were sudden cardiac death (SCD) attributable to VRM proved by an autopsy, and all cases of SCD attributable to VRM were aged under 45 years and received mRNA vaccines. … BNT162b2 (n = 24 828 152), mRNA-1273 (n = 6 781 796) … BNT162b2 (n = 23 369 725), or mRNA-1273 (n = 6 621 577) … BNT162b2 (n = 11 458 290), mRNA-1273 (n = 6 930 450)',
		location:
			"Abstract (Methods and results); Methods, 'Study population' paragraph (doses by vaccine and dose number); Table 3 (the 8 sudden deaths: 5 BNT162b2, 3 mRNA-1273); Discussion: 'Vaccine-related myocarditis was the only possible cause of death in all SCD cases.'",
		why: `Worked out: the six mRNA dose counts sum to ${fmt(CHO.mrnaDoses)}; ${CHO.provenDeaths} / ${fmt(CHO.mrnaDoses)} = ${fmt(CHO.per100k, 3)} per 100,000 doses. Stored with lowerBound, shown as "at least", because only autopsy-proven deaths are counted: all ${CHO.allDeaths} deaths among confirmed cases give ${fmt(CHO.allDeathsPer100k, 3)} per 100,000 mRNA doses.`,
		context:
			"South Korea, 26 February to 31 December 2021, doses 1-3; cases confirmed by the national disease agency's expert committee; all 8 aged 22-45, dying 1-6 days after dose 1 or 2. Not every case had viral testing. Cross-checks: Ishisaka 2023 meta-analysis, 19.7 per million x 2.0% = 0.039 per 100,000 (all-cause, not judged). Passive reports of fatal anaphylaxis after mRNA vaccines (Maltezou 2023: 2 in 28,520,812 doses in children, 0.007 per 100,000; Boufidou 2023) are smaller and not established as caused by the vaccine; Greenhawt 2021 found no anaphylaxis deaths. The same rate is used for all mRNA versions, as one platform.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quotes verbatim in the PMC full text (PMC10290868); dose counts are in the Methods, not Table 1 (location corrected). Arithmetic reproduced. No retraction or correction notice in PMC; a web search found none.'
		}
	},
	{
		id: 'ling-2022-myopericarditis-meta',
		authors: 'Ling RR, Ramanathan K, Tan FL, Tai BC, Somani J, Fisher D, MacLaren G',
		title:
			'Myopericarditis following COVID-19 vaccination and non-COVID-19 vaccination: a systematic review and meta-analysis',
		journal: 'The Lancet Respiratory Medicine 10(7):679-688',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1016/S2213-2600(22)00059-5',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9000914/',
		usedFor: [
			'covid19.vaccines.covid-original.seriousPer100kDoses',
			'covid19omicron.vaccines.covid-original.seriousPer100kDoses',
			'covid19omicron.vaccines.covid-updated.seriousPer100kDoses'
		],
		quote:
			'the incidence of myopericarditis was significantly higher (p=0·0010) among those who received mRNA vaccines (22·6 cases [12·2–42·0] per million doses; 290730653 doses, nine studies; figure 3)',
		location:
			'Results, COVID-19 vaccine subgroups paragraph and figure 3; subgroup table by age, sex and dose',
		why: `Worked out: ${MRNA_SERIOUS.myopericarditisPerMillion} per million = ${fmt(per100kFromPerMillion(MRNA_SERIOUS.myopericarditisPerMillion), 2)} per 100,000 mRNA doses, added to anaphylaxis (Greenhawt 2021) for ${fmt(MRNA_SERIOUS.per100k, 2)} serious events per 100,000 doses. It counts myocarditis or pericarditis together and gives no myocarditis-only pooled rate, so wherever serious events are broken down this line is labelled "myocarditis or pericarditis" (pericarditis is often mild, so this slightly overstates serious harm).`,
		context:
			'Among all COVID-19 vaccines (not mRNA only), per million doses: under 30 40.9, 30 and over 2.9; males 23.0, females 5.1; males under 30 59.7; dose 2 31.3. Oster 2022 (myocarditis only, US reports) gives mRNA-specific age and sex detail for step 5. Corrected version online 10 May 2022.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote and the mRNA row (9 studies, 290,730,653 doses, 22.6) confirmed in the PMC text (PMC9000914); the subgroup table is readable there and covers all COVID-19 vaccines.'
		}
	},
	{
		id: 'greenhawt-2021-covid-vaccine-anaphylaxis-meta',
		authors: 'Greenhawt M, Abrams EM, Shaker M, et al.',
		title:
			'The Risk of Allergic Reaction to SARS-CoV-2 Vaccines and Recommended Evaluation and Management: A Systematic Review, Meta-Analysis, GRADE Assessment, and International Consensus Approach',
		journal: 'Journal of Allergy and Clinical Immunology: In Practice 9(10):3546-3567',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1016/j.jaip.2021.06.006',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8248554/',
		usedFor: [
			'covid19.vaccines.covid-original.seriousPer100kDoses',
			'covid19omicron.vaccines.covid-original.seriousPer100kDoses',
			'covid19omicron.vaccines.covid-updated.seriousPer100kDoses'
		],
		quote:
			'the meta-analyzed incidence of anaphylaxis was 7.91 per million (95% confidence interval [95% CI 4.02-15.59), and no anaphylaxis-related fatalities were reported.',
		location:
			'Abstract; Results (adenoviral-vector OR 0.47 and inactivated OR 0.31 compared with mRNA vaccines)',
		why: `Worked out: ${MRNA_SERIOUS.anaphylaxisPerMillion} per million = ${fmt(per100kFromPerMillion(MRNA_SERIOUS.anaphylaxisPerMillion), 3)} per 100,000 doses. It pools all vaccine types, but the others had lower odds than mRNA, so this does not overstate mRNA.`,
		context:
			'Studies to 19 March 2021. Alhumaid 2021 (mRNA only) gives 5.0 per million, with publication bias; CDC says about 5 per million.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Abstract and Results wording confirmed in the PMC text (PMC8248554). Arithmetic reproduced.'
		}
	},
	{
		id: 'who-2020-rubella-position-paper',
		authors: 'World Health Organization',
		title: 'Rubella vaccines: WHO position paper – July 2020',
		journal: 'Weekly Epidemiological Record 95(27):306-324',
		year: 2020,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/publications/i/item/WHO-WER9527',
		usedFor: ['rubella.waningDays'],
		quote:
			'A rubella-specific T-cell response begins 1 week after the humoral response, and cell-mediated immunity appears to persist throughout life. However, occasional re-infections have been reported.',
		location: "Section 'Immunity acquired through infection', p. 311",
		why: 'waningDays null for immunity after infection: WHO says it appears to last for life, far longer than any run. This is about infection, not the vaccine.',
		context: 'Occasional re-infections are reported; the model does not show them.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Paragraph wording confirmed on p. 311 of the WER 95(27) PDF (read through a mirror of the official PDF).'
		}
	},
	{
		id: 'dean-2018-second-pandemic-ectoparasites',
		authors: 'Dean KR, Krauer F, Walløe L, Lingjærde OC, Bramanti B, Stenseth NC, Schmid BV',
		title: 'Human ectoparasites and the spread of plague in Europe during the Second Pandemic',
		journal: 'Proceedings of the National Academy of Sciences 115(6):1304-1309',
		year: 2018,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis or systematic review estimates R0 or contagious periods for historical plague; this is the broadest published model comparison, fitted to nine outbreaks on the same footing.',
		doi: '10.1073/pnas.1715640115',
		usedFor: [
			'plague.r0',
			'plague.latentDays',
			'plague.illDays',
			'plague.asymptomaticFraction',
			'plague.about'
		],
		quote: 'the estimated R0 was 1.48–1.91 for all pre-Industrial outbreaks.',
		location:
			'Results, "Basic Reproduction Number R0"; the nine values are Table 3, EP rows. Contagious periods: Methods, "Human Ectoparasite Model". Infection while ill: Discussion.',
		why: `r0=${fmt(PLAGUE_R0, 2)} is the mean of the nine fitted human-ectoparasite values in Table 3 (${PLAGUE_EP_R0S.join(', ')}), so no single town sets it. The Discussion's "consistently between 1.5 and 1.9" is not quoted, because the paper's own Table 3 contradicts it at both ends (${plagueR0Extremes().join(', ')}). illDays=${PLAGUE_ILL_DAYS} is the Methods text's two contagious phases added together: "The model assumes that humans are mildly infectious for an average of 8 d (σb−1) ... the model assumes that moribund humans transmit plague at a high rate to vectors βhigh for an average of 2 d (γb−1)." latentDays equals the whole incubation period because people were not yet a source while incubating: "We found that the majority of ectoparasite infections occurred during the period of high infectivity in humans, consistent with experimental evidence". The model's route, lice and fleas that live on people, is close contact between people, which is what this engine models. It also backs asymptomaticFraction=0: most spread in its model comes at the late stage of high infectivity, so a symptom-free case would not pass plague on.`,
		context: 'Nine pre-industrial European plague outbreaks, 1348-1813 (Second Pandemic).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Re-opened in full text from the PMC open-data bucket: the Results R0 sentence, all nine EP values in Table 3, and the Methods 8-day and 2-day sentences confirmed. Table 3 dates Eyam 1666 and Moscow 1771 where Figure 1 says 1665 and 1772; Table 3 is used.'
		}
	},
	{
		id: 'park-2018-ectoparasite-critique',
		authors: 'Park SW, Dushoff J, Earn DJD, Poinar H, Bolker BM',
		title:
			'Human ectoparasite transmission of the plague during the Second Pandemic is only weakly supported by proposed mathematical models',
		journal: 'Proceedings of the National Academy of Sciences 115:E7892-E7893 (letter)',
		year: 2018,
		evidence: 'study',
		noReviewReason:
			'A published letter answering Dean 2018; cited only so the About page names both sides of the debate.',
		doi: '10.1073/pnas.1809775115',
		usedFor: ['plague.about'],
		quote:
			'Given that bubonic plague infection can cause secondary pneumonic infection, the possibility of mixed transmission modes cannot be neglected.',
		location: 'Letter, second paragraph',
		why: 'The About page says the route is still argued over. This letter argues that a mix of rat-flea and lung-to-lung spread is not ruled out by Dean 2018, and that its R0 estimates look too precise.',
		context: 'Comment on Dean 2018 (nine European outbreaks, 1348-1813).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'Independent pass, 10 Oct 2026: authors’ reprint of the published letter; authors, 115(34):E7892-E7893, the quote and its location confirmed.'
		}
	},
	{
		id: 'dean-2018-reply-to-park',
		authors: 'Dean KR, Krauer F, Walløe L, Lingjærde OC, Bramanti B, Stenseth NC, Schmid BV',
		title:
			'Reply to Park et al.: Human ectoparasite transmission of plague during the Second Pandemic is still plausible',
		journal: 'Proceedings of the National Academy of Sciences 115(34):E7894-E7895 (reply)',
		year: 2018,
		evidence: 'study',
		noReviewReason: 'The authors’ published reply to Park 2018; cited only for the other side of the debate.',
		doi: '10.1073/pnas.1810221115',
		usedFor: ['plague.about'],
		quote:
			'Our results support our conclusion that human ectoparasites are a plausible and likely vector of plague epidemics during the Second Pandemic.',
		location: 'Reply, closing paragraph',
		why: 'The other side of the debate on the About page. The reply also concedes the point that matters for the tool: "We would like to emphasize that we do not provide evidence against rat-borne plague transmission".',
		context: 'Reply on Dean 2018 (nine European outbreaks, 1348-1813).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'Independent pass, 10 Oct 2026: PMC copy (PMC6112737); both quoted sentences and their locations confirmed; 115(34):E7894-E7895.'
		}
	},
	{
		id: 'mongillo-2024-bubonic-plague-by-age',
		authors:
			'Mongillo J, Zedda N, Rinaldo N, Bellini T, Manfrinato MC, Du Z, Yang R, Stenseth NC, Bramanti B',
		title: 'Differential pathogenicity and lethality of bubonic plague (1720-1945) by sex, age and place',
		journal: 'Proceedings of the Royal Society B 291',
		year: 2024,
		evidence: 'study',
		noReviewReason: `No systematic review or meta-analysis of bubonic plague deaths before antibiotics exists (searched 8 Oct 2026); the published reviews cover treated cases. The closest, Fleck-Derderian 2020, pools untreated plague in pregnancy only (${FLECK_DERDERIAN_UNTREATED_CASES} cases, all forms), so it can’t stand for a whole population. This is the only case-by-case dataset of bubonic plague with ages.`,
		doi: '10.1098/rspb.2024.0724',
		usedFor: [
			'plague.mortality',
			'plague.hospitalisedShare',
			'plague.mortalityByAge',
			'plague.hospitalisedByAge',
			'plague.about'
		],
		quote:
			'From this reduced dataset of 1100 cases of bubonic plague, with known sex, we further selected only those patients whose individual age was also known (967 individuals). Doing so, the total CFR ratio does not change (50.4% in males and 54.7% in females; table 2)',
		location:
			'Table 2 (cases and deaths by sex and ten-year age class) and the Results text; Table 1 for the European Second Pandemic subset',
		why: `mortality=${fmt(PLAGUE_MORTALITY, 3)} is ${PLAGUE_ALL.deaths} deaths in ${PLAGUE_ALL.cases} cases, Table 2's total row. The age bands come from the same counts (${PLAGUE_MORTALITY_BANDS.map((v) => fmt(v, 3)).join(' / ')}), so the bands and the overall figure can't disagree: 0-14 takes the classes below ${PLAGUE_BAND_CUTS[0]}, 15-64 the classes from ${PLAGUE_BAND_CUTS[0]} to ${PLAGUE_BAND_CUTS[1] - 1}, and 65+ the ${PLAGUE_BAND_CUTS[1]}+ class, because the source has no 65+ cut. "Data not disaggregated by sex showcase slight differences in lethality among age classes, but for the older adults (50+), who have the highest CFR (61.4%), and for the 10-19 age class, who showed the lowest value of CFR (45.2%)." These are hospital records from before antibiotics, and some Australian patients had the serum of their day, so it is a before-antibiotics rate, not a nobody-treated one, and if anything slightly low for 1347; the European Second Pandemic subset, closest to the Black Death, is ${fmt(PLAGUE_EUROPE_SECOND_PANDEMIC_CFR * 100, 1)}% (Table 1). The hospital share is set equal to deaths, a lower bound: everyone who died needed care.`,
		context:
			'Hospital records of bubonic plague from 17 countries, 1720-1945, Second and Third Pandemics merged.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Table 2 counts read from the full text: 0-9 73/40, 10-19 263/119, 20-29 286/158, 30-39 160/81, 40-49 115/59, 50+ 70/43, total 967/500 (51.7%); Table 1 European Second Pandemic 57.2%.'
		}
	},
	{
		id: 'who-plague-factsheet',
		authors: 'World Health Organization',
		title: 'Plague (fact sheet)',
		journal: 'WHO (who.int)',
		year: 2026,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/news-room/fact-sheets/detail/plague',
		usedFor: [
			'plague.silentDays',
			'plague.latentDays',
			'plague.mortality',
			'plague.fullEfficacy',
			'plague.about'
		],
		quote:
			'People infected with Y. pestis often develop symptoms after an incubation period of one to seven days.',
		location: 'Key facts; Types of plague; Vaccination',
		why: `silentDays=latentDays=${PLAGUE_INCUBATION_DAYS} is the middle of the ${PLAGUE_INCUBATION_RANGE[0]}-to-${PLAGUE_INCUBATION_RANGE[1]}-day incubation period; the About page gives the whole range. The death rate sits inside WHO's figure for bubonic plague: "Plague can be a very severe disease in people, with a case-fatality ratio of 30% to 60% for the bubonic type, and it is always fatal for the pneumonic and septicaemic kinds when left untreated." fullEfficacy is 0 and nobody is vaccinated: "WHO does not recommend vaccination, except for high-risk groups (such as laboratory personnel who are constantly exposed to the risk of contamination, and health-care workers)." The page's "Human-to-human transmission of bubonic plague is rare." is why the About page says the dots stand for people living closely enough to share lice and fleas, not for coughs.`,
		context: "WHO's official fact sheet, dated 29 September 2026.",
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'Independent pass, 10 Oct 2026: fact sheet dated 29 September 2026; all four sentences verbatim, in Key facts, Types of plague and Vaccination.'
		}
	},
	{
		id: 'andrianaivoarimanana-2020-plague-antibody-persistence',
		authors: 'Andrianaivoarimanana V, Wagner DM, Birdsell DN, et al.',
		title:
			'Short- and long-term humoral immune response against Yersinia pestis in plague patients, Madagascar',
		journal: 'BMC Infectious Diseases 20:822',
		year: 2020,
		evidence: 'study',
		noReviewReason:
			'The only study of long-term immune response in recovered plague patients; no review covers it.',
		doi: '10.1186/s12879-020-05565-8',
		usedFor: ['plague.waningDays'],
		quote:
			'Antibodies persisted for several years and up to 14.8 years for one individual. Antibody titers decreased over time but there was no correlation between titer and time elapsed between the disease onset and serum sampling.',
		location: 'Abstract (Results); Results, long-term follow-up of 71 recovered patients',
		why: 'waningDays=null. The study measures antibodies, not protection against catching plague again, and finds no fading with time, so there is no half-life to use. It is never cited for a rate of decay. The About page says protection after plague has never been measured.',
		context: 'Confirmed plague patients in Madagascar, followed for up to about 15 years.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Re-opened in full text from the PMC open-data bucket: no reinfection endpoint and no measured protection over time, only antibody persistence; quote confirmed.'
		}
	},
	{
		id: 'ratsitorahina-2000-madagascar-seroprevalence',
		authors: 'Ratsitorahina M, Chanteau S, Rahalison L, et al.',
		title: 'Seroepidemiology of human plague in the Madagascar highlands',
		journal: 'Tropical Medicine & International Health 5(2):94-98',
		year: 2000,
		evidence: 'study',
		noReviewReason:
			'No study or review gives the share of plague infections without symptoms; this one shows that they happen.',
		doi: '10.1046/j.1365-3156.2000.00521.x',
		usedFor: ['plague.about', 'plague.asymptomaticFraction'],
		quote:
			'We also confirm that Yersinia pestis infections may occur without marked clinical manifestations and patients may recover without treatment, in accordance with old observations of pestis minor.',
		location: 'Abstract; Discussion',
		why: 'asymptomaticFraction=0, as for Ebola and Marburg. Symptom-free infection happens, but people are not thought to pass plague on until late in their illness (Kool 2005; Dean 2018 finds most spread came at the stage of high infectivity). In the engine a symptom-free dot spreads once its latent days end, so any share above 0 would claim spread the sources argue against. No study gives the share either, and a modern population where plague is treated could not supply one for an epidemic before antibiotics.',
		context: 'Madagascar highlands, a modern population where plague is treated.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Full text via Consensus; quote confirmed.'
		}
	},
	{
		id: 'kugeler-2015-us-plague-1900-2012',
		authors: 'Kugeler KJ, Staples JE, Hinckley AF, Gage KL, Mead PS',
		title: 'Epidemiology of human plague in the United States, 1900-2012',
		journal: 'Emerging Infectious Diseases 21(1):16-22',
		year: 2015,
		evidence: 'study',
		noReviewReason:
			'A national case series used only as a cross-check and for the date antibiotics arrived; no review gives either.',
		doi: '10.3201/eid2101.140564',
		usedFor: ['plague.about'],
		quote: 'The first documented use of antibiotics to treat plague in the United States was in 1942.',
		location: 'Results; Table 2 (1900-1941 and 1942-2012)',
		why: `Why "before antibiotics" means before ${PLAGUE_FIRST_ANTIBIOTICS_YEAR}. It is also a cross-check on the death rate: ${KUGELER_PRE_ANTIBIOTIC.deaths} deaths in ${KUGELER_PRE_ANTIBIOTIC.cases} cases (${fmt((KUGELER_PRE_ANTIBIOTIC.deaths / KUGELER_PRE_ANTIBIOTIC.cases) * 100)}%) in 1900-1941, all forms of plague together, not the figure the model uses.`,
		context: 'United States, 1900-2012.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Re-opened in full text from the PMC open-data bucket: Table 2 figures (336/511, bubonic 235/354, pneumonic 55/59, septicemic 8/9) and the 1942 sentence confirmed.'
		}
	},
	{
		id: 'godfred-cato-2020-plague-treatment-review',
		authors: 'Godfred-Cato S, Cooley KM, Fleck-Derderian S, et al.',
		title:
			'Treatment of Human Plague: A Systematic Review of Published Aggregate Data on Antimicrobial Efficacy, 1939-2019',
		journal: 'Clinical Infectious Diseases',
		year: 2020,
		evidence: 'systematic-review',
		doi: '10.1093/cid/ciz1230',
		usedFor: ['plague.about'],
		quote:
			'Case fatality rates for patients with reported primary clinical form of plague were 14.2% for bubonic, 31.1% for pneumonic, and 20.0% for septicemic plague forms',
		location: 'Results',
		why: `The About page's "curable today" line: with antibiotics, about ${fmt(PLAGUE_BUBONIC_TREATED_CFR * 100)}% of people with bubonic plague die, against about half before them. The model uses the before-antibiotics rate, because the Black Death had none.`,
		context: '2,631 treated cases of human plague in 26 articles, 1939-2019.',
		verified: {
			by: 'modern plague research pass',
			on: '2026-10-08',
			ok: true,
			note: 'Quote checked in the full text.'
		}
	},
	{
		id: 'macklin-2019-polio-schedules-nma',
		authors: 'Macklin GR, Grassly NC, Sutter RW, Mach O, Bandyopadhyay AS, Edmunds WJ, O’Reilly KM',
		title:
			'Vaccine schedules and the effect on humoral and intestinal immunity against poliovirus: a systematic review and network meta-analysis',
		journal: 'The Lancet Infectious Diseases',
		year: 2019,
		evidence: 'meta-analysis',
		doi: '10.1016/s1473-3099(19)30301-9',
		usedFor: ['polio.vaccines.OPV.full.infection'],
		quote:
			'proportion of individuals who developed intestinal immunity was 0·91 (95% CI 0·70-0·98) following three tOPV doses, 0·30 (0·17-0·48) following three bOPV doses',
		location:
			"Results (a fragment: the sentence starts before 'proportion'); Summary, Methods: 'intestinal immunity against serotype 2, measured by absence of shedding poliovirus after a challenge OPV dose'",
		why: `Three doses of the three-type oral vaccine (tOPV, used until 2016): ${OPV_INTESTINAL_IMMUNITY} of children shed no virus after a test dose, so they are counted as protected against infection. This replaces 1 minus Hird 2012's odds ratio (${OPV_SHEDDING_OR}), which isn't a protection figure when shedding is common. The two-type vaccine's 0.30 is against type 2, which that vaccine doesn't contain, so it isn't used.`,
		context:
			'Trials outside western Europe and North America; eight studies with 4,254 infants for gut immunity, measured against type 2 only. No pooled type 1 or type 3 figure exists, so protection against those may be lower.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the Results fragment and the Summary Methods sentence confirmed verbatim in the full text via Consensus; DOI matches the title in The Lancet Infectious Diseases, 2019. Not a preprint; no retraction notice seen (Crossref unreachable).'
		}
	},
	{
		id: 'meakin-2024-ebola-vaccine-effectiveness',
		authors: 'Meakin S, et al.',
		title:
			'Effectiveness of rVSV-ZEBOV vaccination during the 2018-20 Ebola virus disease epidemic in the Democratic Republic of the Congo: a retrospective test-negative study',
		journal: 'The Lancet Infectious Diseases',
		year: 2024,
		evidence: 'study',
		noReviewReason:
			'The only Ebola vaccine meta-analyses (Zarro 2025) pool antibody and safety data, not effectiveness; this is the first real-world estimate.',
		doi: '10.1016/s1473-3099(24)00419-5',
		usedFor: [
			'ebola.fullEfficacy',
			'ebola.vaccines.rVSV-ZEBOV.full.infection',
			'ebola.vaccines.rVSV-ZEBOV.full.severe'
		],
		quote:
			'10 days or more after vaccination, the effectiveness of rVSV-ZEBOV against Ebola virus disease was estimated to be 84% (95% credible interval 70-92).',
		location: 'Abstract, Findings',
		why: `Real-world protection against confirmed Ebola, ${EBOLA_VACCINE.infection}. Ebola almost always makes people ill, so protection against the disease is close to protection against infection. Also one of the two figures behind protection against death (see Coulborn 2024).`,
		context:
			'DRC, 2018-20; 1,273 cases and 25,165 test-negative controls, matched by sex, age, health zone and month. Few vaccinated people: 40 cases and 1,271 controls vaccinated 10 days or more before onset. Funded by Médecins Sans Frontières.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the Findings sentence confirmed verbatim in the abstract via Consensus; DOI matches the title. Not a preprint; no retraction notice seen.'
		}
	},
	{
		id: 'coulborn-2024-ebola-vaccinated-cfr',
		authors: 'Coulborn RM, et al.',
		title:
			'Case fatality risk among individuals vaccinated with rVSVΔG-ZEBOV-GP: a retrospective cohort analysis of patients with confirmed Ebola virus disease in the Democratic Republic of the Congo',
		journal: 'The Lancet Infectious Diseases',
		year: 2024,
		evidence: 'study',
		noReviewReason:
			'No review pools death rates among vaccinated Ebola patients; this cohort covers all 2,279 confirmed patients in its treatment centres.',
		doi: '10.1016/s1473-3099(23)00819-8',
		usedFor: ['ebola.vaccines.rVSV-ZEBOV.full.severe', 'ebola.about'],
		quote:
			'Vaccination significantly lowered case fatality risk (vaccinated: 25% [106/423] vs not vaccinated: 56% [570/1015]; p<0·0001). … ≥10 days before onset: 18% [12/68], 0·40 [0·21-0·69; p=0·0022]',
		location: 'Abstract, Findings',
		why: `Worked out: vaccinated patients (10 or more days before onset) had an adjusted relative risk of death of ${EBOLA_VACCINE.deathRelativeRisk}, which is the breakthrough factor. With Meakin's ${EBOLA_VACCINE.infection} against infection, protection against death among everyone vaccinated is 1 - (1 - ${EBOLA_VACCINE.infection}) x ${EBOLA_VACCINE.deathRelativeRisk} = ${fmt(EBOLA_VACCINE.severe, 3)}. That figure rests on ${EBOLA_VACCINE.patients} vaccinated patients and ${EBOLA_VACCINE.deaths} deaths.`,
		context:
			'DRC, 2018-20, Médecins Sans Frontières treatment centres. Vaccinated patients had less virus in their blood, which fits the lower death rate.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the Findings sentence confirmed verbatim in the abstract via Consensus (the quote drops the strata between); DOI matches the title. Not a preprint; no retraction notice seen.'
		}
	},
	{
		id: 'shao-2022-omicron-ve-meta',
		authors: 'Shao W, et al.',
		title:
			'Effectiveness of COVID-19 vaccines against SARS-CoV-2 variants of concern: a systematic review and meta-analysis',
		journal: 'Emerging Microbes & Infections',
		year: 2022,
		evidence: 'meta-analysis',
		doi: '10.1080/22221751.2022.2122582',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9542696/',
		usedFor: [
			'covid19omicron.vaccines.covid-original.full.infection',
			'covid19omicron.vaccines.covid-original.partial.infection',
			'covid19omicron.vaccines.covid-original.partial.severe'
		],
		quote:
			'The summary VE of full vaccination against infection was 44.4% (95% CI 38.6–50.2) at first month and subsequently declined … we also estimated the summary VE of partial vaccination against infection, with a summary VE of 25.9% (95% CI, 20.0–34.9) estimated in 5 studies (Supplementary Table S9).',
		location: "Results, 'VE against Omicron variant' (two sentences joined; text lies between them)",
		why: `One dose of the original vaccine against Omicron infection: ${OMICRON_ONE_DOSE.infection}, pooled over all ages. Its ${fmt(OMICRON_VACCINE.originalInfection * 100, 1)}% at month one for a full course matches Menegale 2023, the half-life's source. No pooled one-dose severe figure exists, so severe is worked out from Tan 2022's matched pair.`,
		context:
			'Omicron studies to mid-2022, infection confirmed by PCR or antigen test. The one-dose figure has no time since the dose reported, so confidence in it is low. Supplementary Table S9 counts 6 studies where the text says 5.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: both sentences confirmed verbatim in the PMC open-data text (PMC9542696); is_retracted false.'
		}
	},
	{
		id: 'fulton-2016-pertussis-vaccines-ma',
		authors: 'Fulton TR, et al.',
		title: 'Protective Effect of Contemporary Pertussis Vaccines: A Systematic Review and Meta-analysis',
		journal: 'Clinical Infectious Diseases',
		year: 2016,
		evidence: 'meta-analysis',
		doi: '10.1093/cid/ciw051',
		usedFor: ['pertussis.fullEfficacy', 'pertussis.vaccines.DTaP.full.infection'],
		quote:
			'Meta-analysis of 2 aP vaccine efficacy studies (assessing the 3-component GlaxoSmithKline and 5-component Sanofi-Pasteur formulations) yielded an overall aP vaccine efficacy of 84% (95% confidence interval [CI], 81%-87%).',
		location: 'Abstract, Results',
		why: `A full infant course of the acellular vaccine: ${PERTUSSIS_VACCINE.full} against whooping cough. Used in place of Chit 2018's ${Math.round(CHIT.start * 100)}%, a fitted starting point from a study its maker funded. The two trials followed children for about ${Math.round(PERTUSSIS_TRIALS.firstMonths)} and ${PERTUSSIS_TRIALS.secondMonths[0]} to ${PERTUSSIS_TRIALS.secondMonths[1]} months, so the figure is slightly low just after the course.`,
		context:
			'Two randomised trials, Italy and Sweden, 1990s, WHO case definition (21 days or more of cough with confirmed infection). Measures illness, not infection: acellular vaccines block infection less well.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the Results sentence confirmed verbatim in the abstract; Table 1 follow-up (17.2 and 21-23.5 months) read from the full-text chunks via Consensus. Not a preprint; no retraction notice seen.'
		}
	},
	{
		id: 'radke-2017-pertussis-ve-nz',
		authors: 'Radke S, Petousis-Harris H, Watson D, Gentles D, Turner N',
		title:
			'Age-specific effectiveness following each dose of acellular pertussis vaccine among infants and children in New Zealand',
		journal: 'Vaccine',
		year: 2017,
		evidence: 'study',
		noReviewReason:
			'No meta-analysis gives a full course’s protection against severe whooping cough; this nested case-control study uses national data.',
		doi: '10.1016/j.vaccine.2016.11.004',
		usedFor: ['pertussis.vaccines.DTaP.full.severe'],
		quote:
			'VE against pertussis hospitalisation was 93% (95% confidence interval [CI]: 87, 96) following three doses among infants aged 5-11months who received three compared to zero doses.',
		location: 'Abstract, Results',
		why: `Protection against needing hospital after the three-dose infant course, ${PERTUSSIS_VACCINE.fullSevere}: the course the sim's full course stands for. The same abstract has a second 93% (CI 90, 95) after the four-year booster, which is not this figure.`,
		context: 'New Zealand, national hospital and notification data.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the abstract sentence and section 3.3 confirmed verbatim via Consensus; title corrected to the published one. Not a preprint; no retraction notice seen.'
		}
	},
	{
		id: 'who-2015-pertussis-position-paper',
		authors: 'World Health Organization',
		title: 'Pertussis vaccines: WHO position paper – September 2015',
		journal: 'Weekly Epidemiological Record 90(35):433-460',
		year: 2015,
		evidence: 'official',
		publisher: 'WHO',
		url: 'https://www.who.int/publications/i/item/WER9035',
		mirrorUrl:
			'https://www.nitag-resource.org/sites/default/files/51ef706939885e4158a0e22b0619d68d9a978140_1.pdf',
		usedFor: ['pertussis.vaccines.DTaP.partial.severe'],
		quote:
			'Observational studies have consistently shown around 50% protection against severe pertussis in infancy following a single dose of either wP or aP pertussis vaccine, and that 2 doses offer at least 80% protection.',
		location: "Section 'Effectiveness of incomplete schedules with wP or aP vaccines', p. 445-446",
		why: `An unfinished course protects about ${PERTUSSIS_VACCINE.partialSevere} against severe whooping cough in babies (one dose). Its protection against catching it has no pooled figure and stays marked as not yet sourced.`,
		context: 'WHO position paper, 28 August 2015; infants.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'The sentence confirmed verbatim in two consecutive fragments from the nitag-resource.org copy (WHO hosts were unreachable); the page is 445 or 446 depending on the column.'
		}
	},
	{
		id: 'nishiura-2006-smallpox-protection-duration',
		authors: 'Nishiura H, et al.',
		title:
			'Still Protected Against Smallpox? Estimation of the Duration of Vaccine-Induced Immunity Against Smallpox',
		journal: 'Epidemiology',
		year: 2006,
		evidence: 'study',
		noReviewReason:
			'The only systematic review (Kunasekaran 2019) measures mostly antibodies, not protection, and its lowest modelling figure is this paper’s.',
		doi: '10.1097/01.ede.0000229196.41862.c2',
		usedFor: ['smallpox.vaccines.vaccinia.waningDays'],
		quote:
			'The expected median duration of protection from disease ranged from 11.7 to 28.4 years after primary vaccination',
		location: 'Abstract, Results',
		why: `The sim's waning is one exponential step per dot, so a half-life is the time by which half the vaccinated have lost protection, which is what a median duration of protection measures. The middle of ${SMALLPOX_PROTECTION_MEDIAN_YEARS[0]} to ${SMALLPOX_PROTECTION_MEDIAN_YEARS[1]} years is ${fmt(SMALLPOX_VACCINE_HALF_LIFE / DAYS_PER_YEAR, 2)} years = ${fmt(SMALLPOX_VACCINE_HALF_LIFE)} days. CDC’s “about ${SMALLPOX_VACCINE_YEARS[0]} to ${SMALLPOX_VACCINE_YEARS[1]} years” is how long full protection lasts, not a half-life.`,
		context: 'Six UK outbreaks, protection against any smallpox illness.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the quote confirmed verbatim in the abstract via Consensus (it continues with Gompertz’s Law); DOI matches the title. Not a preprint.'
		}
	},
	{
		id: 'kunasekaran-2019-smallpox-residual-immunity',
		authors: 'Kunasekaran MP, et al.',
		title: 'Evidence for Residual Immunity to Smallpox After Vaccination and Implications for Re-emergence',
		journal: 'Military Medicine',
		year: 2019,
		evidence: 'systematic-review',
		doi: '10.1093/milmed/usz181',
		usedFor: ['smallpox.vaccines.vaccinia.waningDays'],
		quote:
			'Duration of protection of >20 years was consistently shown in the 16 retrospective cross-sectional studies, while the lowest estimated duration of protection was 11.7 years among the modeling studies.',
		location: 'Abstract, Results',
		why: 'Support: protection lasting more than 20 years matches the middle of Nishiura’s range. Mostly antibody studies (11 of the 16), so it backs the half-life without setting it.',
		context: 'Systematic review of 29 papers.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the quote confirmed verbatim in the abstract via Consensus; the same sentence is also in a conference abstract (not cited). Not a preprint.'
		}
	},
	{
		id: 'eichner-2003-smallpox-protection',
		authors: 'Eichner M',
		title: 'Analysis of historical data suggests long-lasting protective effects of smallpox vaccination',
		journal: 'American Journal of Epidemiology',
		year: 2003,
		evidence: 'study',
		noReviewReason:
			'No review gives protection against death from smallpox among vaccinated cases; this analysis of historical outbreak data has the most cases. Nishiura & Eichner 2006 (odds ratio of death 0.3, Sydney 1881) gives 0.965 and is a check only.',
		doi: '10.1093/aje/kwg225',
		usedFor: ['smallpox.vaccines.vaccinia.full.severe'],
		quote:
			'Protection against severe and fatal disease was lost at the rate of 1.41% per year, corresponding to a half-life of 49.2 years (95% confidence interval: 42.0, 57.3), and protection against fatal disease alone declined 0.363% per year. Thus, even 70 years after primary vaccination, 77.6% of cases were still protected (95% confidence interval: 66.6, 85.4).',
		location: 'Abstract',
		why: `Worked out: ${fmt(EICHNER_PROTECTED_CASES * 100, 1)}% of vaccinated cases were still protected against death 70 years on, so that is the breakthrough factor. With the ${SMALLPOX_START} start, protection against death among everyone vaccinated is 1 - ${fmt(1 - SMALLPOX_START, 2)} x ${fmt(1 - EICHNER_PROTECTED_CASES, 3)} = ${fmt(SMALLPOX_SEVERE, 3)}, a lower bound because it is higher near the dose. Severe protection doesn’t wane in the sim, which fits this.`,
		context:
			'Historical outbreak data. The same abstract: protection against severe and fatal disease halves in 49.2 years.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-08',
			ok: true,
			note: 'Two passes: the quote confirmed verbatim in the full text via Consensus; DOI matches the title. Not a preprint.'
		}
	},
	{
		id: 'jefferson-1998-cochrane-plague-vaccines',
		authors: 'Jefferson T, Demicheli V, Pratt M',
		title: 'Vaccines for preventing plague',
		journal: 'Cochrane Database of Systematic Reviews 1998, Issue 1, CD000976',
		year: 1998,
		evidence: 'systematic-review',
		doi: '10.1002/14651858.CD000976',
		mirrorUrl: 'https://www.cochrane.org/evidence/CD000976_vaccines-preventing-plague',
		usedFor: ['plague.fullEfficacy'],
		quote:
			'No trials were included. … There is not enough evidence to evaluate the effectiveness of any plague vaccine',
		location: "Main results; opening of the Authors' conclusions",
		why: 'fullEfficacy=0 and no vaccine: the Cochrane review found no trial of any plague vaccine that met its criteria.',
		context:
			'Searches of MEDLINE and EMBASE to February 2011 (updated 2006, 2009 and 2011, so later papers cite it as 2011).',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'Read on Cochrane’s free abstract page; the full review could not be opened, so only the abstract and conclusions were checked.'
		}
	},
	{
		id: 'hartley-2023-plague-vaccines-review',
		authors: 'Hartley L, Harold S, Hawe E',
		title: 'The efficacy, safety, and immunogenicity of plague vaccines: A systematic literature review',
		journal: 'Current Research in Immunology 4:100072',
		year: HARTLEY_2023.year,
		evidence: 'systematic-review',
		doi: '10.1016/j.crimmu.2023.100072',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10637890/',
		usedFor: ['plague.fullEfficacy'],
		quote:
			'Only 2 RCTs, both on subunit vaccines, were included out of the 75 screened articles. … we are unable to quantify the efficacy of vaccines to prevent plague, as well as their long-term safety and immunogenicity.',
		location: 'Abstract; Results (efficacy) and Discussion',
		why: 'The two trials it found were early-phase studies of antibody response with no efficacy outcome, so no trial has measured protection. It notes older observational work suggesting killed vaccines may do better than live ones, so the About line claims no trial evidence, not no evidence at all.',
		context: 'Trials Chu 2016 (China, 240 people) and Frey 2017 (US, 60 people), both F1/V subunit vaccines.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'Full text from the PMC open-data bucket (PMC10637890), is_retracted false; all quoted sentences verbatim.'
		}
	},
	{
		id: 'sagiyev-2019-ev-vaccine-kazakhstan',
		authors: 'Sagiyev Z, Berdibekov A, Bolger T, Merekenova A, Ashirova S, Nurgozhin Z, Dalibayev Z',
		title: 'Human response to live plague vaccine EV, Almaty region, Kazakhstan, 2014–2015',
		journal: 'PLoS ONE 14(6):e0218366',
		year: 2019,
		evidence: 'study',
		noReviewReason:
			'Cited only to show the live vaccine is in routine use and measured by antibodies; the claim that no trial measured protection rests on Jefferson 1998 and Hartley 2023.',
		doi: '10.1371/journal.pone.0218366',
		usedFor: ['plague.fullEfficacy'],
		quote:
			'In Kazakhstan, a live plague vaccine EV 76 NIIEG has been used for plague prophylaxis since the mid-1930s. … Yet, to this day, the effectiveness period of the vaccine is unknown.',
		location: 'Abstract, Background',
		why: 'The live vaccine given yearly in Kazakhstan since the 1930s; this study measured antibody levels, not plague cases or deaths.',
		context:
			'Almaty region, Kazakhstan, 2014-2015; the same practice is used in other former Soviet countries.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'PLOS article page; all quoted sentences verbatim. "Not licensed in Europe and the USA" in the Introduction is about the live vaccine, not the killed one.'
		}
	},
	{
		id: 'anisimov-2025-live-plague-vaccine',
		authors: 'Anisimov AP, Vagaiskaya AS, Trunyakova AS, Dentovskaya SV',
		title: 'Live Plague Vaccine Development: Past, Present, and Future',
		journal: 'Vaccines 13(1):66',
		year: 2025,
		evidence: 'review',
		noReviewReason:
			'A narrative review cited for current use of the live vaccine in Russia and Kazakhstan; the absence of trial evidence rests on Jefferson 1998 and Hartley 2023.',
		doi: '10.3390/vaccines13010066',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11768842/',
		usedFor: ['plague.fullEfficacy'],
		quote:
			'Vaccination against plague remains a challenging issue not only due to the lack of globally accepted licensed vaccines but also due to the absence of generally accepted methods for comparing their safety and efficacy.',
		location: 'Conclusions; Section 5 for use in Russia and Kazakhstan',
		why: 'The live EV vaccine is still given to tens of thousands a year in Russia and Kazakhstan, with no accepted way of measuring how well it works. It reports old, uncontrolled field observations that disagree with each other (a large fall in cases in Inner Mongolia in 1945, little effect on cases in South Vietnam), so the About page says no trial has measured its protection, not that nobody ever looked.',
		context:
			'Review from the State Research Center for Applied Microbiology and Biotechnology, Obolensk, Russia.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'PMC open-access copy (PMC11768842), is_retracted false; the publisher page could not be fetched.'
		}
	},
	{
		id: 'kool-2005-pneumonic-transmission',
		authors: 'Kool JL',
		title: 'Risk of Person-to-Person Transmission of Pneumonic Plague',
		journal: 'Clinical Infectious Diseases 40(8):1166-1172',
		year: 2005,
		evidence: 'study',
		noReviewReason:
			'No systematic review of when people with plague pass it on was found; this invited analysis of outbreak records is the standard reference.',
		doi: '10.1086/428617',
		usedFor: ['plague.asymptomaticFraction'],
		quote:
			'Persons with plague usually only transmit the infection when the disease is in the endstage, when infected persons cough copious amounts of bloody sputum, and only by means of close contact.',
		location: 'Abstract',
		why: 'asymptomaticFraction=0: people pass plague on only late in their illness, so a symptom-free infection is not a source, and a share above 0 would claim spread the sources argue against.',
		context: 'Outbreak records of pneumonic plague, 20th century; CDC author.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'Checked against the publisher’s free abstract; full text paywalled. Robert A. Weinstein is the section editor, not an author.'
		}
	},
	{
		id: 'bourner-2023-bubonic-plague-clinical-review',
		authors: 'Bourner J, Andriamarohasina L, Salam A, Kayem ND, Randremanana R, Olliaro P',
		title:
			'A systematic review of the clinical profile of patients with bubonic plague and the outcome measures used in research settings',
		journal: 'PLoS Neglected Tropical Diseases 17(11):e0011509',
		year: 2023,
		evidence: 'systematic-review',
		doi: '10.1371/journal.pntd.0011509',
		usedFor: ['plague.about'],
		quote:
			'Of those who received a high-efficacy antimicrobial at any time following initial presentation, 15/271 (6%) died',
		location: 'Results (Treatment)',
		why: 'About only: beside the "treated today" line, deaths among bubonic plague patients given a high-efficacy antibiotic at any point.',
		context: `1,343 bubonic plague patients across the review, 15% of whom died; the ${Math.round((BOURNER_HIGH_EFFICACY.deaths / BOURNER_HIGH_EFFICACY.patients) * 100)}% is the ${BOURNER_HIGH_EFFICACY.patients} given a high-efficacy antibiotic.`,
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'PLOS article page; the quote and the 15% review-wide figure verbatim.'
		}
	},
	{
		id: 'kugeler-2020-us-plague-treatment-outcomes',
		authors: 'Kugeler KJ, Mead PS, Campbell SB, Nelson CA',
		title:
			'Antimicrobial Treatment Patterns and Illness Outcome Among United States Patients With Plague, 1942–2018',
		journal: 'Clinical Infectious Diseases 70(Supplement_1):S20-S26',
		year: 2020,
		evidence: 'study',
		noReviewReason:
			'About only, beside the systematic reviews (Bourner 2023, Godfred-Cato 2020): US surveillance of every reported case since antibiotics were first used.',
		doi: '10.1093/cid/ciz1227',
		mirrorUrl: 'https://stacks.cdc.gov/view/cdc/150394',
		usedFor: ['plague.about'],
		quote:
			'Mortality differed significantly among those receiving high-efficacy therapy (9%) and only limited-efficacy therapy (51%).',
		location: 'Abstract, Results',
		why: `About only: deaths among US plague patients given a high-efficacy antibiotic, ${KUGELER_2020_TREATED.from}-${KUGELER_2020_TREATED.to}, all forms of plague.`,
		context: `US plague surveillance, ${KUGELER_2020_TREATED.from}-${KUGELER_2020_TREATED.to}, all forms; overall deaths fell from 28% before 1970 to 8% in 2000-2018.`,
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'CDC Stacks copy of the article; quote verbatim (that copy prints "highefficacy" across a line break).'
		}
	},
	{
		id: 'fleck-derderian-2020-plague-pregnancy',
		authors:
			'Fleck-Derderian S, Nelson CA, Cooley KM, Russell Z, Godfred-Cato S, Oussayef NL, Oduyebo T, Rasmussen SA, Jamieson DJ, Meaney-Delman D',
		title: 'Plague During Pregnancy: A Systematic Review',
		journal: 'Clinical Infectious Diseases 70(Supplement_1):S30-S36',
		year: 2020,
		evidence: 'systematic-review',
		doi: '10.1093/cid/ciz1228',
		usedFor: ['plague.about'],
		quote:
			'Among cases treated with antimicrobials, maternal mortality and fetal fatality were 29% and 62%, respectively; for untreated cases, maternal mortality and fetal fatality were 67% and 74%, respectively.',
		location: 'Abstract, Results',
		why: `The closest pooled figure for plague deaths without treatment in any systematic review, and why it is not used for the Black Death: it covers pregnant women only, mixes forms of plague, and rests on ${FLECK_DERDERIAN_UNTREATED_CASES} untreated cases against Mongillo’s ${PLAGUE_ALL.cases} bubonic cases with ages.`,
		context: '160 cases of plague in pregnancy, 1897-2002, mostly before antibiotics.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-10',
			ok: true,
			note: 'OUP article page (abstract and Results), cross-checked against the University of Iowa repository copy.'
		}
	}
];
