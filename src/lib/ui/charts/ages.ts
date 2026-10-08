/**
 * The three age bands (World Bank), in the same three colours on every chart (8). One hue, light
 * to dark from young to old, checked as an ordinal ramp with the dataviz palette validator on the
 * dark surface. Bars always carry their band's name too, so colour is never the only cue.
 */
export const AGE_BANDS = [
	{ label: 'Aged 0-14', short: '0-14', colour: '#8fd6ea' },
	{ label: 'Aged 15-64', short: '15-64', colour: '#45a9d1' },
	{ label: 'Aged 65+', short: '65+', colour: '#2c74b5' }
] as const;
