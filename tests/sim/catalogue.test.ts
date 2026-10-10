import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../src/lib/config/diseases';

describe('disease catalogue (config)', () => {
	it('every disease declares a care basis, and only 1918 flu and the Black Death are era rates', () => {
		for (const d of Object.values(DISEASES)) {
			expect(['modern-care', 'era'], d.id).toContain(d.mortalityBasis);
			expect(d.mortalityBasis === 'era', d.id).toBe(d.id === 'flu1918' || d.id === 'plague');
		}
	});
});
