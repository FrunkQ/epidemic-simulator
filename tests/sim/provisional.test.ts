import { describe, expect, it } from 'vitest';
import { walk } from './configWalk';

/**
 * Placeholders are marked with `provisional` (the reason) on the sourced number. They are listed
 * on every run; a release build (RELEASE=1) fails while any remain.
 */
describe('provisional numbers', () => {
	const { sourced } = walk();
	const provisional = sourced.filter((n) => n.value.provisional !== undefined);

	it('gives every provisional number a reason', () => {
		for (const n of provisional) expect(n.value.provisional!.trim().length, n.key).toBeGreaterThan(0);
	});

	it('lists the provisional numbers, and fails a release build while any remain', () => {
		const list = provisional.map((n) => `${n.key}: ${n.value.provisional}`);
		console.info(
			list.length
				? `${list.length} provisional number(s):\n  ${list.join('\n  ')}`
				: 'No provisional numbers.'
		);
		if (process.env.RELEASE === '1') expect(list).toEqual([]);
	});
});
