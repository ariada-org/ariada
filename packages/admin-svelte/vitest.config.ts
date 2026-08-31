import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// The Svelte plugin lets the suite import .svelte files directly and render
// them through `svelte/server`, so the component tests assert on real markup.
// No DOM environment is installed in this repo, so the tests are server-side
// renders (no mounting, no events); browser-level verification of these
// components belongs to the consuming app's Playwright suite.
export default defineConfig({
  plugins: [svelte({ compilerOptions: { dev: false } })],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
