import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import { DISEASES } from '../../src/lib/config/diseases';
import { POPULATION } from '../../src/lib/config/population';
import { vaccineKey } from '../../src/lib/config/vaccines';
import type { Sourced, Vaccine } from '../../src/lib/sim/types';

/*
 * Walks all research config, including inside each disease's vaccine list, and returns every
 * sourced number keyed the way citations name it in usedFor (e.g. polio.vaccines.IPV.infection).
 * Shared by the citation and provisional tests.
 */

/** Every research-backed config object, keyed by the prefix citations use in usedFor. */
export const CONFIG: Record<string, object> = { ...DISEASES, behaviour: BEHAVIOUR, population: POPULATION };
/** Fields that are not research numbers (names, labels). */
const PLAIN = new Set(['id', 'name', 'group', 'blurb', 'partialCourse']);

export function isSourced(v: unknown): v is Sourced<number | null> {
	return !!v && typeof v === 'object' && 'value' in v && 'sources' in v;
}

/** Vaccine fields that are names and flags, not research numbers. */
const VACCINE_PLAIN = new Set(['product', 'version', 'label', 'default']);
/** Vaccine fields where null means "no pooled figure exists" rather than a missing source. */
const VACCINE_NULLABLE = new Set(['severe', 'partial.infection', 'partial.severe']);

export function walk(): { sourced: { key: string; value: Sourced<number | null> }[]; bare: string[] } {
	const sourced: { key: string; value: Sourced<number | null> }[] = [];
	const bare: string[] = [];
	/** Every Sourced inside one vaccine entry, keyed e.g. polio.vaccines.IPV.partial.severe. */
	const walkVaccine = (base: string, path: string, obj: object) => {
		for (const [k, v] of Object.entries(obj)) {
			const field = path ? `${path}.${k}` : k;
			const key = `${base}.${field}`;
			if (!path && VACCINE_PLAIN.has(k)) continue;
			if (v === null && VACCINE_NULLABLE.has(field)) continue;
			if (isSourced(v)) sourced.push({ key, value: v });
			else if (!path && k === 'partial' && v && typeof v === 'object') walkVaccine(base, k, v);
			else bare.push(key);
		}
	};
	for (const [prefix, obj] of Object.entries(CONFIG)) {
		for (const [k, v] of Object.entries(obj)) {
			const key = `${prefix}.${k}`;
			if (PLAIN.has(k)) continue;
			if (k === 'vaccines' && Array.isArray(v)) {
				for (const vaccine of v as Vaccine[]) walkVaccine(`${key}.${vaccineKey(vaccine)}`, '', vaccine);
			} else if (isSourced(v)) {
				sourced.push({ key, value: v });
				// Nested sourced reasons, e.g. a band's outsideHospitalReason.
				for (const [nk, nv] of Object.entries(v))
					if (nv && typeof nv === 'object' && 'text' in nv && 'sources' in nv)
						sourced.push({
							key: `${key}.${nk}`,
							value: { value: null, sources: (nv as { sources: string[] }).sources }
						});
			} else bare.push(key);
		}
	}
	return { sourced, bare };
}
