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
	drawn: [number, number];
	bitmap: [number, number];
	box: [number, number];
	dpr: number;
	window: [number, number];
	/** How many times the canvas has been sized (each clears it). */
	resets: number;
	/** A paint boundary, logged once a frame is painted, rather than a map drawn. */
	mark?: true;
}
/** A painted frame: its map's scale and the strip as painted, and what was wrong with the canvas. */
interface Painted extends Frame {
	window: [number, number];
	canvas?: string;
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

/**
 * Run the page's CPU six times slower: a layout that needs several steps in one frame then spills
 * into the next as on a slow machine (CI caught a wrong frame on widening this way that a fast
 * machine never showed).
 */
async function slowDown(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
}

/**
 * Wait until 30 frames in a row drew the same layout for the window as it is now, and every card
 * has its final size (frames from before a resize can agree with each other but not the window).
 */
async function settle(page: Page) {
	await page
		.waitForFunction(() => '__layoutLog' in window, null, { timeout: 10_000 })
		.catch(() => {
			throw new Error(
				'The page has no layout probe: build it with VITE_LAYOUT_PROBE=1 (npm run test:browser)'
			);
		});
	await page.waitForFunction(() => {
		const log = (window as unknown as { __layoutLog: Logged[] }).__layoutLog;
		if (log.length < 30) return false;
		const last = log[log.length - 1];
		return log
			.slice(-30)
			.every(
				(f) =>
					f.window[0] === innerWidth &&
					f.window[1] === innerHeight &&
					f.docked === last.docked &&
					Math.abs(f.scale - last.scale) < 1e-9
			);
	});
}

async function open(page: Page, w: number, h: number) {
	await page.setViewportSize({ width: w, height: h });
	await page.goto('/');
	await settle(page);
}

/**
 * The frames painted since log entry `from`, each with the map scale it drew and the page as painted.
 * The page logs every map drawn, and a mark after each frame is painted (a task queued from that
 * frame) with the page as it was then. A frame paints the last map drawn before its mark with that
 * frame's time or earlier: a map drawn from a task after the mark is painted in the next frame.
 * Repeats are merged. A frame also says what was wrong with its canvas, if anything: drawn for
 * another size than its box on the page, pixels not matching that box, or sized (so cleared) after
 * the map was drawn.
 */
async function paintedSince(page: Page, from: number): Promise<Painted[]> {
	const log = await page.evaluate(() => (window as unknown as { __layoutLog: Logged[] }).__layoutLog);
	let waiting: Logged[] = [];
	const painted: Painted[] = [];
	for (const entry of log.slice(from)) {
		if (!entry.mark) {
			waiting.push(entry);
			continue;
		}
		const now = waiting.filter((d) => d.frame <= entry.frame);
		waiting = waiting.filter((d) => d.frame > entry.frame);
		const drew = now[now.length - 1];
		if (!drew) continue;
		// The page as painted is the mark, unless the test resized the window between the paint and
		// the mark: then it is the page as the map was drawn.
		const moved = entry.window[0] !== drew.window[0] || entry.window[1] !== drew.window[1];
		const shown = moved ? drew : entry;
		const off = (a: number[], b: number[], by: number) =>
			Math.abs(a[0] - b[0]) > by || Math.abs(a[1] - b[1]) > by;
		const canvas = off(drew.drawn, shown.box, 0.5)
			? `drawn ${drew.drawn} in a ${shown.box} box`
			: shown.resets !== drew.resets
				? `cleared after drawing (sized ${shown.resets - drew.resets} more times)`
				: off(
							shown.bitmap.map((v) => v / shown.dpr),
							shown.box,
							1
					  )
					? `${shown.bitmap} px in a ${shown.box} box`
					: undefined;
		const f: Painted = {
			scale: drew.scale,
			docked: shown.docked,
			window: shown.window,
			...(canvas ? { canvas } : {})
		};
		const prev = painted[painted.length - 1];
		if (!prev || !same(prev, f) || prev.canvas !== f.canvas || !sameWindow(prev, f)) painted.push(f);
	}
	return painted;
}

const sameWindow = (a: Painted, b: Painted) => a.window[0] === b.window[0] && a.window[1] === b.window[1];
const same = (a: Frame, b: Frame) => a.docked === b.docked && Math.abs(a.scale - b.scale) <= 1e-6;

/**
 * After a change, every painted frame shows what the page showed before it (`before`) until the
 * first one that shows the final layout, and every frame after that shows the final layout; no
 * frame paints a canvas of the wrong size. After a resize (`resized`), a frame painted at the new
 * window size is always final: the old layout may show only while the window is still the old size. Without `before` (a load),
 * the first frame is final.
 */
async function expectStraightToFinal(
	page: Page,
	from: number,
	label: string,
	before?: Frame,
	resized = false
) {
	const frames = await paintedSince(page, from);
	const final = await probe(page);
	const size = page.viewportSize()!;
	const atFinalSize = (f: Painted) => f.window[0] === size.width && f.window[1] === size.height;
	const at = `${label}: ${JSON.stringify(frames)}, before ${JSON.stringify(before)}, final ${JSON.stringify({ scale: final.scale, docked: final.docked })}`;
	expect(
		frames.filter((f) => f.canvas),
		at
	).toEqual([]);
	let k = 0;
	if (before) while (k < frames.length && same(frames[k], before) && !same(frames[k], final)) k++;
	if (resized)
		expect(
			frames.filter((f) => atFinalSize(f) && !same(f, final)),
			`${at}: the old layout painted at the new size`
		).toEqual([]);
	expect(
		frames.slice(k).every((f) => same(f, final)),
		at
	).toBe(true);
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
				// A button half scrolled out of its own open panel sits under that card's padding: the
				// panel scrolls to it, and no other card is in the way.
				const ownEdge = top === card && card.scrollHeight > card.clientHeight;
				return top && (button.contains(top) || ownEdge)
					? []
					: [`card ${i}: "${button.textContent?.trim()}" is covered`];
			})
		)
	);
	return [...out, ...blocked];
}

for (const [w, h] of TARGETS) {
	for (const font of [undefined, 'DejaVu Sans']) {
		test(`${w}x${h}${font ? ` in ${font}` : ''}: cards float, and no card, open or closed, covers a city or another card's buttons`, async ({
			page
		}) => {
			if (font) {
				await requireFont(page, font);
				await forceFont(page, font);
			}
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
}

/**
 * Each chart's caption, cut or not, whether its controls stay inside it, and pairs of axis labels
 * that touch (a narrow chart could run "Day" into the last day's number).
 */
async function chartRow(page: Page, figures = '.charts figure') {
	return page.locator(figures).evaluateAll((figs) =>
		figs.flatMap((f, i) => {
			const out: string[] = [];
			const box = f.getBoundingClientRect();
			if (box.width === 0) return out;
			const text = f.querySelector('.chart-caption .text') as HTMLElement | null;
			if (text && text.scrollWidth > text.clientWidth + 0.5)
				out.push(`chart ${i}: caption "${text.textContent}" is cut`);
			// One line of text, in whatever font: the caption is as tall as its text, never taller.
			const cap = f.querySelector('.chart-caption')?.getBoundingClientRect();
			const line = text?.getBoundingClientRect();
			if (cap && line && line.height > 0 && Math.abs(cap.height - line.height) > 0.5)
				out.push(`chart ${i}: caption is ${cap.height}px for a ${line.height}px line`);
			const controls = f.querySelector('.chart-caption .switch')?.getBoundingClientRect();
			if (controls && (controls.left < box.left - 0.5 || controls.right > box.right + 0.5))
				out.push(`chart ${i}: its switch leaves the chart`);
			const labels = [...f.querySelectorAll(':scope > svg > text:not(.measure)')]
				.map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() }))
				.filter(({ r }) => r.width > 0);
			labels.forEach((a, k) =>
				labels.slice(k + 1).forEach((b) => {
					if (a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom)
						out.push(`chart ${i}: "${a.t}" touches "${b.t}"`);
				})
			);
			return out;
		})
	);
}

/** How each city's "caught it" caption is worded: the full title, the long caption or the short one. */
async function stackCaptions(page: Page) {
	return page
		.locator('.charts figure', { has: page.getByRole('img', { name: /who has caught it/ }) })
		.locator('.chart-caption .text')
		.evaluateAll((els) =>
			els.map((e) => {
				const t = e.textContent ?? '';
				return t.includes('so far') ? 'title' : /^\S+: /.test(t) ? 'short' : 'long';
			})
		);
}

for (const [w, h] of TARGETS) {
	test(`${w}x${h}: with the lasting harm chart, the cards float and every chart caption and axis fits`, async ({
		page
	}) => {
		await open(page, w, h);
		for (const disease of ['covid19', 'smallpox']) {
			await page.selectOption('select', disease);
			await settle(page);
			expect(await docked(page), disease).toBe(0);
			expect(await covers(page), disease).toEqual([]);
			const harm = page.locator('.charts figure', { has: page.getByRole('img', { name: /lasting harm/ }) });
			await expect(harm, disease).toHaveCount(1);
			expect(await chartRow(page), disease).toEqual([]);
			// The cities' stacks shorten together, so they read alike.
			expect(new Set(await stackCaptions(page)).size, disease).toBe(1);
		}
		// Rubella counts babies only: a babies chart with no switch.
		await page.selectOption('select', 'rubella');
		await settle(page);
		expect(await docked(page), 'rubella').toBe(0);
		await expect(page.getByRole('img', { name: /Babies harmed/ })).toHaveCount(1);
		await expect(page.locator('.charts .switch')).toHaveCount(0);
		expect(await chartRow(page), 'rubella').toEqual([]);
		await page.selectOption('select', 'smallpox');
		await settle(page);
		// Smallpox counts babies: the switch shows them on their own axis, and keeps the layout.
		const people = page.getByRole('button', { name: 'People', exact: true });
		const babies = page.getByRole('button', { name: 'Babies', exact: true });
		await expect(people).toHaveAttribute('aria-pressed', 'true');
		const before = await probe(page);
		await babies.click();
		await expect(babies).toHaveAttribute('aria-pressed', 'true');
		await expect(people).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByRole('img', { name: /Babies harmed/ })).toHaveCount(1);
		await settle(page);
		const after = await probe(page);
		expect(after.scale).toBeCloseTo(before.scale, 9);
		expect(await docked(page)).toBe(0);
		expect(await chartRow(page)).toEqual([]);
		// A disease with no babies line has no switch, and a new disease starts on People.
		await page.selectOption('select', 'covid19');
		await settle(page);
		await expect(babies).toHaveCount(0);
		await page.selectOption('select', 'smallpox');
		await settle(page);
		await expect(people).toHaveAttribute('aria-pressed', 'true');
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
		name: 'widen from narrow to 800 px, still docked for its height',
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
		name: 'between two floating sizes',
		sizes: [
			[1366, 768],
			[1400, 900]
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

// In the default font, and in DejaVu Sans, whose wider text changes where the bar and blurb wrap.
for (const font of [undefined, 'DejaVu Sans']) {
	for (const { name, sizes } of PATHS) {
		test(`${name} (${sizes.map((s) => s.join('x')).join(' → ')})${font ? ` in ${font}` : ''}: same layout as a fresh load, no wrong frame`, async ({
			page,
			browser
		}) => {
			if (font) await forceFont(page, font);
			await slowDown(page);
			const [w0, h0] = sizes[0];
			await open(page, w0, h0);
			if (font) await requireFont(page, font);
			for (const [w, h] of sizes.slice(1)) {
				const before = await probe(page);
				const from = await frameCount(page);
				await page.setViewportSize({ width: w, height: h });
				await settle(page);
				await expectStraightToFinal(page, from, `${w}x${h}`, before, true);
			}
			const [w, h] = sizes[sizes.length - 1];
			const fresh = await browser.newPage();
			if (font) await forceFont(fresh, font);
			await open(fresh, w, h);
			const want = await probe(fresh);
			const got = await probe(page);
			expect(got.docked).toBe(want.docked);
			expect(got.scale).toBeCloseTo(want.scale, 6);
			await fresh.close();
		});
	}
}

test('1280x720: switching to plague and back keeps the cards floating, with no wrong frame', async ({
	page
}) => {
	await slowDown(page);
	await open(page, 1280, 720);
	for (const disease of ['plague', 'measles']) {
		const before = await probe(page);
		const from = await frameCount(page);
		await page.selectOption('select', disease);
		await settle(page);
		expect(await docked(page), disease).toBe(0);
		await expectStraightToFinal(page, from, disease, before);
		expect(await covers(page), disease).toEqual([]);
	}
});

test('the first painted frame is already the final layout', async ({ page }) => {
	await slowDown(page);
	for (const [w, h] of [...TARGETS, [1280, 600] as const, [390, 844] as const]) {
		await open(page, w, h);
		await expectStraightToFinal(page, 0, `${w}x${h} load`);
	}
});

/** Lay the page out in `font`, as on a desktop whose system-ui font it is (DejaVu Sans on many Linux desktops). */
async function forceFont(page: Page, font: string) {
	await page.addInitScript((f) => {
		document.addEventListener('DOMContentLoaded', () => {
			const style = document.createElement('style');
			style.textContent = `* { font-family: '${f}', monospace !important; }`;
			document.head.append(style);
		});
	}, font);
}

/**
 * Skip the check where `font` isn't installed, which would check the fallback font instead; in CI,
 * where it always is (Playwright installs it with Chromium), fail rather than pass by skipping.
 */
async function requireFont(page: Page, font: string) {
	const installed = await page.evaluate((f) => {
		const ctx = document.createElement('canvas').getContext('2d')!;
		const width = (spec: string) => ((ctx.font = spec), ctx.measureText('Epidemic simulator 1347').width);
		return width(`13px '${f}', monospace`) !== width('13px monospace');
	}, font);
	if (process.env.CI) expect(installed, `${font} is installed`).toBe(true);
	test.skip(!installed, `${font} isn't installed here, so this would check another font`);
}

/** Whether the top bar is one row: nothing in it starts below its title. */
const barOneRow = (page: Page) =>
	page.locator('header.bar').evaluate((bar) => {
		const title = bar.querySelector('h1')!.getBoundingClientRect();
		return [...bar.children]
			.filter((c) => !c.matches('.measure, .full'))
			.every((c) => c.getBoundingClientRect().top < title.bottom);
	});

test('1280x720 in DejaVu Sans: every disease keeps the cards floating, its blurb at most 3 lines or one sentence', async ({
	page
}) => {
	await forceFont(page, 'DejaVu Sans');
	await open(page, 1280, 720);
	await requireFont(page, 'DejaVu Sans');
	// Its wider text still fits the bar on one row (the blurb's small flex basis), which leaves the map its height.
	expect(await barOneRow(page), 'the top bar is one row').toBe(true);
	const diseases = await page
		.locator('select option')
		.evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
	for (const disease of diseases) {
		await page.selectOption('select', disease);
		await settle(page);
		expect(await docked(page), disease).toBe(0);
		expect(new Set(await stackCaptions(page)).size, `${disease}: stack captions alike`).toBe(1);
		const lines = await page.locator('p.blurb:not(.measure)').evaluate((p) => {
			// Distinct line tops of the text shown (the screen-reader copy is clipped out of the layout).
			const range = document.createRange();
			range.selectNodeContents(p);
			const tops = [...range.getClientRects()]
				.filter((r) => r.width > 1 && r.height > 1)
				.map((r) => Math.round(r.top));
			return new Set(tops).size;
		});
		// A first sentence longer than 3 lines is shown whole, never cut (Ebola's, in this font).
		const overlong = await page.locator('p.blurb:not(.measure)').getAttribute('data-overlong');
		if (overlong)
			test.info().annotations.push({ type: 'overlong blurb', description: `${disease}: ${lines} lines` });
		else expect(lines, disease).toBeLessThanOrEqual(3);
	}
});

test('the blurb\'s "more" shows the whole text over the map, and Escape closes it', async ({ page }) => {
	await forceFont(page, 'DejaVu Sans');
	await open(page, 1280, 720);
	await requireFont(page, 'DejaVu Sans');
	await page.selectOption('select', 'plague');
	await settle(page);
	const before = await probe(page);
	const more = page.getByRole('button', { name: 'more' });
	await expect(more).toHaveAttribute('aria-expanded', 'false');
	await more.click();
	await expect(page.locator('#blurb-full')).toContainText('before antibiotics');
	await expect(page.getByRole('button', { name: 'less' })).toHaveAttribute('aria-expanded', 'true');
	await settle(page);
	const after = await probe(page);
	expect(after.stage).toEqual(before.stage);
	expect(after.scale).toBeCloseTo(before.scale, 9);
	await page.keyboard.press('Escape');
	await expect(page.locator('#blurb-full')).toHaveCount(0);
	await more.click();
	await page.mouse.click(5, 700);
	await expect(page.locator('#blurb-full')).toHaveCount(0);
});

for (const [from, to] of [
	[
		[1366, 768],
		[1400, 900]
	],
	[
		[1280, 720],
		[390, 844]
	]
] as const) {
	test(`the blurb's "more" overlay closes when the window goes from ${from.join('x')} to ${to.join('x')}`, async ({
		page
	}) => {
		await forceFont(page, 'DejaVu Sans');
		await open(page, from[0], from[1]);
		await requireFont(page, 'DejaVu Sans');
		await page.selectOption('select', 'plague');
		await settle(page);
		await page.getByRole('button', { name: 'more' }).click();
		await expect(page.locator('#blurb-full')).toHaveCount(1);
		await page.setViewportSize({ width: to[0], height: to[1] });
		await settle(page);
		await expect(page.locator('#blurb-full')).toHaveCount(0);
		// Nothing is left beyond the window's edge to scroll to.
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(to[0]);
	});
}

test('the lasting-harm details open from the keyboard, close on Escape, a click elsewhere and a resize', async ({
	page
}) => {
	await open(page, 1400, 900);
	await page.getByRole('button', { name: /\(8×\)/ }).click();
	const line = page.locator('section.card button.harm').first();
	await expect(line).toBeVisible({ timeout: 60_000 });
	await page.getByRole('button', { name: 'Paused' }).click();
	// Reached by Tab like any other control.
	await page.locator('body').focus();
	for (let k = 0; k < 200; k++) {
		await page.keyboard.press('Tab');
		if (await line.evaluate((el) => el === document.activeElement)) break;
	}
	await expect(line).toBeFocused();
	await expect(line).toHaveAttribute('aria-expanded', 'false');
	await page.keyboard.press('Enter');
	await expect(line).toHaveAttribute('aria-expanded', 'true');
	const id = await line.getAttribute('aria-controls');
	const detail = page.locator(`#${id}`);
	await expect(detail).toBeVisible();
	// Inside the window.
	const box = (await detail.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(1400);
	expect(box.y + box.height).toBeLessThanOrEqual(900);
	await page.keyboard.press('Escape');
	await expect(detail).toHaveCount(0);
	await expect(line).toHaveAttribute('aria-expanded', 'false');
	await expect(line).toBeFocused();
	// A tap opens it too, and a tap elsewhere closes it.
	await line.click();
	await expect(page.locator(`#${id}`)).toBeVisible();
	await page.mouse.click(5, 700);
	await expect(page.locator(`#${id}`)).toHaveCount(0);
	await line.click();
	await expect(page.locator(`#${id}`)).toBeVisible();
	await page.setViewportSize({ width: 1366, height: 768 });
	await expect(page.locator(`#${id}`)).toHaveCount(0);
});

test('the lasting-harm details stay open on a new height alone, follow their card when it moves, and only one is open', async ({
	page
}) => {
	await open(page, 1400, 900);
	await page.getByRole('button', { name: /\(8×\)/ }).click();
	const lines = page.locator('section.card button.harm');
	await expect(lines.nth(1)).toBeVisible({ timeout: 60_000 });
	await page.getByRole('button', { name: 'Paused' }).click();
	const first = lines.first();
	await first.click();
	const detail = page.locator(`#${await first.getAttribute('aria-controls')}`);
	await expect(detail).toBeVisible();
	// A phone's address bar showing or hiding changes only the height.
	await page.setViewportSize({ width: 1400, height: 820 });
	await settle(page);
	await expect(detail).toBeVisible();
	// From the keyboard, opening another card's details closes the first card's.
	const second = lines.nth(1);
	await second.focus();
	await page.keyboard.press('Enter');
	await expect(second).toHaveAttribute('aria-expanded', 'true');
	await expect(first).toHaveAttribute('aria-expanded', 'false');
	const shown = page.locator('section.card .detail');
	await expect(shown).toHaveCount(1);
	// A zoom moves the cards; the details move with their line rather than being left behind.
	const card = page.locator('section.card').nth(1);
	const before = (await card.boundingBox())!;
	await page.mouse.move(700, 450);
	await page.mouse.wheel(0, -600);
	await settle(page);
	const after = (await card.boundingBox())!;
	expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(5);
	await expect(shown).toHaveCount(1);
	const line = (await second.boundingBox())!;
	const box = (await shown.boundingBox())!;
	expect(Math.abs(box.x - line.x)).toBeLessThan(2);
	const below = Math.abs(box.y - (line.y + line.height + 4));
	const above = Math.abs(box.y + box.height - (line.y - 4));
	expect(Math.min(below, above)).toBeLessThan(2);
});

test('the blurb\'s "more" overlay stays open on a new height alone', async ({ page }) => {
	await forceFont(page, 'DejaVu Sans');
	await open(page, 1366, 768);
	await requireFont(page, 'DejaVu Sans');
	await page.selectOption('select', 'plague');
	await settle(page);
	await page.getByRole('button', { name: 'more' }).click();
	await expect(page.locator('#blurb-full')).toHaveCount(1);
	await page.setViewportSize({ width: 1366, height: 700 });
	await settle(page);
	await expect(page.locator('#blurb-full')).toHaveCount(1);
});

/** What an open harm details box covers that it must not: another card's header, or a city's disc. */
async function detailCovers(page: Page) {
	const stage = (await page.locator('canvas').first().boundingBox())!;
	const { discs } = await probe(page);
	return page.evaluate(
		({ discs, sx, sy }) => {
			const box = document.querySelector('section.card .detail');
			if (!box) return [];
			const b = box.getBoundingClientRect();
			const own = box.closest('section.card')!;
			const out: string[] = [];
			const mine = own.querySelector(':scope > header')!.getBoundingClientRect();
			if (
				b.left < mine.right - 0.5 &&
				b.right > mine.left + 0.5 &&
				b.top < mine.bottom - 0.5 &&
				b.bottom > mine.top + 0.5
			)
				out.push("covers its own card's header");
			document.querySelectorAll('section.card').forEach((card, i) => {
				if (card === own) return;
				const h = card.querySelector(':scope > header')!.getBoundingClientRect();
				if (
					b.left < h.right - 0.5 &&
					b.right > h.left + 0.5 &&
					b.top < h.bottom - 0.5 &&
					b.bottom > h.top + 0.5
				)
					out.push(`covers card ${i}'s header`);
			});
			discs.forEach((d, k) => {
				const cx = d.x + sx;
				const cy = d.y + sy;
				const nx = Math.min(Math.max(cx, b.left), b.right);
				const ny = Math.min(Math.max(cy, b.top), b.bottom);
				if (Math.hypot(nx - cx, ny - cy) < d.r - 0.5) out.push(`covers city ${k}`);
			});
			if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight)
				out.push('leaves the window');
			return out;
		},
		{ discs, sx: stage.x, sy: stage.y }
	);
}

/** Opens every lasting-harm and babies line in turn: each must open, announce it and cover nothing. */
async function everyLineOpens(page: Page, when: string) {
	let scrolled = 0;
	const lines = page.locator('section.card button.harm');
	await expect(lines.first()).toBeVisible({ timeout: 60_000 });
	for (let i = 0; i < (await lines.count()); i++) {
		const line = lines.nth(i);
		await line.focus();
		await page.keyboard.press('Enter');
		await settle(page);
		await expect(line, `line ${i} ${when}`).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('section.card .detail'), `line ${i} ${when}`).toBeVisible();
		expect(await detailCovers(page), `line ${i} ${when}`).toEqual([]);
		// The line that opened them stays in sight, so its focus ring shows where they came from.
		const hidden = await line.evaluate((el) => {
			const l = el.getBoundingClientRect();
			const b = document.querySelector('section.card .detail')!.getBoundingClientRect();
			return (
				b.left < l.right - 0.5 && b.right > l.left + 0.5 && b.top < l.bottom - 0.5 && b.bottom > l.top + 0.5
			);
		});
		expect(hidden, `line ${i} ${when} is under its details`).toBe(false);
		// Over their own card, they take the taller of the spaces below the line and above it.
		const side = await line.evaluate((el) => {
			const l = el.getBoundingClientRect();
			const b = document.querySelector('section.card .detail')!.getBoundingClientRect();
			const card = el.closest('section.card')!;
			const c = card.getBoundingClientRect();
			if (Math.abs(b.left - c.left) > 0.5 || Math.abs(b.width - c.width) > 0.5) return 'beside';
			const head = card.querySelector(':scope > header')!.getBoundingClientRect().bottom;
			const below = Math.min(c.bottom, innerHeight) - (l.bottom + 4);
			const above = l.top - 4 - Math.max(head, 0);
			if (Math.max(below, above) < 40) return 'whole';
			return b.top >= l.bottom === below >= above ? 'taller' : 'shorter';
		});
		expect(side, `line ${i} ${when}`).not.toBe('shorter');
		// Details that scroll inside take keyboard focus, so their scroll is reachable without a mouse.
		const box = page.locator('section.card .detail');
		if (await box.evaluate((el) => el.scrollHeight > el.clientHeight + 1)) {
			scrolled++;
			await expect(box, `line ${i} ${when} scrolls`).toHaveAttribute('tabindex', '0');
		}
		await page.keyboard.press('Escape');
		await expect(page.locator('section.card .detail')).toHaveCount(0);
	}
	return scrolled;
}

for (const [w, h] of TARGETS) {
	test(`${w}x${h}: every harm and babies line opens its details, on the start map and after New map`, async ({
		page
	}) => {
		await open(page, w, h);
		await page.selectOption('select', 'smallpox');
		await settle(page);
		await everyLineOpens(page, 'on the start map');
		await page.getByRole('button', { name: 'New map' }).focus();
		await page.keyboard.press('Enter');
		await settle(page);
		await everyLineOpens(page, 'after New map');
	});

	test(`${w}x${h}: the harm details never cover a city or another card's header, on open, zoom out and New map`, async ({
		page
	}) => {
		await open(page, w, h);
		await page.selectOption('select', 'smallpox');
		await settle(page);
		const lines = page.locator('section.card button.harm');
		await expect(lines.first()).toBeVisible({ timeout: 60_000 });
		for (let i = 0; i < (await lines.count()); i++) {
			const line = lines.nth(i);
			await line.click();
			await settle(page);
			expect(await detailCovers(page), `line ${i}, on open`).toEqual([]);
			// A click elsewhere closes the details, so the map moves by the wheel and the keyboard.
			const stage = (await page.locator('canvas').first().boundingBox())!;
			for (const step of ['wheel out', 'wheel out', 'Back to the start view', 'New map']) {
				if (step === 'wheel out') {
					await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
					await page.mouse.wheel(0, 400);
				} else {
					await page.getByRole('button', { name: step }).focus();
					await page.keyboard.press('Enter');
				}
				await settle(page);
				expect(await detailCovers(page), `line ${i}, after ${step}`).toEqual([]);
				// Closed for want of room (or by a new map's cards): open it again for the next step.
				if ((await page.locator('section.card .detail').count()) === 0 && (await lines.count()) > i) {
					await lines.nth(i).click();
					await settle(page);
					expect(await detailCovers(page), `line ${i}, reopened after ${step}`).toEqual([]);
				}
			}
			await page.keyboard.press('Escape');
		}
	});

	test(`${w}x${h}: cards float again when the window's height shrinks and grows back`, async ({ page }) => {
		await open(page, w, h);
		expect(await docked(page)).toBe(0);
		await page.setViewportSize({ width: w, height: 600 });
		await settle(page);
		await page.setViewportSize({ width: w, height: h });
		await settle(page);
		expect(await docked(page)).toBe(0);
	});
}

test('docking for a short window keeps focus on the line whose details were open, and the details only where they fit', async ({
	page
}) => {
	await open(page, 1280, 720);
	await page.getByRole('button', { name: /\(8×\)/ }).click();
	const line = page.locator('section.card button.harm').first();
	await expect(line).toBeVisible({ timeout: 60_000 });
	await page.getByRole('button', { name: 'Paused' }).click();
	await line.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('section.card .detail')).toHaveCount(1);
	await page.setViewportSize({ width: 1280, height: 600 });
	await settle(page);
	expect(await docked(page)).toBe(1);
	// The card is built again in the strip: focus follows to the same line, and the details open again,
	// over the card's own body if no place beside the line keeps clear of the headers and cities.
	const after = page.locator('section.card button.harm').first();
	await expect(after).toBeFocused();
	await expect(after).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('section.card .detail')).toBeVisible();
	expect(await detailCovers(page)).toEqual([]);
	// Back to a tall window: the cards float, and the details open again beside the framed card.
	await page.setViewportSize({ width: 1280, height: 720 });
	await settle(page);
	expect(await docked(page)).toBe(0);
	const floating = page.locator('section.card button.harm').first();
	await expect(floating).toBeFocused();
	await expect(floating).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('section.card .detail')).toBeVisible();
	expect(await detailCovers(page)).toEqual([]);
});

for (const which of ['harm', 'babies'] as const) {
	test(`the ${which} line's open details reopen after docking and floating again, with the page scrolled`, async ({
		page
	}) => {
		await open(page, 1280, 720);
		await page.selectOption('select', 'smallpox');
		await page.getByRole('button', { name: /\(8×\)/ }).click();
		const lines = () => page.locator('section.card').first().locator('button.harm');
		await expect(lines().nth(1)).toBeVisible({ timeout: 90_000 });
		await page.getByRole('button', { name: 'Paused' }).click();
		const n = which === 'harm' ? 0 : 1;
		await page.setViewportSize({ width: 1280, height: 600 });
		await settle(page);
		expect(await docked(page)).toBe(1);
		// Scrolled down a little, as reaching a lower line in the strip does.
		await page.evaluate(() => scrollTo(0, 30));
		await lines().nth(n).focus();
		expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
		await page.keyboard.press('Enter');
		await expect(lines().nth(n)).toHaveAttribute('aria-expanded', 'true');
		await page.setViewportSize({ width: 1280, height: 720 });
		await settle(page);
		expect(await docked(page)).toBe(0);
		await expect(lines().nth(n)).toBeFocused();
		await expect(lines().nth(n)).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('section.card .detail')).toBeVisible();
		expect(await detailCovers(page)).toEqual([]);
	});
}

for (const font of [undefined, 'DejaVu Sans']) {
	test(`docked${font ? ` in ${font}` : ''}, Tab goes from a line into its details when they scroll, and Page Down scrolls them`, async ({
		page
	}) => {
		if (font) await forceFont(page, font);
		await open(page, 1280, 720);
		if (font) await requireFont(page, font);
		await page.selectOption('select', 'smallpox');
		await page.getByRole('button', { name: /\(8×\)/ }).click();
		await expect(page.locator('section.card').first().locator('button.harm').nth(1)).toBeVisible({
			timeout: 90_000
		});
		await page.getByRole('button', { name: 'Paused' }).click();
		await page.setViewportSize({ width: 1280, height: 600 });
		await settle(page);
		expect(await docked(page)).toBe(1);
		// Taller details, so that in any font some find no clear spot and scroll inside their card (in
		// DejaVu Sans their own size fits beside the card here, and nothing would scroll).
		await page.addStyleTag({ content: 'section.card .detail .para { line-height: 2.5; }' });
		const lines = page.locator('section.card button.harm');
		const box = page.locator('section.card .detail');
		let tried = 0;
		for (let i = 0; i < (await lines.count()); i++) {
			await lines.nth(i).focus();
			await page.keyboard.press('Enter');
			await expect(box).toBeVisible();
			if (!(await box.evaluate((el) => el.scrollHeight > el.clientHeight + 1))) {
				await page.keyboard.press('Escape');
				continue;
			}
			tried++;
			// Details that scroll take focus, so the keyboard can scroll them.
			await expect(box, `line ${i}`).toHaveAttribute('tabindex', '0');
			await page.keyboard.press('Tab');
			await expect(box, `line ${i}`).toBeFocused();
			await page.keyboard.press('PageDown');
			await expect.poll(() => box.evaluate((el) => el.scrollTop), `line ${i}`).toBeGreaterThan(0);
			await expect(box, `line ${i} still open`).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(lines.nth(i)).toBeFocused();
		}
		expect(tried, 'some docked details scroll').toBeGreaterThan(0);
	});
}

for (const [from, key] of [
	['babies', 'Shift+Tab'],
	['harm', 'Tab']
] as const) {
	test(`docking keeps focus on a line reached by ${key} from the ${from} line, and so does floating again`, async ({
		page
	}) => {
		await open(page, 1280, 720);
		await page.selectOption('select', 'smallpox');
		await page.getByRole('button', { name: /\(8×\)/ }).click();
		const card = page.locator('section.card').first();
		const babies = card.locator('button.harm').nth(1);
		await expect(babies).toBeVisible({ timeout: 90_000 });
		await page.getByRole('button', { name: 'Paused' }).click();
		const lines = card.locator('button.harm');
		const target = from === 'babies' ? 0 : 1;
		await lines.nth(1 - target).focus();
		await page.keyboard.press(key);
		await expect(lines.nth(target)).toBeFocused();
		await page.setViewportSize({ width: 1280, height: 600 });
		await settle(page);
		expect(await docked(page)).toBe(1);
		await expect(page.locator('section.card').first().locator('button.harm').nth(target)).toBeFocused();
		await page.setViewportSize({ width: 1280, height: 720 });
		await settle(page);
		expect(await docked(page)).toBe(0);
		await expect(page.locator('section.card').first().locator('button.harm').nth(target)).toBeFocused();
	});
}

/*
 * The lockdown charts in an open card, with scrollbars drawn as on a desktop without overlay
 * scrollbars (headless Chromium hides them, which would hide a card that scrolls sideways): the
 * card never scrolls sideways, and its charts' captions and labels fit, floating and docked, in the
 * default font and in DejaVu Sans (CI's fallback, whose wider text first showed a caption's hidden
 * measuring copy widening the card); and on a 2x screen and at browser zooms that dock the cards
 * (150% of 1366x768, 120% of 1280x720, as CSS sizes with their device scale).
 */
const LOCK_PANEL_RUNS: { w: number; h: number; scale: number; font?: string }[] = [
	...[undefined, 'DejaVu Sans'].flatMap((font) =>
		[...TARGETS, [1280, 600] as const].map(([w, h]) => ({ w, h, scale: 1, font }))
	),
	...[undefined, 'DejaVu Sans'].flatMap((font) => [
		{ w: 1280, h: 720, scale: 2, font },
		{ w: 1920, h: 1080, scale: 2, font },
		{ w: 911, h: 512, scale: 1.5, font },
		{ w: 1067, h: 600, scale: 1.2, font }
	])
];
test.describe('with classic scrollbars', () => {
	for (const { w, h, scale, font } of LOCK_PANEL_RUNS) {
		test(`${w}x${h}${scale !== 1 ? ` at ${scale}x` : ''}${font ? ` in ${font}` : ''}: an open card with its lockdown charts never scrolls sideways, and the charts fit`, async ({
			playwright
		}, testInfo) => {
			// Its own browser: the shared one is launched with scrollbars hidden.
			const browser = await playwright.chromium.launch({
				...testInfo.project.use.launchOptions,
				ignoreDefaultArgs: ['--hide-scrollbars']
			});
			const page = await browser.newPage({
				baseURL: testInfo.project.use.baseURL,
				deviceScaleFactor: scale
			});
			if (font) await forceFont(page, font);
			await open(page, w, h);
			if (font) await requireFont(page, font);
			await page.selectOption('select', 'covid19');
			await settle(page);
			const card = page.locator('section.card').first();
			await card.getByRole('button', { name: /^Bring in/ }).click();
			await page.getByRole('button', { name: /\(8×\)/ }).click();
			await card.getByRole('button', { name: 'Lockdown' }).click();
			await expect(card.getByRole('button', { name: 'Lockdown' })).toHaveAttribute('aria-pressed', 'true');
			await expect(card.getByText(/^Locked down since day \d+$/)).toBeVisible();
			await page.waitForFunction(() => Number(/Day (\d+)/.exec(document.body.innerText)?.[1] ?? 0) >= 20);
			await page.getByRole('button', { name: 'Paused' }).click();
			await card.getByRole('button', { name: 'Health policy' }).click();
			await settle(page);
			await card.locator('.lockcharts').scrollIntoViewIfNeeded();
			const sideways = await card.evaluate((el) => {
				const scroller = [el, ...el.querySelectorAll('*')].filter((e) => {
					const o = getComputedStyle(e).overflowX;
					return o === 'auto' || o === 'scroll';
				});
				return scroller.filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.className);
			});
			expect(sideways).toEqual([]);
			expect(await chartRow(page, 'section.card .lockcharts figure')).toEqual([]);
			await expect(
				card.getByText(
					/since it began, (\d+%|under 1%) of key workers and (\d+%|under 1%) of those who stayed home at first/
				)
			).toBeVisible();
			await browser.close();
		});
	}
});

/*
 * Going backwards with Shift+Tab, each control in an open card, and the label line naming it, shows
 * in full below the card's sticky header (WCAG 2.4.11). Also with scrollbars drawn as on a desktop
 * without overlay scrollbars (headless Chromium hides them) and a locked city, whose lockdown
 * controls and charts make the panel longer.
 */
for (const classic of [false, true]) {
	for (const font of [undefined, 'DejaVu Sans']) {
		for (const [w, h] of TARGETS) {
			test(`${w}x${h}${font ? ` in ${font}` : ''}${classic ? ' with classic scrollbars and a lockdown' : ''}: every control in an open card, and its label line, shows in full below its sticky header when it takes focus going backwards (WCAG 2.4.11)`, async ({
				page: shared,
				playwright
			}, testInfo) => {
				// Classic scrollbars need their own browser: the shared one is launched with them hidden.
				const browser = classic
					? await playwright.chromium.launch({
							...testInfo.project.use.launchOptions,
							ignoreDefaultArgs: ['--hide-scrollbars']
						})
					: null;
				try {
					const page = browser ? await browser.newPage({ baseURL: testInfo.project.use.baseURL }) : shared;
					if (font) await forceFont(page, font);
					await open(page, w, h);
					if (font) await requireFont(page, font);
					const card = page.locator('section.card').first();
					await card.getByRole('button', { name: /^Bring in/ }).click();
					if (classic) {
						await card.getByRole('button', { name: 'Lockdown' }).click();
						await expect(card.getByText(/^Locked down since day \d+$/)).toBeVisible();
					}
					await card.getByRole('button', { name: 'Health policy' }).click();
					await settle(page);
					// Start at the card's last control and go back up through it with Shift+Tab.
					await card.evaluate((el) => {
						const all = el.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex="0"]');
						all[all.length - 1].focus();
					});
					const hidden: string[] = [];
					for (let step = 0; step < 160; step++) {
						const seen = await card.evaluate((el) => {
							const f = document.activeElement as HTMLElement | null;
							if (!f || !el.contains(f) || f.closest('header')) return null;
							const head = el.querySelector('header')!.getBoundingClientRect();
							const box = el.getBoundingClientRect();
							const bottom = box.top + el.clientTop + el.clientHeight;
							const name =
								f.getAttribute('aria-label') ||
								f.closest('label')?.firstElementChild?.textContent?.trim().slice(0, 40) ||
								f.textContent?.trim().slice(0, 40) ||
								f.tagName;
							const out: string[] = [];
							const r = f.getBoundingClientRect();
							if (r.top < head.bottom - 0.5 || r.bottom > bottom + 0.5)
								out.push(`${name}: top ${r.top.toFixed(1)} under the header to ${head.bottom.toFixed(1)}`);
							// A slider's label line sits above it, so it is checked on its own.
							const line = f.closest('label')?.firstElementChild;
							if (line && line !== f) {
								const l = line.getBoundingClientRect();
								if (l.top < head.bottom - 0.5)
									out.push(
										`${name}'s label "${line.textContent?.trim().slice(0, 40)}": top ${l.top.toFixed(1)} under the header to ${head.bottom.toFixed(1)}`
									);
							}
							return out.join('; ');
						});
						if (seen === null) break;
						if (seen) hidden.push(seen);
						await page.keyboard.press('Shift+Tab');
					}
					expect(hidden).toEqual([]);
				} finally {
					await browser?.close();
				}
			});
		}
	}
}

/*
 * Keyboard focus scrolls a slider's label line into view, but pressing the mouse on a slider, or
 * clicking its label's text, never moves the card under the pointer.
 */
test('pressing the mouse on a slider or its label text in an open card never scrolls the card', async ({
	page
}) => {
	await open(page, 1366, 768);
	const card = page.locator('section.card').first();
	await card.getByRole('button', { name: /^Bring in/ }).click();
	await card.getByRole('button', { name: 'Health policy' }).click();
	await settle(page);
	const sliders = card.locator('input[type="range"]');
	expect(await sliders.count()).toBeGreaterThan(1);
	// Scroll so a slider sits just above the card's bottom with its explanation cut off below it.
	const placeSecond = () =>
		card.evaluate((el) => {
			const input = el.querySelectorAll<HTMLInputElement>('input[type="range"]')[1];
			const box = el.getBoundingClientRect();
			const bottom = box.top + el.clientTop + el.clientHeight;
			el.scrollTop += input.getBoundingClientRect().bottom - (bottom - 4);
			const small = input.closest('label')!.querySelector('small')!.getBoundingClientRect();
			return { scrollTop: el.scrollTop, cut: small.bottom > bottom + 1 };
		});
	for (const target of ['slider', 'label text'] as const) {
		const before = await placeSecond();
		expect(before.cut, target).toBe(true);
		const hit =
			target === 'slider'
				? await sliders.nth(1).boundingBox()
				: await sliders.nth(1).locator('xpath=ancestor::label/*[1]').boundingBox();
		await page.mouse.move(hit!.x + 4, hit!.y + hit!.height / 2);
		await page.mouse.down();
		await page.waitForTimeout(100);
		expect(await card.evaluate((el) => el.scrollTop), `${target}, pressed`).toBe(before.scrollTop);
		await page.mouse.up();
		await page.waitForTimeout(100);
		expect(await card.evaluate((el) => el.scrollTop), `${target}, released`).toBe(before.scrollTop);
	}
});

test('a lockdown asked for while paused shows on the card at once, and lifts on Restart', async ({
	page
}) => {
	await open(page, 1280, 720);
	const card = page.locator('section.card').first();
	const lockdown = card.getByRole('button', { name: 'Lockdown' });
	await page.getByRole('button', { name: 'Paused' }).click();
	await expect(card.getByText('No lockdown')).toBeVisible();
	await lockdown.click();
	await expect(lockdown).toHaveAttribute('aria-pressed', 'true');
	await expect(card.getByText(/^Locked down since day \d+$/)).toBeVisible();
	await page.getByRole('button', { name: 'Restart' }).click();
	await expect(lockdown).toHaveAttribute('aria-pressed', 'false');
	await expect(card.getByText('No lockdown')).toBeVisible();
});
