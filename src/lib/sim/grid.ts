import { Agents } from './agents';

/**
 * One uniform grid per population, covering its disc's bounding box (dots in different
 * populations never meet, because discs don't overlap). All the grids share one pair of
 * arrays; each region owns a contiguous block of cells. Rebuilt every tick with a counting
 * sort. Only living dots inside a region go in; travellers and the dead do not.
 */
export class SpatialGrid {
	readonly cellSize: number;
	readonly originX: Float64Array;
	readonly originY: Float64Array;
	readonly cols: Int32Array;
	readonly rows: Int32Array;
	/** First cell of each region's block. */
	readonly offset: Int32Array;
	readonly totalCells: number;
	/** cellStart[c] .. cellStart[c + 1] index into cellItems for cell c. */
	readonly cellStart: Int32Array;
	readonly cellItems: Int32Array;
	/** Cell of each dot this tick, or -1 when not in the grid. */
	readonly cellOf: Int32Array;
	private readonly cursor: Int32Array;

	/** `discs` holds [cx, cy, radius] per region. */
	constructor(discs: number[][], cellSize: number, capacity: number) {
		const n = discs.length;
		this.cellSize = cellSize;
		this.originX = new Float64Array(n);
		this.originY = new Float64Array(n);
		this.cols = new Int32Array(n);
		this.rows = new Int32Array(n);
		this.offset = new Int32Array(n);
		let total = 0;
		for (let r = 0; r < n; r++) {
			const [cx, cy, radius] = discs[r];
			const reach = radius + cellSize;
			this.originX[r] = cx - reach;
			this.originY[r] = cy - reach;
			const size = Math.ceil((2 * reach) / cellSize) + 1;
			this.cols[r] = size;
			this.rows[r] = size;
			this.offset[r] = total;
			total += size * size;
		}
		this.totalCells = total;
		this.cellStart = new Int32Array(total + 1);
		this.cursor = new Int32Array(total);
		this.cellItems = new Int32Array(capacity);
		this.cellOf = new Int32Array(capacity);
	}

	/** Column of a world x in a region's grid, clamped. */
	col(region: number, x: number): number {
		const c = Math.floor((x - this.originX[region]) / this.cellSize);
		const max = this.cols[region] - 1;
		return c < 0 ? 0 : c > max ? max : c;
	}

	row(region: number, y: number): number {
		const r = Math.floor((y - this.originY[region]) / this.cellSize);
		const max = this.rows[region] - 1;
		return r < 0 ? 0 : r > max ? max : r;
	}

	rebuild(agents: Agents): void {
		const { cellStart, cellItems, cellOf, cursor } = this;
		const n = agents.activeCount;
		const cells = this.totalCells;
		cellStart.fill(0);
		for (let i = 0; i < n; i++) {
			const r = agents.region[i];
			if (r < 0 || agents.dead[i] === 1) {
				cellOf[i] = -1;
				continue;
			}
			const c = this.offset[r] + this.row(r, agents.y[i]) * this.cols[r] + this.col(r, agents.x[i]);
			cellOf[i] = c;
			cellStart[c + 1]++;
		}
		for (let c = 0; c < cells; c++) cellStart[c + 1] += cellStart[c];
		for (let c = 0; c < cells; c++) cursor[c] = cellStart[c];
		for (let i = 0; i < n; i++) {
			const c = cellOf[i];
			if (c >= 0) cellItems[cursor[c]++] = i;
		}
	}
}
