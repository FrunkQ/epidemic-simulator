import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		// Hard rules from docs/ARCHITECTURE.md section 1: the engine is plain TypeScript
		// and all randomness goes through the seeded RNG.
		files: ['src/lib/sim/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: ['svelte', 'svelte/*', '$app/*', '@sveltejs/*'] }
			],
			'no-restricted-properties': [
				'error',
				{ object: 'Math', property: 'random', message: 'Use the seeded Rng in rng.ts.' }
			],
			'no-restricted-globals': ['error', 'window', 'document', 'requestAnimationFrame']
		}
	},
	{ ignores: ['build/', '.svelte-kit/', 'node_modules/'] }
);
