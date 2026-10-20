import { SHADE_FULL_SHARE, SPECK_MIN_CSS } from '../sim/specks';

/** What both map views share (§3): the marks over the dots. */
const MARKS =
	'A white circle marks a case you added, and a dot that shakes is close to tiring of a lockdown.';

/** Each map view in one short line, for the legend; "more" there opens the full text below. */
export const DOT_SHORT = {
	specks: 'A bright speck is one infected person, drawn larger than life; pale specks show deaths.',
	shading: 'A dot turns orange or red with its first case, so a few cases look like many.'
} as const;

/**
 * How the dots and the numbers relate in each map view (§3), shared by the map legend and the
 * About page.
 */
export const DOT_COUNTS = {
	specks: `Healthy dots are drawn dim. Each bright speck beside a dot is one infected person. Pale specks show deaths where no case is drawn over them; the card has the count. Specks are drawn larger than life, at least ${SPECK_MIN_CSS} pixels across, so a single case shows: zoomed out, one speck covers the ground of many people and a dot's specks overlap, so a dot lights up with its first case. Zoom in to see people one by one; the numbers on the cards are exact. A dot is drawn recovered or died once half or more of its people are. ${MARKS}`,
	shading: `Healthy dots are drawn dim. A dot turns orange or red as soon as anyone in it is infected, so even one case shows strongly: this view overstates a dot with few cases. It deepens with their share and is solid once ${Math.round(SHADE_FULL_SHARE * 100)}% of its people are infected; until then a light outline marks it, so it stands out whatever colours you see. Deaths show only once half or more of a dot's people have died. ${MARKS}`
} as const;
