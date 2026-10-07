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
	'UN'
] as const;

export const CITATIONS: Citation[] = [
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
		evidence: 'meta-analysis',
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
		evidence: 'study',
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
		evidence: 'study',
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
		evidence: 'meta-analysis',
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
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/pinkbook/hcp/table-of-contents/chapter-18-poliomyelitis.html',
		usedFor: [
			'polio.silentDays',
			'polio.illDays',
			'polio.asymptomaticFraction',
			'polio.mortality',
			'polio.fullEfficacy',
			'polio.waningDays',
			'polio.hospitalisedShare'
		],
		quote:
			'For the onset of paralysis in paralytic poliomyelitis, the incubation period is usually 7 to 21 days. … Approximately 70% of all polio infections in children are asymptomatic. … Approximately 24% … consist of a minor, nonspecific illness … Nonparalytic aseptic meningitis occurs in 1% to 5% of polio infections in children. … Less than 1% of all polio infections in children result in flaccid paralysis. … The case fatality ratio for paralytic polio is generally 2% to 5% among children … most infectious in the days immediately before and after the onset of symptoms … at least 99% are immune following 3 doses … probably provides lifelong immunity after a complete series',
		location:
			'Clinical Features; Epidemiology; Immunogenicity and Vaccine Efficacy (last reviewed 1 May 2024)',
		why: 'CDC reference text, read directly. silentDays 7 is worked out: the low end of the 7 to 21 day onset window, because people spread polio before they fall ill. hospitalisedShare 1 is worked out: in the model only meningitis and paralysis cases turn red, and those are hospital cases.',
		context: 'US; children.',
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
		evidence: 'study',
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
		evidence: 'systematic-review',
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
		evidence: 'systematic-review',
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
		evidence: 'systematic-review',
		doi: '10.1093/aje/kwm375',
		usedFor: ['flu.illDays', 'flu.asymptomaticFraction'],
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
		evidence: 'study',
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
		evidence: 'study',
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
		evidence: 'meta-analysis',
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
		evidence: 'meta-analysis',
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
		evidence: 'study',
		doi: '10.3390/vaccines10060888',
		usedFor: ['flu.partialEfficacy', 'flu.waningDays'],
		quote: 'wanes within 180 days after 14 days of influenza vaccination',
		location: 'abstract',
		why: 'Large multi-season study; support.',
		context: 'US adults, seasons before 2020.',
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
		id: 'eurostat-beds-2024',
		authors: 'Eurostat',
		title: 'Healthcare resource statistics - beds',
		journal: 'Eurostat Statistics Explained',
		year: 2026,
		evidence: 'official',
		publisher: 'Eurostat',
		url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Healthcare_resource_statistics_-_beds',
		usedFor: ['behaviour.hospitalBedsPerThousand'],
		quote:
			'there were, on average, 507 hospital beds per 100 000 inhabitants in 2024 across the whole of the EU',
		location: "Section 'Hospital beds'",
		why: 'Official statistic; 507 per 100,000 is 5.07 per 1,000. Countries range from 1.87 (Sweden) to 7.59 (Germany).',
		context: 'EU-27, 2024. Counts all hospital beds, not only acute ones.',
		verified: { by: 'independent verification pass', on: '2026-10-07', ok: true }
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
		id: 'nhs-england-kh03-bed-occupancy-2024',
		authors: 'NHS England',
		title: 'Bed Availability and Occupancy (KH03), Quarter 3 2023/24: Statistical Press Notice',
		journal: 'NHS England Official Statistics',
		year: 2024,
		evidence: 'official',
		publisher: 'NHS England',
		url: 'https://www.england.nhs.uk/statistics/wp-content/uploads/sites/2/2024/02/KH03-Q3-2023-24-Statistical-Press-Notice-FINAL.pdf',
		usedFor: ['behaviour.spareBedShare'],
		quote:
			'The average occupancy rate for general and acute beds open overnight was 91.6% in Quarter 3 2023/24 compared with 89.7% in Quarter 2 2023/24 and 92.0% in Quarter 3 2022/23.',
		location: "'Occupancy Rates' section, main findings",
		why: 'Worked out: 1 minus the non-winter occupancy of 89.7% leaves about 10% of beds free, which is the share an outbreak could use. The winter figure (91.6%) leaves about 8%, so 10% is the generous end.',
		context:
			'NHS England, general and acute beds only. No EU-wide occupancy figure could be opened, so this stands in for one; bed numbers themselves come from the EU average.',
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
			'chickenpox.fullEfficacy',
			'chickenpox.partialEfficacy',
			'chickenpox.hospitalisedShare',
			'chickenpox.about'
		],
		quote:
			'The period of communicability extends from 1 to 2 days before the onset of rash until all lesions have formed crusts.',
		location: "Section 'Varicella' / Epidemiology — Transmission; also Secular Trends, Vaccine Effectiveness",
		why: "silentDays=2 read straight off this sentence. illDays=5 is my own pick: the page says infectiousness lasts 'until all lesions have formed crusts' but gives no day count, and crusting of all lesions typically takes a few days after the rash appears. mortality=0.00002 is worked out from the quoted fatality rates ('approximately 1 per 100,000 cases among children age 1 through 14 years, 6 per 100,000 cases among persons age 15 through 19 years, and 21 per 100,000 cases among adults') as a child-weighted average, since chickenpox is mostly a childhood disease. hospitalisedShare=0.0015 is the midpoint of 'approximately 1 to 2 per 1,000 cases among healthy children'. fullEfficacy/partialEfficacy taken from the quoted meta-analysis figures (92% two doses, 82% one dose). waningDays=null from 'Recovery from primary varicella infection usually results in lifetime immunity.'",
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
		usedFor: ['smallpox.fullEfficacy', 'smallpox.partialEfficacy', 'smallpox.coverageToday'],
		quote:
			'Historically, the vaccine has been effective in preventing smallpox infection in 95% of those vaccinated.',
		location: 'Effectiveness section',
		why: "fullEfficacy=0.95 straight from this sentence. partialEfficacy=0.5 is my own pick: the page says 'Smallpox vaccination can protect you from smallpox for about 3 to 5 years', so someone vaccinated decades ago counts as only partly protected. The page also states 'Routine smallpox vaccination among the American public stopped in 1972 after the disease was eradicated in the United States', which is the source for almost nobody under about 50 being vaccinated.",
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
			'mumps.fullEfficacy',
			'mumps.partialEfficacy',
			'mumps.hospitalisedShare',
			'mumps.waningDays'
		],
		quote: 'Mumps is considered infectious from 2 days before through 5 days after onset of parotitis.',
		location: 'Epidemiology — Transmission; Clinical Features; Vaccine Effectiveness',
		why: "silentDays=2 and illDays=5 read straight off this sentence. asymptomaticFraction=0.20 is the middle of 'approximately 15% to 24% of infections were asymptomatic'. fullEfficacy=0.88 and partialEfficacy=0.78 from 'vaccine effectiveness of one dose of mumps or MMR vaccine was 78% and two dose mumps vaccine effectiveness is 88%'. mortality=0.0001 is my own pick: the page only says 'Permanent sequelae and death are very rare in both vaccinated and unvaccinated patients', so I chose a token 1-in-10,000 rather than zero. hospitalisedShare=0.01 is my own pick worked out from 'reported rates of meningitis, encephalitis, pancreatitis, and hearing loss (either transient or permanent) have all been 1% or less' — those are the complications that put someone in a bed. waningDays≈41 years is my own pick, informed by 'Since 2006, most cases have been in persons who previously received 2 doses of MMR vaccine', which shows protection is not permanent but does not give a decay rate.",
		context:
			'Official US reference text; the 78%/88% figures are pooled post-licensure effectiveness estimates.',
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
		authors: 'Centers for Disease Control and Prevention (Marin M, Leung J, et al., eds.)',
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
			'pertussis.waningDays',
			'pertussis.fullEfficacy',
			'pertussis.partialEfficacy',
			'pertussis.hospitalisedShare'
		],
		quote:
			'Persons with pertussis are infectious from the beginning of the catarrhal stage through the third week after the onset of paroxysms',
		location: 'Epidemiology — Transmission; Clinical Features; Vaccine Efficacy',
		why: "illDays=21 read straight off this sentence ('through the third week after the onset of paroxysms'). silentDays=7 is worked out from it together with the page's catarrhal stage duration of 1–2 weeks: infectiousness begins at the start of the catarrhal stage, roughly a week before the recognisable paroxysmal cough, so about 7 days pass before anyone would call it whooping cough. mortality=0.002 is my own value derived from the page's figures of about 15 infant deaths a year against roughly 2,957 reported infant cases a year in 2000–2017 (≈0.5% in infants), scaled down because most reported cases are in older children and adults, among whom deaths are very rare. hospitalisedShare=0.05 is my own pick on the same basis (infant hospitalisations are the bulk of them). waningDays=12 years is my own pick anchored on 'Immunity following B. pertussis infection is not permanent.' fullEfficacy=0.85 from 'Point estimates of DTaP vaccine efficacy ranged from 80% to 85%'; partialEfficacy=0.5 is my own pick for a part-finished infant series, which the page does not quantify.",
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
		usedFor: ['covid19.silentDays', 'covid19.illDays'],
		quote: 'One study provided approximate median infectious period for asymptomatic cases of 6.5-9.5 days.',
		location: 'Abstract — Results',
		why: "silentDays=2 is the middle of the review's 'Median presymptomatic infectious period across studies varied over <1-4 days'. illDays=8 is my own pick: it sits inside the quoted 6.5–9.5 day asymptomatic window and is shorter than the review's mean of 13.4 days from symptom onset to two negative PCR tests, because PCR positivity outlasts infectiousness — the review itself warns about 'limitations of inferring infectiousness from repeated diagnosis, viral loads and viral replication data alone'.",
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
		usedFor: ['covid19.mortality', 'covid19.hospitalisedShare'],
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
		why: 'waningDays=660 (about 22 months) comes straight from this sentence: the preset models immunity as all-or-nothing, so the half-life point is the natural single number to use. Protection against severe reinfection was far more durable (97.3%, with no evidence of waning), which this one-number preset cannot express.',
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
		id: 'mmwr-2025-covid-vaccine-effectiveness',
		authors: 'Link-Gelles R and CDC COVID-19 Vaccine Effectiveness Collaborators',
		title:
			'Interim Estimates of 2024-2025 COVID-19 Vaccine Effectiveness Among Adults Aged >=18 Years - VISION and IVY Networks, September 2024-January 2025',
		journal: 'MMWR Morbidity and Mortality Weekly Report',
		year: 2025,
		evidence: 'official',
		publisher: 'CDC',
		url: 'https://www.cdc.gov/mmwr/volumes/74/wr/mm7406a1.htm',
		usedFor: ['covid19.fullEfficacy', 'covid19.partialEfficacy'],
		quote: 'VE against COVID-19-associated ED/UC visits was 33% (95% CI = 28%-38%)',
		location: 'Results / Summary',
		why: "fullEfficacy=0.35 is the quoted 33% against emergency-department and urgent-care visits, rounded; the report's hospitalisation estimates in adults 65 and over were 45% (95% CI 36-53) and 46% (95% CI 26-60), so 0.35 is a reasonable all-ages figure for 'not getting ill'. partialEfficacy=0.20 is my own pick for someone whose last dose is out of date, since these estimates all cover the first 7-119 days after vaccination.",
		context:
			'CDC interim vaccine-effectiveness estimates from two US surveillance networks for the current (2024-2025 formula) COVID-19 vaccine; MMWR 2025;74(6):73-82.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: MMWR 2025;74(6):73-82, first author Ruth Link-Gelles; the 33% ED/UC estimate and the 45%/46% hospitalisation estimates confirmed verbatim; no retraction.'
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
		id: 'dean-2016-ebola-household-sar',
		authors: 'Dean NE, Halloran ME, Yang Y, Longini IM',
		title:
			'Transmissibility and Pathogenicity of Ebola Virus: A Systematic Review and Meta-analysis of Household Secondary Attack Rate and Asymptomatic Infection',
		journal: 'Clinical Infectious Diseases',
		year: 2016,
		evidence: 'meta-analysis',
		doi: '10.1093/cid/ciw114',
		url: 'https://academic.oup.com/cid/article-lookup/doi/10.1093/cid/ciw114',
		usedFor: ['ebola.about'],
		quote: 'The greatest risk factor was the provision of nursing care (SAR, 47.9% [95% CI, 23.3%-72.6%]).',
		location: 'Abstract — results',
		why: "The strongest single piece of evidence that Ebola spreads almost only to people physically caring for someone too ill to move, set against 'little transmission occurring in its absence (SAR, 0.8% [95% CI, 0%-2.3%])'. Its 27% asymptomatic estimate is not used: Glynn 2017 found silent infection uncommon, and no study shows silent cases spreading it.",
		context:
			'Meta-analysis of household secondary attack rates from 1976 to 2014, disaggregated by exposure type.',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Re-opened: Clin Infect Dis 2016;62(10):1277-1286, DOI 10.1093/cid/ciw114, first author Natalie E. Dean; the 12.5%, 0.8%, 47.9% and 27.1% figures all confirmed verbatim; no retraction.'
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
		usedFor: ['ebola.fullEfficacy', 'ebola.partialEfficacy'],
		quote: 'No one who was vaccinated immediately developed Ebola disease 10 or more days after vaccination.',
		location: 'Vaccine effectiveness / Guinea ring vaccination trial section',
		why: "fullEfficacy=0.95 is my own pick. The page reports the ring-vaccination trial result in words rather than as a percentage, so I chose a high but not perfect value rather than 1.0. partialEfficacy=0.0 follows from the page's statement that ERVEBO is approved 'as a single dose administration' — there is no incomplete course to model. The page also notes 'ERVEBO does not provide protection against other species of orthoebolaviruses or orthomarburgviruses', which is why this value must not be reused for the Marburg preset.",
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
			'marburg.partialEfficacy',
			'marburg.about'
		],
		quote: 'The average MVD case fatality rate is around 50%.',
		location: 'Key facts / Transmission / Treatment',
		why: "mortality=0.50 taken directly, with the page's 'Case fatality rates have varied from 24% to 88% in past outbreaks.' as the range. silentDays=0 from 'People cannot transmit the disease before they have symptoms.' fullEfficacy and partialEfficacy are 0 because of 'Currently there are no vaccines or antiviral treatments approved for MVD.' The exceptional routes are the same as for Ebola and come from this page: 'Burial ceremonies that involve direct contact with the body of the deceased can also contribute to the transmission of Marburg virus.' and 'Healthcare workers have frequently been infected while treating patients with MVD.' The page's note that 'Early intensive supportive care including rehydration and treatment of specific symptoms, can improve survival' is why outbreaks remain deadliest where care is poor.",
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
			'rubella.waningDays',
			'rubella.fullEfficacy',
			'rubella.partialEfficacy',
			'rubella.hospitalisedShare',
			'rubella.about'
		],
		quote:
			'Rubella is most contagious when the rash first appears, but virus may be shed from 7 days before to 7 days after rash onset.',
		location: 'Epidemiology — Transmission; Clinical Features; Vaccine Characteristics',
		why: "silentDays=7 and illDays=7 read straight off this sentence. asymptomaticFraction=0.50 from 'Symptoms are often mild, and up to 50% of infections may be subclinical or inapparent.' waningDays=null from 'Follow-up studies indicate that 1 dose of vaccine confers long-term, probably lifelong, protection.' partialEfficacy=0.95 from 'At least 95% of vaccinated persons age 12 months or older develop serologic evidence of rubella immunity after a single dose'. fullEfficacy=0.97 is my own pick: the chapter gives no separate two-dose figure, so I set it just above the single-dose value. mortality=0.00001 and hospitalisedShare=0.001 are my own picks: the chapter reports no case-fatality or hospitalisation rate, only that encephalitis occurs in about 1 in 6,000 cases and 'may be fatal', so I chose token values well below 1 in 10,000 deaths. The high subclinical share is also the basis for the low bedridden value.",
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
		usedFor: ['covid19.asymptomaticFraction'],
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
		usedFor: ['covid19.mortality'],
		quote:
			'The meta-analysis demonstrated a point estimate of IFR of 0.68% (0.53%-0.82%) with high heterogeneity (p < 0.001).',
		location: 'Abstract (results)',
		why: 'Meta-analysis of the infection fatality rate before vaccines. Worked out per symptomatic case: 0.68% / (1 - 0.2 asymptomatic) = 0.85%, so mortality 0.0085.',
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
		usedFor: ['covid19.silentDays'],
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
		id: 'cevik2021-covid-shedding',
		authors: 'Cevik M, Tate M, Lloyd O, Maraolo AE, Schafers J, Ho A',
		title:
			'SARS-CoV-2, SARS-CoV, and MERS-CoV viral load dynamics, duration of viral shedding, and infectiousness: a systematic review and meta-analysis',
		journal: 'The Lancet Microbe',
		year: 2021,
		evidence: 'meta-analysis',
		doi: '10.1016/s2666-5247(20)30172-5',
		usedFor: ['covid19.illDays'],
		quote:
			'No study detected live virus beyond day 9 of illness, despite persistently high viral loads, which were inferred from cycle threshold values.',
		location: 'Abstract (findings)',
		why: 'Systematic review and meta-analysis: no live virus after day 9 of illness, which supports about 8 contagious days after symptoms start.',
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
		usedFor: ['covid19.waningDays'],
		quote:
			'Protection from re-infection from ancestral, alpha, and delta variants declined over time but remained at 78·6% (49·8-93·6) at 40 weeks.',
		location: 'Abstract (findings)',
		why: 'Meta-analysis: protection from a past infection stayed at 78.6% at 40 weeks against pre-Omicron variants, consistent with protection falling to about half after roughly two years (660 days).',
		context: 'Studies from many countries, pre-Omicron variants',
		verified: {
			by: 'independent verification pass',
			on: '2026-10-07',
			ok: true,
			note: 'Quote rechecked in Consensus abstract; doi.org resolved (302); no retraction found by web search.'
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
		usedFor: ['ebola.asymptomaticFraction'],
		quote: 'We estimate that 27.1% (95% CI, 14.5%-39.6%) of Ebola infections are asymptomatic.',
		location: 'Abstract (results)',
		why: 'Meta-analysis: about 27% of Ebola infections have no symptoms, but there is no evidence those people pass it on. The model sets asymptomaticFraction to 0 because it only counts cases that spread the disease; the About page says so.',
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
	}
];
