import { describe, expect, it } from 'vitest';
import { percentReading } from '../../src/lib/ui/charts/scale';

describe('a reading in percent', () => {
	it('never shows a share above 0 as 0%', () => {
		expect(percentReading(0.3)).toBe('under 1%');
		expect(percentReading(0.0001)).toBe('under 1%');
	});
	it('shows 0 as 0%, and rounds the rest to the whole percent', () => {
		expect(percentReading(0)).toBe('0%');
		expect(percentReading(0.5)).toBe('1%');
		expect(percentReading(12.4)).toBe('12%');
		expect(percentReading(100)).toBe('100%');
	});
	it('never shows "-0%" for a small negative, such as a float left just under 0', () => {
		expect(percentReading(-0.3)).toBe('0%');
		expect(percentReading(-0)).toBe('0%');
		expect(percentReading(-0.5)).toBe('0%');
		expect(percentReading(-0.6)).toBe('-1%');
	});
});
