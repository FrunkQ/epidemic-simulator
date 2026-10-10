import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import {
	COVID19_IFR_PERCENT_BY_AGE,
	COVID19_SEVERE_PERCENT_BY_GROUP,
	UK_2019_AGE_GROUPS
} from '../../src/lib/config/covidAgeIfr';
import { DISEASES } from '../../src/lib/config/diseases';
import { DEFAULT_POLICY, ENGLAND_POLICY } from '../../src/lib/config/healthPolicy';
import { POPULATION } from '../../src/lib/config/population';
import { MICROCOSM_COVERAGE } from '../../src/lib/config/scenarios';
import { vaccineKey } from '../../src/lib/config/vaccines';
import type { Sourced, Vaccine, VaccineDeathRate } from '../../src/lib/sim/types';

/*
 * Walks all research config, including inside each disease's vaccine list, and returns every
 * sourced number keyed the way citations name it in usedFor (e.g. polio.vaccines.IPV.infection).
 * Shared by the citation and provisional tests.
 */

/**
 * Every research-backed config object, keyed by the prefix citations use in usedFor. A number
 * shared by reference (the default health policy reuses behaviour's beds) is walked once, under
 * the first key that reaches it. tests/sim/citations.test.ts checks that every sourced number any
 * config module exports is reached from here.
 */
export const CONFIG: Record<string, object> = {
	...DISEASES,
	behaviour: BEHAVIOUR,
	population: POPULATION,
	healthPolicy: DEFAULT_POLICY,
	englandPolicy: ENGLAND_POLICY,
	scenarios: MICROCOSM_COVERAGE,
	covidAgeIfr: { COVID19_IFR_PERCENT_BY_AGE, UK_2019_AGE_GROUPS, COVID19_SEVERE_PERCENT_BY_GROUP }
};
/**
 * Fields that are not research numbers (names, labels, and the care basis, a label whose evidence
 * is the death rate's own source).
 */
const PLAIN = new Set(['id', 'name', 'group', 'blurb', 'mortalityBasis']);

export function isSourced(v: unknown): v is Sourced<number | null> {
	return !!v && typeof v === 'object' && 'value' in v && 'sources' in v;
}

/** Vaccine fields that are names and flags, not research numbers. */
const VACCINE_PLAIN = new Set(['product', 'version', 'label', 'default', 'cardNote']);

export function walk(): {
	sourced: { key: string; value: Sourced<number | null> }[];
	bare: string[];
	/** Every sourced object walked, by identity. */
	seen: Set<object>;
} {
	const sourced: { key: string; value: Sourced<number | null> }[] = [];
	const bare: string[] = [];
	const seen = new Set<object>();
	/** Every Sourced inside one vaccine entry, keyed e.g. polio.vaccines.IPV.partial.severe. */
	const walkVaccine = (base: string, path: string, obj: object) => {
		for (const [k, v] of Object.entries(obj)) {
			const field = path ? `${path}.${k}` : k;
			const key = `${base}.${field}`;
			if (!path && VACCINE_PLAIN.has(k)) continue;
			if (!path && k === 'deathsPer100kDoses') {
				// A death-rate union: only the 'rate' kind holds a number; the others are sourced words.
				const r = v as VaccineDeathRate;
				seen.add(r);
				sourced.push({ key, value: { value: r.kind === 'rate' ? r.value : null, sources: r.sources } });
			} else if (isSourced(v)) {
				seen.add(v);
				sourced.push({ key, value: v });
			} else if (!path && (k === 'full' || k === 'partial') && v && typeof v === 'object')
				walkVaccine(base, k, v);
			else bare.push(key);
		}
	};
	for (const [prefix, obj] of Object.entries(CONFIG)) {
		for (const [k, v] of Object.entries(obj)) {
			const key = `${prefix}.${k}`;
			if (PLAIN.has(k)) continue;
			if (k === 'afterInfection' && v && typeof v === 'object') {
				for (const [nk, nv] of Object.entries(v))
					if (isSourced(nv)) {
						seen.add(nv);
						sourced.push({ key: `${key}.${nk}`, value: nv });
					} else bare.push(`${key}.${nk}`);
			} else if (k === 'vaccines' && Array.isArray(v)) {
				for (const vaccine of v as Vaccine[]) walkVaccine(`${key}.${vaccineKey(vaccine)}`, '', vaccine);
			} else if (isSourced(v)) {
				// The default policy reuses behaviour and population numbers by reference: walk them once.
				if ((prefix === 'healthPolicy' || prefix === 'englandPolicy') && seen.has(v)) continue;
				seen.add(v);
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
	return { sourced, bare, seen };
}
