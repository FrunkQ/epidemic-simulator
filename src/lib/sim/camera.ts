/** Pan and zoom. All drawing and all clicks go through this transform. */
export class Camera {
	/** World position at the top-left of the screen. */
	x = 0;
	y = 0;
	/** Screen pixels per world unit. */
	scale = 1;

	worldToScreen(wx: number, wy: number): { x: number; y: number } {
		return { x: (wx - this.x) * this.scale, y: (wy - this.y) * this.scale };
	}

	screenToWorld(sx: number, sy: number): { x: number; y: number } {
		return { x: sx / this.scale + this.x, y: sy / this.scale + this.y };
	}

	/**
	 * Frame a world rectangle inside a screen of the given size, with a margin in pixels at the
	 * sides and (if given) a different one at the top and bottom.
	 */
	fit(
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
		width: number,
		height: number,
		margin = 24,
		marginY = margin
	): void {
		const w = Math.max(1, maxX - minX);
		const h = Math.max(1, maxY - minY);
		this.scale = Math.min((width - 2 * margin) / w, (height - 2 * marginY) / h);
		this.x = minX - (width / this.scale - w) / 2;
		this.y = minY - (height / this.scale - h) / 2;
	}

	/** Zoom by a factor around a screen point. */
	zoomAt(factor: number, sx: number, sy: number): void {
		const before = this.screenToWorld(sx, sy);
		this.scale *= factor;
		const after = this.screenToWorld(sx, sy);
		this.x += before.x - after.x;
		this.y += before.y - after.y;
	}
}
