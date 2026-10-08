import { ESSENTIAL_SHARE } from '../sim/constants';
import type { Bands, Sourced } from '../sim/types';
import { BEHAVIOUR } from './behaviour';
import { ENGLAND_ACUTE_BEDS_PER_1000, KH03_Q2_2023 } from './derived';
import { POPULATION } from './population';

/**
 * One population's health policy (4.2): every behaviour and healthcare number, each a slider on
 * its card. The engine only ever receives a resolved policy per region; it never knows about
 * countries. A value the user has changed keeps its field but drops its sources.
 */
export interface HealthPolicy {
	/** Share of people aged 0-14, 15-64 and 65+. Changing it restarts the run (who exists). */
	ageMix: Sourced<Bands>;
	/** Hospital beds per 1,000 people. Live. */
	hospitalBedsPerThousand: Sourced;
	/** Share of those beds normally free; only spare beds count as capacity. Live. */
	spareBedShare: Sourced;
	/** Share who stay home in a lockdown. Engine hook arrives in step 3. */
	lockdownCompliance: Sourced;
	/** Average days of lockdown before people drift back out. Engine hook in step 3. */
	lockdownFatigueMeanDays: Sourced;
	/** Spread of that point between people, in days. Engine hook in step 3. */
	lockdownFatigueSdDays: Sourced;
	/** Share of silent cases a mass test finds. Engine hook in step 3. */
	testingReach: Sourced;
	/** Days before a population can mass test again. Engine hook in step 3. */
	testingCooldownDays: Sourced;
	/** How often people travel, relative to the default trip rates (1 = normal). Live. */
	travelFrequency: Sourced;
}

/** The fields a step 2 card can change during a run, with their slider ranges and explainers. */
export const LIVE_POLICY_FIELDS = [
	{
		key: 'travelFrequency',
		label: 'Travel',
		min: 0,
		max: 3,
		step: 0.1,
		format: (v: number) => (v === 0 ? 'none' : `${v.toFixed(1)}× normal`),
		explain:
			'How often people here make trips to other places. A route runs at the lower of its two ends, so cutting travel here cuts every route to here.'
	},
	{
		key: 'hospitalBedsPerThousand',
		label: 'Hospital beds per 1,000 people',
		min: 0.5,
		max: 10,
		step: 0.1,
		format: (v: number) => v.toFixed(1),
		explain: `Hospital beds for short-term care. The EU average is about ${BEHAVIOUR.hospitalBedsPerThousand.value.toFixed(1)} for every 1,000 people.`
	},
	{
		key: 'spareBedShare',
		label: 'Beds normally free',
		min: 0,
		max: 0.5,
		step: 0.01,
		format: (v: number) => `${Math.round(v * 100)}%`,
		explain: `Most beds are already in use for other illnesses; across the EU about ${Math.round(BEHAVIOUR.spareBedShare.value * 100)}% are free. Only the free ones can take outbreak patients.`
	}
] as const satisfies readonly {
	key: keyof HealthPolicy;
	label: string;
	min: number;
	max: number;
	step: number;
	format: (v: number) => string;
	explain: string;
}[];

export type LivePolicyKey = (typeof LIVE_POLICY_FIELDS)[number]['key'];

const COMPLIANCE_PLACEHOLDER =
	'The step 1 default (90% stay home, the rest are essential workers); a COVID-era source comes with the step 3 lockdown hook.';
const TESTING_PLACEHOLDER = 'Mass testing arrives in step 3, with its sourced reach and cooldown.';

/** The general default policy (4.2), built from the sourced behaviour and population config. */
export const DEFAULT_POLICY: HealthPolicy = {
	ageMix: POPULATION.ageMix,
	hospitalBedsPerThousand: BEHAVIOUR.hospitalBedsPerThousand,
	spareBedShare: BEHAVIOUR.spareBedShare,
	lockdownCompliance: { value: 1 - ESSENTIAL_SHARE, sources: [], provisional: COMPLIANCE_PLACEHOLDER },
	lockdownFatigueMeanDays: BEHAVIOUR.lockdownFatigueMeanDays,
	lockdownFatigueSdDays: BEHAVIOUR.lockdownFatigueSdDays,
	testingReach: { value: 1, sources: [], provisional: TESTING_PLACEHOLDER },
	testingCooldownDays: { value: 7, sources: [], provisional: TESTING_PLACEHOLDER },
	travelFrequency: {
		value: 1,
		sources: [],
		provisional: 'A relative setting: 1 means the default trip rates, which are not yet sourced.'
	}
};

/**
 * England's NHS hospitals (the "England (NHS) figures" preset, 4.2): general and acute beds and
 * their occupancy, with UK ages. Eurostat has no UK curative beds, so it is England's NHS, not the
 * UK. Behaviour fields stay the general default.
 */
export const ENGLAND_POLICY: HealthPolicy = {
	...DEFAULT_POLICY,
	ageMix: POPULATION.ukAgeMix,
	hospitalBedsPerThousand: {
		value: ENGLAND_ACUTE_BEDS_PER_1000,
		sources: ['nhs-england-kh03-q2-2023-24', 'ons-england-pop-mid2023']
	},
	spareBedShare: { value: 1 - KH03_Q2_2023.occupancyPct / 100, sources: ['nhs-england-kh03-q2-2023-24'] }
};

/** The label the England preset shows wherever it appears (4.2). */
export const ENGLAND_POLICY_LABEL = 'England (NHS) figures';

/** A fresh copy of the general default, safe to change. */
export function defaultPolicy(): HealthPolicy {
	return structuredClone(DEFAULT_POLICY);
}

/** The policy with one field set by the user: the value is theirs, so it no longer has sources. */
export function withValue(policy: HealthPolicy, key: LivePolicyKey, value: number): HealthPolicy {
	return { ...policy, [key]: { value, sources: [] } };
}
