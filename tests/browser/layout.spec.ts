import { expect, test, type Page } from '@playwright/test';

/*
 * Browser checks of the card layout (10), against a build with VITE_LAYOUT_PROBE=1, which exposes
 * the cities' discs on screen and logs each animation frame's map scale and docked state. The page
 * runs a fixed seed; every check waits for the layout to settle and never asserts on timing.
 */

interface Disc {
	x: number;
	y: number;
	r: number;
}
interface Probe {
	stage: { width: number; height: number };
	discs: Disc[];
	scale: number;
	docked: boolean;
}
interface Frame {
	scale: number;
	docked: boolean;
}
interface Logged extends Frame {
	frame: number;
}

/** The four target screens (10): cards always float there. */
const TARGETS = [
	[1400, 900],
	[1366, 768],
	[1280, 720],
	[1920, 1080]
] as const;

const probe = (page: Page) =>
	page.evaluate(() => (window as unknown as { __layoutProbe: () => Probe }).__layoutProbe());
const frameCount = (page: Page) =>
	page.evaluate(() => (window as unknown as { __layoutLog: Frame[] }).__layoutLog.length);

/** Wait until 30 frames in a row drew the same layout and every card has its final size. */
async function settle(page: Page) {
	await page.waitForFunction(() => {
		const log = (window as unknown as { __layoutLog: Frame[] }).__layoutLog;
		if (!log || log.length < 30) return false;
		const last = log[log.length - 1];
		return log.slice(-30).every((f) => f.docked === last.docked && Math.abs(f.scale - last.scale) < 1e-9);
	});
}

async function open(page: Page, w: number, h: number) {
	await page.setViewportSize({ width: w, height: h });
	await page.goto('/');
	await settle(page);
}

/**
 * The frames painted since log entry `from`, each with the map scale it drew (the last map drawn
 * in that frame) and the strip as it was painted (as the next frame's first map found it), with
 * repeats merged.
 */
async function paintedSince(page: Page, from: number): Promise<Frame[]> {
	const log = await page.evaluate(() => (window as unknown as { __layoutLog: Logged[] }).__layoutLog);
	const frames: Logged[][] = [];
	for (const entry of log.slice(from)) {
		const last = frames[frames.length - 1];
		if (last && last[0].frame === entry.frame) last.push(entry);
		else frames.push([entry]);
	}
	const painted: Frame[] = [];
	for (let k = 0; k + 1 < frames.length; k++) {
		const f = { scale: frames[k][frames[k].length - 1].scale, docked: frames[k + 1][0].docked };
		const prev = painted[painted.length - 1];
		if (!prev || prev.docked !== f.docked || Math.abs(prev.scale - f.scale) > 1e-6) painted.push(f);
	}
	return painted;
}

/** After a change, the page goes straight from what it showed before to the final layout. */
function expectStraightToFinal(frames: Frame[], label: string) {
	expect(frames.length, `${label}: ${JSON.stringify(frames)}`).toBeLessThanOrEqual(2);
}

const docked = (page: Page) => page.locator('.strip').count();

/** Cards that reach into a city's disc, and card buttons another card sits on (can't be clicked). */
async function covers(page: Page) {
	const stage = (await page.locator('canvas').first().boundingBox())!;
	const { discs } = await probe(page);
	const cards = page.locator('section.card');
	const out: string[] = [];
	for (let i = 0; i < (await cards.count()); i++) {
		const b = (await cards.nth(i).boundingBox())!;
		const x = b.x - stage.x;
		const y = b.y - stage.y;
		discs.forEach((d, k) => {
			const nx = Math.min(Math.max(d.x, x), x + b.width);
			const ny = Math.min(Math.max(d.y, y), y + b.height);
			if (Math.hypot(nx - d.x, ny - d.y) < d.r - 0.5) out.push(`card ${i} covers city ${k}`);
		});
	}
	// Every visible button in a card is the top element at its centre.
	const blocked = await cards.evaluateAll((els) =>
		els.flatMap((card, i) =>
			[...card.querySelectorAll('button')].flatMap((button) => {
				const r = button.getBoundingClientRect();
				if (r.width === 0 || r.height === 0) return [];
				const cx = r.left + r.width / 2;
				const cy = r.top + r.height / 2;
				// Only buttons on screen and inside their card's visible box can be clicked anyway.
				const box = card.getBoundingClientRect();
				if (cy < box.top || cy > box.bottom || cy < 0 || cy > innerHeight) return [];
				const top = document.elementFromPoint(cx, cy);
				return top && button.contains(top) ? [] : [`card ${i}: "${button.textContent?.trim()}" is covered`];
			})
		)
	);
	return [...out, ...blocked];
}

for (const [w, h] of TARGETS) {
	test(`${w}x${h}: cards float, and no card, open or closed, covers a city or another card's buttons`, async ({
		page
	}) => {
		await open(page, w, h);
		expect(await docked(page)).toBe(0);
		expect(await covers(page)).toEqual([]);
		const cards = page.locator('section.card');
		for (let i = 0; i < (await cards.count()); i++) {
			for (const name of ['Vaccination', 'Health policy']) {
				await cards.nth(i).getByRole('button', { name }).click();
				await settle(page);
				expect(await covers(page), `card ${i} ${name}`).toEqual([]);
				await cards.nth(i).getByRole('button', { name }).click();
				await settle(page);
			}
		}
	});
}

test('1280x600: the cards dock at full height, open or closed', async ({ page }) => {
	await open(page, 1280, 600);
	expect(await docked(page)).toBe(1);
	const cards = page.locator('.strip section.card');
	const full = () => cards.evaluateAll((els) => els.map((e) => e.scrollHeight - e.clientHeight));
	expect(await full()).toEqual([0, 0, 0]);
	for (let i = 0; i < (await cards.count()); i++) {
		await cards.nth(i).getByRole('button', { name: 'Health policy' }).click();
		await settle(page);
		expect(await full(), `card ${i} open`).toEqual([0, 0, 0]);
		await cards.nth(i).getByRole('button', { name: 'Health policy' }).click();
	}
});

/** Window changes, each ending where a fresh load gives the same layout, painted with no wrong frame. */
const PATHS: { name: string; sizes: (readonly [number, number])[] }[] = [
	{
		name: 'widen from narrow to a target size',
		sizes: [
			[683, 768],
			[1366, 768]
		]
	},
	{
		name: 'half-screen snap, then maximise',
		sizes: [
			[1280, 720],
			[700, 720],
			[1280, 720]
		]
	},
	{
		name: 'widen from narrow to a narrow floating width',
		sizes: [
			[700, 900],
			[800, 900]
		]
	},
	{
		name: 'widen from narrow to a short window',
		sizes: [
			[700, 600],
			[1280, 600]
		]
	},
	{
		name: 'narrow from wide',
		sizes: [
			[1400, 900],
			[700, 900]
		]
	}
];

for (const { name, sizes } of PATHS) {
	test(`${name} (${sizes.map((s) => s.join('x')).join(' → ')}): same layout as a fresh load, no wrong frame`, async ({
		page,
		browser
	}) => {
		const [w0, h0] = sizes[0];
		await open(page, w0, h0);
		for (const [w, h] of sizes.slice(1)) {
			const from = await frameCount(page);
			await page.setViewportSize({ width: w, height: h });
			await settle(page);
			expectStraightToFinal(await paintedSince(page, from), `${w}x${h}`);
		}
		const [w, h] = sizes[sizes.length - 1];
		const fresh = await browser.newPage();
		await open(fresh, w, h);
		const want = await probe(fresh);
		const got = await probe(page);
		expect(got.docked).toBe(want.docked);
		expect(got.scale).toBeCloseTo(want.scale, 6);
		await fresh.close();
	});
}

test('1280x720: switching to plague and back keeps the cards floating, with no wrong frame', async ({
	page
}) => {
	await open(page, 1280, 720);
	for (const disease of ['plague', 'measles']) {
		const from = await frameCount(page);
		await page.selectOption('select', disease);
		await settle(page);
		expect(await docked(page), disease).toBe(0);
		expectStraightToFinal(await paintedSince(page, from), disease);
		expect(await covers(page), disease).toEqual([]);
	}
});

test('the first painted frame is already the final layout', async ({ page }) => {
	for (const [w, h] of [...TARGETS, [1280, 600] as const, [390, 844] as const]) {
		await open(page, w, h);
		expectStraightToFinal((await paintedSince(page, 0)).slice(0, 3), `${w}x${h} load`);
	}
});
