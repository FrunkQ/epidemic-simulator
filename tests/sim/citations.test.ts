import { describe, expect, it } from 'vitest';
import { BEHAVIOUR } from '../../src/lib/config/behaviour';
import { CITATIONS, EVIDENCE_RANK, OFFICIAL_PUBLISHERS } from '../../src/lib/config/citations';
import { DISEASES, perSymptomatic } from '../../src/lib/config/diseases';
import { aboutKeys, derivedKeys } from '../../src/lib/config/herd';
import { POPULATION } from '../../src/lib/config/population';
import type { DiseaseConfig, DiseaseId, Sourced } from '../../src/lib/sim/types';

/** Every research-backed config object, keyed by the prefix citations use in usedFor. */
const CONFIG: Record<string, object> = { ...DISEASES, behaviour: BEHAVIOUR, population: POPULATION };
/** Fields that are not research numbers (names, labels). */
const PLAIN = new Set(['id', 'name', 'group', 'blurb']);

function isSourced(v: unknown): v is Sourced<number | null> {
	return !!v && typeof v === 'object' && 'value' in v && 'sources' in v;
}

function walk(): { sourced: { key: string; value: Sourced<number | null> }[]; bare: string[] } {
	const sourced: { key: string; value: Sourced<number | null> }[] = [];
	const bare: string[] = [];
	for (const [prefix, obj] of Object.entries(CONFIG)) {
		for (const [k, v] of Object.entries(obj)) {
			const key = `${prefix}.${k}`;
			if (PLAIN.has(k)) continue;
			if (isSourced(v)) sourced.push({ key, value: v });
			else bare.push(key);
		}
	}
	return { sourced, bare };
}

describe('citations', () => {
	const ids = new Set(CITATIONS.map((c) => c.id));
	const { sourced, bare } = walk();

	it('has unique ids', () => {
		expect(ids.size).toBe(CITATIONS.length);
	});

	it('has no bare numbers in research config', () => {
		expect(bare).toEqual([]);
	});

	it('gives every research number at least one source', () => {
		expect(sourced.filter((n) => n.value.sources.length === 0).map((n) => n.key)).toEqual([]);
	});

	it('has an entry for every source id used', () => {
		const unknown = sourced.flatMap((n) =>
			n.value.sources.filter((s) => !ids.has(s)).map((s) => `${n.key} -> ${s}`)
		);
		expect(unknown).toEqual([]);
	});

	it('only names config keys that exist in usedFor', () => {
		const keys = new Set([
			...sourced.map((n) => n.key),
			...derivedKeys(Object.keys(DISEASES) as DiseaseId[]),
			...aboutKeys(Object.keys(DISEASES) as DiseaseId[])
		]);
		const unknown = CITATIONS.flatMap((c) =>
			c.usedFor.filter((u) => !keys.has(u)).map((u) => `${c.id} -> ${u}`)
		);
		expect(unknown).toEqual([]);
	});

	it('cites back every number that names it', () => {
		const missing = CITATIONS.flatMap((c) =>
			c.usedFor
				.filter((u) => sourced.some((n) => n.key === u && !n.value.sources.includes(c.id)))
				.map((u) => `${c.id} -> ${u}`)
		);
		expect(missing).toEqual([]);
	});

	it('only uses sources that passed verification', () => {
		expect(CITATIONS.filter((c) => c.verified.ok !== true).map((c) => c.id)).toEqual([]);
	});

	it('records what each source is used for, why, the quote and where it is', () => {
		for (const c of CITATIONS) {
			expect(c.usedFor.length, c.id).toBeGreaterThan(0);
			expect(c.quote.trim().length, c.id).toBeGreaterThan(0);
			expect(c.location.trim().length, c.id).toBeGreaterThan(0);
			expect(c.why.trim().length, c.id).toBeGreaterThan(0);
			expect(c.context.trim().length, c.id).toBeGreaterThan(0);
			expect(c.verified.by.trim().length, c.id).toBeGreaterThan(0);
			expect(c.verified.on, c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(c.doi ?? c.url, c.id).toBeTruthy();
		}
	});

	it('labels the behaviour research from COVID-19 the same way', () => {
		const behaviour = CITATIONS.filter((c) => c.usedFor.some((u) => u.startsWith('behaviour.lockdown')));
		expect(behaviour.length).toBeGreaterThan(0);
		for (const c of behaviour) expect(c.context, c.id).toBe('COVID-19 era');
	});

	it('uses COVID-era research for behaviour and COVID-19 itself, never for other diseases', () => {
		const misused = CITATIONS.filter(
			(c) =>
				c.context === 'COVID-19 era' &&
				c.usedFor.some((u) => !u.startsWith('behaviour.') && !u.startsWith('covid19.'))
		).map((c) => c.id);
		expect(misused).toEqual([]);
	});

	it('uses only peer-reviewed papers and named public bodies (Alex: no random websites)', () => {
		const ranks = new Set<string>(EVIDENCE_RANK);
		const publishers = new Set<string>(OFFICIAL_PUBLISHERS);
		for (const c of CITATIONS) {
			expect(ranks.has(c.evidence), c.id).toBe(true);
			if (c.evidence === 'official') {
				expect(publishers.has(c.publisher ?? ''), c.id).toBe(true);
				expect(c.url, c.id).toBeTruthy();
			} else {
				// Papers are cited by DOI, and never by a preprint server's DOI.
				expect(c.doi, c.id).toBeTruthy();
				expect(c.doi, c.id).not.toMatch(/^10\.(1101|21203)\//);
			}
			if (c.mirrorUrl) expect(c.url ?? c.doi, `${c.id} has a mirror but no original`).toBeTruthy();
		}
	});
	it('explains every number whose best source is only a review or one study', () => {
		const byId = new Map(CITATIONS.map((c) => [c.id, c]));
		const rank = (id: string) => EVIDENCE_RANK.indexOf(byId.get(id)!.evidence);
		const firstWeak = EVIDENCE_RANK.indexOf('review');
		for (const { key, value } of sourced) {
			if (Math.min(...value.sources.map(rank)) < firstWeak) continue;
			const reasons = value.sources.map((id) => byId.get(id)!.noReviewReason ?? '').filter(Boolean);
			expect(reasons.length, `${key} rests on a review or one study; add a noReviewReason`).toBeGreaterThan(
				0
			);
		}
	});
	it('works out death per case from death per infection, never as a typed copy', () => {
		for (const d of Object.values(DISEASES) as DiseaseConfig[]) {
			if (!d.infectionFatalityRate) continue;
			expect(d.mortality.value, d.id).toBeCloseTo(
				perSymptomatic(d.infectionFatalityRate, d.asymptomaticFraction),
				12
			);
		}
	});
});
