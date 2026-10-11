import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../src/lib/config/diseases';
import { fitSentences, sentences } from '../../src/lib/ui/blurb';

describe('disease blurb', () => {
	it('splits into whole sentences that join back to the blurb', () => {
		for (const d of Object.values(DISEASES)) expect(sentences(d.blurb).join(' ')).toBe(d.blurb);
		expect(sentences(DISEASES.plague.blurb)).toHaveLength(2);
	});

	it('shows every sentence that fits, never part of one, and at least one', () => {
		const parts = ['One two.', 'Three four five.', 'Six seven eight.'];
		// Fits up to 20 characters, the button counting as 5.
		const fits = (limit: number) => (t: string, more: boolean) => t.length + (more ? 5 : 0) <= limit;
		expect(fitSentences(parts, fits(42))).toBe(3);
		expect(fitSentences(parts, fits(41))).toBe(2);
		expect(fitSentences(parts, fits(30))).toBe(2);
		expect(fitSentences(parts, fits(29))).toBe(1);
		expect(fitSentences(parts, fits(10))).toBe(1);
		expect(fitSentences(parts, fits(3))).toBe(1);
	});
});
