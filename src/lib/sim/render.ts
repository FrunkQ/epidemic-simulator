import { Agents } from './agents';
import { Camera } from './camera';
import { Protection, State, type Region, type Viewport } from './types';

/** Display colours. Orange and yellow are kept far apart for colour-blind readers. */
export const COLOURS = {
	unprotected: '#4c8dff',
	full: '#2fbf71',
	partial: '#f2d24b',
	silent: '#ff7a1a',
	symptomatic: '#e5383b',
	recovered: '#9b6bff',
	deceased: '#7a7f87'
} as const;

const ORDER = ['deceased', 'unprotected', 'partial', 'full', 'recovered', 'silent', 'symptomatic'] as const;
type ColourKey = (typeof ORDER)[number];
const COLOUR_INDEX: Record<ColourKey, number> = Object.fromEntries(ORDER.map((k, i) => [k, i])) as Record<
	ColourKey,
	number
>;

/** Draws the world. Holds scratch buckets so drawing allocates nothing per dot. */
export class Renderer {
	private readonly buckets: Int32Array;
	private readonly bucketLen = new Int32Array(ORDER.length);
	private readonly capacity: number;

	constructor(capacity: number) {
		this.capacity = capacity;
		this.buckets = new Int32Array(capacity * ORDER.length);
	}

	draw(
		ctx: CanvasRenderingContext2D,
		viewport: Viewport,
		camera: Camera,
		agents: Agents,
		regions: Region[],
		radii: Float32Array,
		tick: number
	): void {
		const { width, height } = viewport;
		const s = camera.scale;
		const ox = camera.x;
		const oy = camera.y;

		ctx.fillStyle = '#0d1b2a';
		ctx.fillRect(0, 0, width, height);

		// Population discs.
		ctx.lineWidth = 1.5;
		for (let r = 0; r < regions.length; r++) {
			const reg = regions[r];
			ctx.beginPath();
			ctx.arc((reg.cx - ox) * s, (reg.cy - oy) * s, radii[r] * s + 4, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255,255,255,0.03)';
			ctx.fill();
			ctx.strokeStyle = 'rgba(180,200,230,0.35)';
			ctx.stroke();
		}

		// Sort visible dots into colour buckets.
		this.bucketLen.fill(0);
		const n = agents.activeCount;
		const cap = this.capacity;
		const margin = 4;
		for (let i = 0; i < n; i++) {
			const sx = (agents.x[i] - ox) * s;
			const sy = (agents.y[i] - oy) * s;
			if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) continue;
			const b = colourOf(agents, i);
			this.buckets[b * cap + this.bucketLen[b]++] = i;
		}

		const size = Math.max(1.5, Math.min(6, 3.2 * s));
		const half = size / 2;
		for (let b = 0; b < ORDER.length; b++) {
			const len = this.bucketLen[b];
			if (len === 0) continue;
			ctx.fillStyle = COLOURS[ORDER[b]];
			ctx.beginPath();
			for (let k = 0; k < len; k++) {
				const i = this.buckets[b * cap + k];
				ctx.rect((agents.x[i] - ox) * s - half, (agents.y[i] - oy) * s - half, size, size);
			}
			ctx.fill();
		}

		// A faint pulsing ring around every infectious dot.
		const pulse = 0.5 + 0.5 * Math.sin(tick * 0.2);
		ctx.lineWidth = 1;
		for (const key of ['silent', 'symptomatic'] as const) {
			const b = COLOUR_INDEX[key];
			const len = this.bucketLen[b];
			if (len === 0) continue;
			ctx.strokeStyle =
				key === 'silent' ? `rgba(255,122,26,${0.25 + 0.3 * pulse})` : `rgba(229,56,59,${0.25 + 0.3 * pulse})`;
			ctx.beginPath();
			const rr = size + 1.5 + pulse * 1.5;
			for (let k = 0; k < len; k++) {
				const i = this.buckets[b * cap + k];
				const sx = (agents.x[i] - ox) * s;
				const sy = (agents.y[i] - oy) * s;
				ctx.moveTo(sx + rr, sy);
				ctx.arc(sx, sy, rr, 0, Math.PI * 2);
			}
			ctx.stroke();
		}
	}
}

function colourOf(agents: Agents, i: number): number {
	const s = agents.state[i];
	if (s === State.DECEASED) return COLOUR_INDEX.deceased;
	if (s === State.SYMPTOMATIC || agents.isolated[i] === 1) return COLOUR_INDEX.symptomatic;
	if (s === State.SILENT) return COLOUR_INDEX.silent;
	if (s === State.RECOVERED) return COLOUR_INDEX.recovered;
	const p = agents.protection[i];
	if (p === Protection.FULL) return COLOUR_INDEX.full;
	if (p === Protection.PARTIAL) return COLOUR_INDEX.partial;
	return COLOUR_INDEX.unprotected;
}
