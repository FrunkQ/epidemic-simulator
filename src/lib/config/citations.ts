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
	/** DOI (preferred) or a stable link. */
	doi?: string;
	url?: string;
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
	verified: { by: string; on: string; ok: boolean };
}

export const CITATIONS: Citation[] = [
	{
		id: 'guerra2017-measles-r0',
		authors: 'Guerra FM, Bolotin S, Lim G, Heffernan J, Deeks SL, Li Y, Crowcroft NS',
		title: 'The basic reproduction number (R0) of measles: a systematic review',
		journal: 'The Lancet Infectious Diseases',
		year: 2017,
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
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-13-measles.html',
		usedFor: [
			'measles.silentDays',
			'measles.illDays',
			'measles.partialEfficacy',
			'measles.fullEfficacy',
			'measles.waningDays'
		],
		quote:
			'transmissible from 4 days before through 4 days after rash onset … 2% to 7% of children who receive only 1 dose of MMR vaccine fail to respond … probably lifelong',
		location: 'Epidemiology; Immunogenicity and Vaccine Efficacy (last reviewed 24 April 2024)',
		why: 'CDC reference text, read directly.',
		context: 'US; seroconversion data.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'klinkenberg2011-measles-generation',
		authors: 'Klinkenberg D, Nishiura H',
		title:
			'The correlation between infectivity and incubation period of measles, estimated from households with two cases',
		journal: 'Journal of Theoretical Biology',
		year: 2011,
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
		doi: '10.1093/infdis/jir102',
		usedFor: ['measles.partialEfficacy', 'measles.fullEfficacy'],
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
		id: 'dipietrantonj2020-cochrane-mmrv',
		authors: 'Di Pietrantonj C, et al.',
		title: 'Vaccines for measles, mumps, rubella, and varicella in children',
		journal: 'Cochrane Database of Systematic Reviews',
		year: 2020,
		doi: '10.1002/14651858.cd004407.pub4',
		usedFor: ['measles.partialEfficacy', 'measles.fullEfficacy'],
		quote: '95% after one dose ... and 96% after two doses',
		location: 'abstract',
		why: 'Cochrane review; added support.',
		context: 'Children.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'benet2025-measles-ve-france',
		authors: 'Bénet T, et al.',
		title: 'Investigation of a measles outbreak in a highly vaccinated middle school, France, 2023',
		journal: 'Eurosurveillance',
		year: 2025,
		doi: '10.2807/1560-7917.es.2025.30.46.2500130',
		usedFor: ['measles.fullEfficacy'],
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
		doi: '10.1093/ije/dyag083',
		usedFor: ['measles.fullEfficacy', 'measles.waningDays'],
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
		doi: '10.1016/s2468-2667(24)00181-6',
		usedFor: ['measles.waningDays'],
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
		doi: '10.1093/infdis/jiac039',
		usedFor: ['measles.waningDays'],
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
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-18-poliomyelitis.html',
		usedFor: [
			'polio.silentDays',
			'polio.illDays',
			'polio.asymptomaticFraction',
			'polio.mortality',
			'polio.fullEfficacy',
			'polio.waningDays'
		],
		quote:
			'Approximately 70% of all polio infections in children are asymptomatic … most infectious in the days immediately before and after the onset of symptoms … at least 99% are immune following 3 doses … probably provides lifelong immunity after a complete series',
		location:
			'Clinical Features; Epidemiology; Immunogenicity and Vaccine Efficacy (last reviewed 1 May 2024)',
		why: 'CDC reference text, read directly.',
		context: 'US. Gives no exact pre-symptom day count, so silentDays 7 is only bounded.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'who2022-polio-position-paper',
		authors: 'World Health Organization',
		title: 'Polio vaccines: WHO position paper – June 2022',
		journal: 'Weekly Epidemiological Record 97(25)',
		year: 2022,
		url: 'https://polioeradication.org/wp-content/uploads/2024/05/WER9725-eng-fre.pdf',
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
		doi: '10.1093/infdis/jit601',
		usedFor: ['polio.partialEfficacy', 'polio.fullEfficacy'],
		quote: 'One full dose of intramuscular IPV seroconverted 33%, 41%, and 47%',
		location: 'abstract',
		why: 'Systematic review.',
		context: 'Infants.',
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
		doi: '10.1016/s1473-3099(23)00688-6',
		usedFor: ['polio.partialEfficacy'],
		quote: 'effectiveness of one IPV dose was 43%',
		location: 'abstract',
		why: 'Large case-control study.',
		context: 'Nigeria; 89% with community controls.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'hird2012-ipv-mucosal-review',
		authors: 'Hird TR, et al.',
		title:
			'Systematic Review of Mucosal Immunity Induced by Oral and Inactivated Poliovirus Vaccines against Virus Shedding following Oral Poliovirus Challenge',
		journal: 'PLoS Pathogens',
		year: 2012,
		doi: '10.1371/journal.ppat.1002599',
		usedFor: ['polio.fullEfficacy'],
		quote: 'IPV provided no protection against shedding',
		location: 'abstract',
		why: 'Systematic review.',
		context: 'Caveat: efficacy is against paralysis, not shedding.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'biggerstaff2014-flu-r-review',
		authors: 'Biggerstaff M, Cauchemez S, Reed C, Gambhir M, Finelli L',
		title:
			'Estimates of the reproduction number for seasonal, pandemic, and zoonotic influenza: a systematic review of the literature',
		journal: 'BMC Infectious Diseases',
		year: 2014,
		doi: '10.1186/1471-2334-14-480',
		usedFor: ['flu.r0', 'flu.herdImmunityThreshold'],
		quote: 'median R value for seasonal influenza was 1.28',
		location: 'abstract',
		why: 'Systematic review.',
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
		doi: '10.1098/rsif.2011.0309',
		usedFor: ['flu.r0', 'flu.waningDays'],
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
		doi: '10.1093/aje/kwm375',
		usedFor: ['flu.illDays', 'flu.asymptomaticFraction'],
		quote: 'duration of viral shedding averaged over 375 participants was 4.80 days',
		location: 'abstract',
		why: 'Classic review.',
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
		doi: '10.1093/cid/ciu924',
		usedFor: ['flu.silentDays'],
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
		doi: '10.1371/journal.pone.0051653',
		usedFor: ['flu.silentDays', 'flu.illDays'],
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
		doi: '10.1086/652241',
		usedFor: ['flu.silentDays'],
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
		id: 'filipe2024-flu-cfr-review',
		authors: 'Filipe J, et al.',
		title: 'A systematised review of seasonal influenza case-fatality risk',
		journal: 'Vaccine',
		year: 2025,
		doi: '10.1101/2024.10.22.24315943',
		usedFor: ['flu.mortality'],
		quote: 'range 0.3-908 per 100,000 cases',
		location: 'abstract',
		why: 'Review of deaths per symptomatic case.',
		context:
			'DOI is the medRxiv preprint; Vaccine article DOI not found. 0.001 (100 per 100k) is a chosen value inside the range.',
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
		doi: '10.1016/s1473-3099(16)00129-8',
		usedFor: ['flu.partialEfficacy', 'flu.fullEfficacy'],
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
		doi: '10.1016/j.vaccine.2024.02.059',
		usedFor: ['flu.fullEfficacy'],
		quote: 'pooled IVE was 41.4 %',
		location: 'abstract',
		why: 'Largest recent meta-analysis.',
		context: '191 studies, 2017-2022.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'young2018-flu-ve-waning-review',
		authors: 'Young B, et al.',
		title:
			'Duration of Influenza Vaccine Effectiveness: A Systematic Review, Meta-analysis, and Meta-regression of Test-Negative Design Case-Control Studies',
		journal: 'The Journal of Infectious Diseases',
		year: 2018,
		doi: '10.1093/infdis/jix632',
		usedFor: ['flu.partialEfficacy', 'flu.waningDays'],
		quote: 'A/H3 (change in VE, -33',
		location: 'abstract',
		why: 'Meta-analysis.',
		context: 'VE 15-90 vs 91-180 days.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'hu2022-flu-ve-waning',
		authors: 'Hu W, et al.',
		title:
			'Waning Vaccine Protection against Influenza among Department of Defense Adult Beneficiaries in the United States, 2016–2017 through 2019–2020 Influenza Seasons',
		journal: 'Vaccines',
		year: 2022,
		doi: '10.3390/vaccines10060888',
		usedFor: ['flu.partialEfficacy', 'flu.waningDays'],
		quote: 'wanes within 180 days after 14 days of influenza vaccination',
		location: 'abstract',
		why: 'Large multi-season study; support.',
		context: 'US adults, pre-COVID seasons.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'joshi2021-lockdown-mobility',
		authors: 'Joshi YV, et al.',
		title: 'Lockdowns lose one third of their impact on mobility in a month',
		journal: 'Scientific Reports',
		year: 2021,
		doi: '10.1038/s41598-021-02133-1',
		usedFor: ['behaviour.lockdownFatigue'],
		quote: 'lockdowns lose all their impact on mobility in 112.1 days',
		location: 'abstract',
		why: 'Peer-reviewed, 93 countries.',
		context: 'COVID-19, 2020.',
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
		doi: '10.1038/s41562-021-01181-x',
		usedFor: ['behaviour.lockdownFatigue'],
		quote: 'less intense in countries with high interpersonal trust',
		location: 'abstract',
		why: 'Largest cross-national study.',
		context: 'Justifies a non-zero sd; sd 20 itself is an assumption.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	},
	{
		id: 'goldstein2021-lockdown-fatigue',
		authors: 'Goldstein P, et al.',
		title: 'Lockdown fatigue: The diminishing effects of quarantines on the spread of COVID-19',
		journal: 'Research Square (preprint)',
		year: 2021,
		doi: '10.21203/rs.3.rs-621368/v1',
		usedFor: ['behaviour.lockdownFatigue'],
		quote: 'after four months of strict lockdown, NPIs have a significantly weaker contribution',
		location: 'abstract',
		why: '152-country panel; support only.',
		context: 'Preprint.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true
		}
	}
];
