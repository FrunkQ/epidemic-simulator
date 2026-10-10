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
		// To the last tick of the latent days, index cases included.
		sim.step(plague.latentTicks);
		expect(sim.snapshot().totals.everInfected).toBe(cases);
		sim.step(plague.illTicks);
		expect(sim.snapshot().totals.everInfected).toBeGreaterThan(cases);
	});

	it('never lets a silent dot infect anyone when the whole silent phase is latent, index cases included', () => {
		const plague = loadDisease('plague');
		const sim = createSimulation(travelWorld(true), { seed: 6, diseaseId: 'plague' });
		// Many index cases both ways (a queued command and seedNow), so an early tick would show.
		sim.send({ type: 'seed', region: 1, count: 400 });
		sim.seedNow(0, 400);
		const a = sim.agents;
		let checked = 0;
		for (let t = 0; t < 30 * TICKS_PER_DAY; t++) {
			sim.step(1);
			const tick = sim.snapshot().tick;
			for (let j = 0; j < a.activeCount; j++) {
				const src = a.infectedBy[j];
				if (a.infectedTick[j] !== tick || src < 0) continue;
				// Silent at transmission means still silent now, or turned ill later this same tick.
				const wasSilent =
					a.state[src] === State.SILENT ||
					(a.state[src] === State.SYMPTOMATIC && a.stateTicks[src] === plague.illTicks);
				expect(wasSilent, `dot ${j} at tick ${tick}`).toBe(false);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(100);
	});
});

describe('Black Death travel (6.8)', () => {
	it('an incubating air traveller carries it to another city', () => {
		let seeded = 0;
		for (const seed of [1, 2, 3]) {
			const sim = createSimulation(travelWorld(true), { seed, diseaseId: 'plague' });
			sim.send({ type: 'seed', region: 1, count: 50 });
			const a = sim.agents;
			/** Dots that were on a flight while still incubating (they may fall ill before landing). */
			const flewIncubating = new Uint8Array(a.capacity);
			let firstSource = -2;
			for (let t = 0; t < 120 * TICKS_PER_DAY && firstSource === -2; t++) {
				sim.step(1);
				const tick = sim.snapshot().tick;
				for (let i = 0; i < a.activeCount; i++) {
					const r = a.route[i];
					if (r >= 0 && sim.routes[r].kind === 'air' && a.state[i] === State.SILENT) flewIncubating[i] = 1;
				}
				// The first case caught in another city: who gave it to them?
				for (let j = 0; j < a.activeCount && firstSource === -2; j++)
					if (a.infectedTick[j] === tick && a.region[j] >= 0 && a.region[j] !== 1)
						firstSource = a.infectedBy[j];
			}
			if (firstSource >= 0 && flewIncubating[firstSource] === 1 && a.region[firstSource] !== 1) seeded++;
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
	/** Deaths and peak pressure with plenty of beds and with almost none, same seed. */
	function deathsBothWays(id: DiseaseId, basis: 'era' | 'modern-care') {
		const base = DISEASES[id];
		// Hospital share well above the death rate, so strain would bite if it applied (6.6).
		const config = {
			...base,
			mortalityBasis: basis,
			hospitalisedShare: { value: 0.6, sources: [] },
			hospitalisedByAge: undefined
		};
		const disease = toRuntime(config, CALIBRATION[id]);
		return [1000, 0.01].map((b) => {
			const sim = createSimulation(singleCity({ population: 500_000, policy: beds(b) }), {
				seed: 8,
				diseaseId: id,
				disease
			});
			sim.seedNow(0, 400);
			let peak = 0;
			const ticks = disease.silentTicks + disease.illTicks + 2 * TICKS_PER_DAY;
			for (let t = 0; t < ticks; t++) {
				sim.step(1);
				peak = Math.max(peak, sim.snapshot().regions[0].pressure);
			}
			return { deaths: sim.snapshot().deaths, peak };
		});
	}

	// A hospital share above the death rate, so strain would bite if it applied (when h = d, P = h
	// whatever the strain, so the real entries couldn't fail this).
	it('full hospitals don’t change an era death rate', () => {
		const [roomy, full] = deathsBothWays('flu1918', 'era');
		expect(full.peak).toBeGreaterThan(1);
		expect(full.deaths).toBe(roomy.deaths);
	});

	it('full hospitals raise a modern-care death rate', () => {
		const [roomy, full] = deathsBothWays('flu1918', 'modern-care');
		expect(full.peak).toBeGreaterThan(1);
		expect(full.deaths).toBeGreaterThan(roomy.deaths * 1.2);
	});
});
