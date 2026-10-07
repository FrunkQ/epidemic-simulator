import { Agents } from './agents';
import { State } from './types';

/**
 * One uniform grid over the whole world, rebuilt every tick with a counting sort.
 * Only living dots inside a region go in; travellers and the dead do not.
 */
export class SpatialGrid {
	readonly cellSize: number;
	readonly cols: number;
	readonly rows: number;
	/** cellStart[c] .. cellStart[c + 1] index into cellItems for cell c. */
	readonly cellStart: Int32Array;
	readonly cellItems: Int32Array;
	/** Cell of each dot this tick, or -1 when not in the grid. */
	readonly cellOf: Int32Array;
	/** Scratch write position per cell during a rebuild. */
	private readonly cursor: Int32Array;

	constructor(worldWidth: number, worldHeight: number, cellSize: number, capacity: number) {
		this.cellSize = cellSize;
		this.cols = Math.ceil(worldWidth / cellSize) + 1;
		this.rows = Math.ceil(worldHeight / cellSize) + 1;
		this.cellStart = new Int32Array(this.cols * this.rows + 1);
		this.cellItems = new Int32Array(capacity);
		this.cellOf = new Int32Array(capacity);
		this.cursor = new Int32Array(this.cols * this.rows);
	}

	cellIndex(x: number, y: number): number {
		let cx = Math.floor(x / this.cellSize);
		let cy = Math.floor(y / this.cellSize);
		if (cx < 0) cx = 0;
		else if (cx >= this.cols) cx = this.cols - 1;
		if (cy < 0) cy = 0;
		else if (cy >= this.rows) cy = this.rows - 1;
		return cy * this.cols + cx;
	}

	rebuild(agents: Agents): void {
		const { cellStart, cellItems, cellOf, cursor } = this;
		const n = agents.activeCount;
		const cells = this.cols * this.rows;
		cellStart.fill(0);
		for (let i = 0; i < n; i++) {
			if (agents.region[i] < 0 || agents.state[i] === State.DECEASED) {
				cellOf[i] = -1;
				continue;
			}
			const c = this.cellIndex(agents.x[i], agents.y[i]);
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
