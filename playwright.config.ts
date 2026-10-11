import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// The browser checks (10) run against a build made with VITE_LAYOUT_PROBE=1 (npm run test:browser).
// Locally they use the Chromium that ships with this machine; CI installs Playwright's own, pinned
// with @playwright/test, so a runner image update can't change the browser.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';

export default defineConfig({
	testDir: 'tests/browser',
	fullyParallel: true,
	retries: 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		launchOptions: existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {}
	},
	webServer: {
		command: 'npx vite preview --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: false
	}
});
