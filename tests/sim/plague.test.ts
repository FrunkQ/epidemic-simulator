import { describe, expect, it } from 'vitest';
import { loadDisease } from '../../src/lib/config';
import { DISEASES } from '../../src/lib/config/diseases';
import { CALIBRATION } from '../../src/lib/config/diseases.generated';
import { defaultPolicy, withValue } from '../../src/lib/config/healthPolicy';
import { microcosm, singleCity } from '../../src/lib/config/scenarios';
import { TICKS_PER_DAY } from '../../src/lib/sim/constants';
import { toRuntime } from '../../src/lib/sim/disease';
import { createSimulation } from '../../src/lib/sim/engine';
import { State, type DiseaseConfig, type DiseaseId } from '../../src/lib/sim/types';

/** The microcosm with nobody vaccinated and plenty of travel, so travellers are common. */
function travelWorld(airports: boolean) {
	const scenario = microcosm(0);
	for (const r of scenario.regions) {
		r.vaccinatedFull = 0;
		r.vaccinatedPartial = 0;
		r.hasAirport = airports;
		r.policy = withValue(r.policy, 'travelFrequency', 3);
	}
	return scenario;
}

describe('latentDays (6.1)', () => {
	it('changes nothing when it is 0 or left out', () => {
		const run = (latent: boolean) => {
			const config = latent ? { ...DISEASES.flu, latentDays: { value: 0, sources: [] } } : DISEASES.flu;
			const sim = createSimulation(microcosm(0), {
				seed: 3,
				diseaseId: 'flu',
				disease: toRuntime(config, CALIBRATION.flu)
			});
			sim.send({ type: 'seed', region: 1, count: 20 });
			sim.step(60 * TICKS_PER_DAY);
			return JSON.stringify(sim.snapshot());
		};
		expect(run(true)).toBe(run(false));
		for (const id of Object.keys(DISEASES) as DiseaseId[])
			if (id !== 'plague') expect(loadDisease(id).latentTicks, id).toBe(0);
	});

	it('is never longer than the silent phase', () => {
		for (const d of Object.values(DISEASES) as DiseaseConfig[])
			expect(d.latentDays?.value ?? 0, d.id).toBeLessThanOrEqual(d.silentDays.value);
	});

	it('keeps an incubating dot from infecting anyone until it is ill', () => {
		const plague = loadDisease('plague');
		expect(plague.latentTicks).toBe(plague.silentTicks);
		const sim = createSimulation(singleCity({ population: 500_000 }), { seed: 4, diseaseId: 'plague' });
		const cases = sim.seedNow(0, 200).length;
		// Index cases are back-dated one tick so they can spread from the next tick (seedCases), so
		// stop two ticks short of the end of the latent days.
		sim.step(plague.latentTicks - 2);
		expect(sim.snapshot().totals.everInfected).toBe(cases);
		sim.step(plague.illTicks);
		expect(sim.snapshot().totals.everInfected).toBeGreaterThan(cases);
	});
});

describe('Black Death travel (6.8)', () => {
	it('an incubating air traveller carries it to another city', () => {
		let seeded = 0;
		for (const seed of [1, 2, 3]) {
			const sim = createSimulation(travelWorld(true), { seed, diseaseId: 'plague' });
			sim.send({ type: 'seed', region: 1, count: 50 });
			const a = sim.agents;
			const boardedSilent = new Uint8Array(a.capacity);
			let landedSilent = 0;
			let reached = false;
			for (let t = 0; t < 120 * TICKS_PER_DAY && !reached; t++) {
				sim.step(1);
				for (let i = 0; i < a.activeCount; i++) {
					const r = a.route[i];
					if (r >= 0 && sim.routes[r].kind === 'air' && a.state[i] === State.SILENT) boardedSilent[i] = 1;
					if (r < 0 && boardedSilent[i] === 1) {
						boardedSilent[i] = 0;
						if (a.region[i] !== 1 && a.state[i] === State.SILENT) landedSilent++;
					}
				}
				if (t % TICKS_PER_DAY === 0)
					reached = sim.snapshot().regions.some((reg, k) => k !== 1 && reg.counts.everInfected > 0);
			}
			if (reached && landedSilent > 0) seeded++;
		}
		expect(seeded).toBeGreaterThanOrEqual(2);
	});

	it('does not cross by ferry or road: travellers fall ill on the way', () => {
		const sim = createSimulation(travelWorld(false), { seed: 5, diseaseId: 'plague' });
		expect(sim.routes.length).toBeGreaterThan(0);
		expect(sim.routes.every((r) => r.kind !== 'air')).toBe(true);
		sim.send({ type: 'seed', region: 1, count: 50 });
		const a = sim.agents;
		let illOnTheWay = 0;
		for (let day = 0; day < 150; day++) {
			sim.step(TICKS_PER_DAY);
			for (let i = 0; i < a.activeCount; i++)
				if (a.route[i] >= 0 && a.state[i] === State.SYMPTOMATIC) illOnTheWay++;
		}
		const t = sim.snapshot();
		expect(t.regions[1].counts.everInfected).toBeGreaterThan(50);
		t.regions.forEach((r, k) => {
			if (k !== 1) expect(r.counts.everInfected, r.name).toBe(0);
		});
		expect(illOnTheWay).toBeGreaterThan(0);
	});
});

describe('care basis (6.6)', () => {
	const beds = (perThousand: number) =>
		withValue(withValue(defaultPolicy(), 'hospitalBedsPerThousand', perThousand), 'spareBedShare', 1);
	/** Deaths with plenty of beds and with almost none, same seed. */
	function deathsBothWays(id: DiseaseId, basis?: 'era' | 'modern-care') {
		const base = DISEASES[id];
		// Hospital share well above the death rate, so strain would bite if it applied (6.6).
		const config = basis
			? {
					...base,
					mortalityBasis: basis,
					hospitalisedShare: { value: 0.6, sources: [] },
					hospitalisedByAge: undefined
				}
			: base;
		const disease = toRuntime(config, CALIBRATION[id]);
		return [1000, 0.01].map((b) => {
			const sim = createSimulation(singleCity({ population: 500_000, policy: beds(b) }), {
				seed: 8,
				diseaseId: id,
				disease
			});
			sim.seedNow(0, 400);
			sim.step(disease.silentTicks + disease.illTicks + 2 * TICKS_PER_DAY);
			return sim.snapshot().deaths;
		});
	}

	it('every disease declares one, and only 1918 flu and the Black Death are era rates', () => {
		for (const d of Object.values(DISEASES)) {
			expect(['modern-care', 'era'], d.id).toContain(d.mortalityBasis);
			expect(d.mortalityBasis === 'era', d.id).toBe(d.id === 'flu1918' || d.id === 'plague');
		}
	});

	it('full hospitals don’t change an era death rate', () => {
		for (const id of ['plague', 'flu1918'] as DiseaseId[]) {
			const [roomy, full] = deathsBothWays(id);
			expect(full, id).toBe(roomy);
		}
		const [roomy, full] = deathsBothWays('flu1918', 'era');
		expect(full).toBe(roomy);
	});

	it('full hospitals raise a modern-care death rate', () => {
		const [roomy, full] = deathsBothWays('flu1918', 'modern-care');
		expect(full).toBeGreaterThan(roomy * 1.2);
	});
});
