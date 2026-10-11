import { TICKS_PER_DAY, TICKS_PER_SECOND } from '../sim/constants';
import type { Speed } from '../sim/types';

/** The speed buttons, slowest first. Pacing lives in the page and the canvas, never the engine. */
export const SPEEDS: { value: Speed; label: string; short: string }[] = [
	{ value: 0, label: 'Paused', short: '❚❚' },
	{ value: 0.25, label: 'Very slow', short: '¼×' },
	{ value: 0.5, label: 'Slow', short: '½×' },
	{ value: 1, label: 'Normal', short: '1×' },
	{ value: 2, label: 'Fast', short: '2×' },
	{ value: 4, label: 'Very fast', short: '4×' },
	{ value: 8, label: 'Fastest', short: '8×' }
];

/** The speed a visit starts at: slow enough to follow single dots as they move (11 Oct). */
export const DEFAULT_SPEED: Speed = 0.25;

/** Simulated days per real second at a speed, when the browser keeps up. */
export function daysPerSecond(speed: Speed): number {
	return (speed * TICKS_PER_SECOND) / TICKS_PER_DAY;
}

/** A speed button's tooltip, such as "Very slow: half a day a second". */
export function speedTitle(speed: Speed, label: string): string {
	const days = daysPerSecond(speed);
	if (days === 0) return label;
	const pace = days === 0.5 ? 'half a day' : `${days} ${days === 1 ? 'day' : 'days'}`;
	return `${label}: ${pace} a second${speed === 8 ? ', or as fast as your device allows' : ''}`;
}
