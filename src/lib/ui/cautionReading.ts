/**
 * The papers the caution note names (6.18). They back wording only, never a number, so they live
 * here rather than in the citation list; each is linked where it is named. Every link was opened in
 * the build: Weitz's open full text on PMC, Gupta's full text on the publisher's site (its DOI could
 * not be opened), and Goolsbee's DOI as its RePEc record gives it.
 */
export interface Reading {
	/** How the note names it. */
	name: string;
	url: string;
	/** The sentence in the paper that the note's wording rests on. */
	quote: string;
}

export const CAUTION_READING = {
	weitz: {
		name: 'Weitz 2020',
		url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7768772/',
		quote:
			'population-level mobility metrics usually increased from low levels before fatalities reached an initial peak'
	},
	gupta: {
		name: 'Gupta 2020',
		url: 'https://www.brookings.edu/articles/mandated-and-voluntary-social-distancing-during-the-covid-19-epidemic/',
		quote: 'in the reopening phase mobility increased rapidly, mostly preceding official state reopenings'
	},
	goolsbee: {
		name: 'Goolsbee 2021',
		url: 'https://doi.org/10.1016/j.jpubeco.2020.104311',
		quote: 'Local deaths are strongly related to the size of the reduction in consumer visits.'
	}
} satisfies Record<string, Reading>;
