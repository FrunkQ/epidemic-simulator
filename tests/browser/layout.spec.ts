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

/** Wait until 30 frames in a row drew the same layout and every card has its final size. */
async function settle(page: Page) {
	await page
		.waitForFunction(() => '__layoutLog' in window, null, { timeout: 10_000 })
		.catch(() => {
			throw new Error(
				'The page has no layout probe: build it with VITE_LAYOUT_PROBE=1 (npm run test:browser)'
			);
		});
	await page.waitForFunction(() => {
		const log = (window as unknown as { __layoutLog: Frame[] }).__layoutLog;
		if (log.length < 30) return false;
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

/**
 * Each chart's caption, cut or not, whether its controls stay inside it, and pairs of axis labels
 * that touch (a narrow chart could run "Day" into the last day's number).
 */
async function chartRow(page: Page) {
	return page.locator('.charts figure').evaluateAll((figs) =>
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
