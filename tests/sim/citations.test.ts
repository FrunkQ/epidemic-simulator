import { describe, expect, it } from 'vitest';
import { CITATIONS } from '../../src/lib/config/citations';
import { DISEASES } from '../../src/lib/config/diseases';
import type { Sourced } from '../../src/lib/sim/types';

function sourcedNumbers(): { key: string; value: Sourced<number | null> }[] {
	const out: { key: string; value: Sourced<number | null> }[] = [];
	for (const d of Object.values(DISEASES)) {
		for (const [k, v] of Object.entries(d)) {
			if (v && typeof v === 'object' && 'sources' in v)
				out.push({ key: `${d.id}.${k}`, value: v as Sourced<number | null> });
		}
	}
	return out;
}

describe('citations', () => {
	const ids = new Set(CITATIONS.map((c) => c.id));

	it('has unique ids', () => {
		expect(ids.size).toBe(CITATIONS.length);
	});

	it('gives every research number at least one source', () => {
		const missing = sourcedNumbers()
			.filter((n) => n.value.sources.length === 0)
			.map((n) => n.key);
		expect(missing).toEqual([]);
	});

	it('has an entry for every source id used', () => {
		const unknown = sourcedNumbers().flatMap((n) =>
			n.value.sources.filter((s) => !ids.has(s)).map((s) => `${n.key} -> ${s}`)
		);
		expect(unknown).toEqual([]);
	});

	it('only uses sources that passed verification', () => {
		expect(CITATIONS.filter((c) => c.verified.ok !== true).map((c) => c.id)).toEqual([]);
	});

	it('records what each source is used for, the quote and where it is', () => {
		for (const c of CITATIONS) {
			expect(c.usedFor.length, c.id).toBeGreaterThan(0);
			expect(c.quote.length, c.id).toBeGreaterThan(0);
			expect(c.location.length, c.id).toBeGreaterThan(0);
			expect(c.doi ?? c.url, c.id).toBeTruthy();
		}
	});
});
