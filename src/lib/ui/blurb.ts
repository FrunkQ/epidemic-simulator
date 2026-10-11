/**
 * The disease blurb in the top bar shows at most this many lines (10), so a long blurb or a wide
 * font can't take enough height from the map to dock the cards. The rest opens with "more".
 */
export const BLURB_LINES = 3;

/** The blurb's sentences, each with its full stop. */
export function sentences(text: string): string[] {
	return text.split(/(?<=[.!?])\s+(?=\S)/);
}

/**
 * How many of the first sentences to show: all of them if they fit, otherwise as many as fit
 * together with the "more" button, and never fewer than one. A sentence is never cut, so a number
 * never loses its qualifier. `fits(text, clipped)` says whether `text` (followed by the button when
 * `clipped`) fits in the lines allowed.
 */
export function fitSentences(parts: string[], fits: (text: string, clipped: boolean) => boolean): number {
	if (fits(parts.join(' '), false)) return parts.length;
	for (let k = parts.length - 1; k > 1; k--) if (fits(parts.slice(0, k).join(' '), true)) return k;
	return 1;
}
