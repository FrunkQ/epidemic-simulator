import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Static site: works on Cloudflare Pages or any static host.
			adapter: adapter()
		})
	],
	test: {
		environment: 'node',
		testTimeout: 120_000,
		// The step-time test runs on its own, after every other file in the run (or shard) has
		// finished, so other files running at once can't slow it (11 Oct).
		projects: [
			{
				extends: true,
				test: { name: 'unit', include: ['tests/**/*.test.ts'], exclude: ['tests/sim/speed.test.ts'] }
			},
			{
				extends: true,
				test: { name: 'speed', include: ['tests/sim/speed.test.ts'], sequence: { groupOrder: 1 } }
			}
		]
	}
});
