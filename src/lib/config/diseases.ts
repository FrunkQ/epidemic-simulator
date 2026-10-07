import type { DiseaseConfig, DiseaseId } from '../sim/types';

/**
 * Disease presets. Every number carries the ids of its sources in citations.ts.
 * Durations are in days; the engine converts them to ticks once, at load.
 */
export const DISEASES: Record<DiseaseId, DiseaseConfig> = {
	measles: {
		id: 'measles',
		name: 'Measles',
		blurb: 'Spreads very easily. People are contagious for about 4 days before the rash appears.',
		r0: {
			value: 15,
			sources: ['guerra2017-measles-r0', 'wallinga2001-measles-r0-europe', 'fu2026-measles-r0-lmic']
		},
		silentDays: {
			value: 4,
			sources: ['cdc-survmanual-measles-2025', 'cdc-pinkbook-measles', 'klinkenberg2011-measles-generation']
		},
		illDays: { value: 5, sources: ['cdc-survmanual-measles-2025', 'cdc-pinkbook-measles'] },
		asymptomaticFraction: { value: 0, sources: ['tranter2024-measles-breakthrough'] },
		mortality: {
			value: 0.002,
			sources: ['cdc-survmanual-measles-2025', 'portnoy2019-measles-cfr-lmic', 'sbarra2023-measles-cfr-lmic']
		},
		waningDays: {
			value: null,
			sources: [
				'cdc-pinkbook-measles',
				'perry2026-measles-ve-wales',
				'griffin2016-measles-immunity',
				'robert2024-measles-waning-england',
				'bolotin2022-measles-waning-review'
			]
		},
		fullEfficacy: {
			value: 0.97,
			sources: [
				'cdc-pinkbook-measles',
				'uzicanin2011-measles-ve-review',
				'dipietrantonj2020-cochrane-mmrv',
				'benet2025-measles-ve-france',
				'perry2026-measles-ve-wales'
			]
		},
		partialEfficacy: {
			value: 0.93,
			sources: ['cdc-pinkbook-measles', 'uzicanin2011-measles-ve-review', 'dipietrantonj2020-cochrane-mmrv']
		},
		hospitalisedShare: { value: 0.2, sources: ['cdc-measles-symptoms'] }
	},
	polio: {
		id: 'polio',
		name: 'Polio',
		blurb: 'Most people never feel ill, so it spreads quietly until it reaches someone vulnerable.',
		r0: {
			value: 6,
			sources: [
				'fine2024-polio-population-immunity',
				'yaari2016-polio-israel',
				'brouwer2018-polio-rahat',
				'blake2014-polio-older-ages'
			]
		},
		silentDays: { value: 7, sources: ['cdc-pinkbook-polio'] },
		illDays: {
			value: 21,
			sources: [
				'cdc-pinkbook-polio',
				'who2022-polio-position-paper',
				'alexander1997-polio-excretion-review',
				'brouwer2022-polio-shedding-israel',
				'yaari2016-polio-israel'
			]
		},
		asymptomaticFraction: {
			value: 0.96,
			sources: ['cdc-pinkbook-polio', 'who2022-polio-position-paper', 'fatusi1997-polio-epidemiology']
		},
		mortality: {
			value: 0.005,
			sources: ['cdc-pinkbook-polio', 'fatusi1997-polio-epidemiology', 'doshi2011-polio-cfr-india']
		},
		waningDays: { value: null, sources: ['cdc-pinkbook-polio', 'blake2014-polio-older-ages'] },
		fullEfficacy: {
			value: 0.99,
			sources: ['cdc-pinkbook-polio', 'grassly2014-ipv-doses-review', 'hird2012-ipv-mucosal-review']
		},
		partialEfficacy: { value: 0.5, sources: ['grassly2014-ipv-doses-review', 'cooper2024-ipv-nigeria'] },
		hospitalisedShare: { value: 1, sources: ['cdc-pinkbook-polio'] }
	},
	flu: {
		id: 'flu',
		name: 'Seasonal flu',
		blurb: 'Spreads fast but people feel ill quickly, which makes it easier to slow down.',
		r0: {
			value: 1.3,
			sources: ['biggerstaff2014-flu-r-review', 'chowell2007-flu-r-us-fr-au', 'truscott2011-flu-mechanisms']
		},
		silentDays: {
			value: 1,
			sources: ['memoli2015-flu-challenge', 'suess2012-flu-shedding-germany', 'lau2010-flu-shedding-hk']
		},
		illDays: { value: 5, sources: ['carrat2008-flu-timelines-review', 'suess2012-flu-shedding-germany'] },
		asymptomaticFraction: {
			value: 0.2,
			sources: [
				'carrat2008-flu-timelines-review',
				'leung2015-flu-asymptomatic-review',
				'furuya2016-flu-asymptomatic-review',
				'cohen2021-flu-phirst-southafrica'
			]
		},
		mortality: {
			value: 0.001,
			sources: [
				'filipe2024-flu-cfr-review',
				'mcdonald2023-flu-cfr-netherlands',
				'iuliano2017-flu-global-mortality',
				'cohen2010-flu-mortality-southafrica',
				'nair2011-flu-children-burden'
			]
		},
		waningDays: {
			value: 180,
			sources: ['truscott2011-flu-mechanisms', 'young2018-flu-ve-waning-review', 'hu2022-flu-ve-waning']
		},
		fullEfficacy: { value: 0.4, sources: ['belongia2016-flu-ve-review', 'guo2024-flu-ve-review'] },
		partialEfficacy: {
			value: 0.2,
			sources: ['belongia2016-flu-ve-review', 'young2018-flu-ve-waning-review', 'hu2022-flu-ve-waning']
		},
		hospitalisedShare: { value: 0.012, sources: ['cdc-flu-burden-2022-23', 'cdc-flu-burden-about'] }
	}
};
