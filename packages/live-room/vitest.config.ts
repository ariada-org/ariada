// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// The Svelte plugin is here for one reason: the focus controller lives in a
// `.svelte.ts` file and uses runes, which are compiler syntax rather than
// library calls. Without the plugin the file is not valid TypeScript and the
// suite cannot import it at all.
//
// No DOM environment is installed in this repository, so the component itself
// is not mounted here. What is held is the controller, which is where the rules
// about not fighting the user live; the three-pane shell around it belongs to
// the consuming application's browser suite.
export default defineConfig({
  plugins: [svelte({ compilerOptions: { dev: false } })],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
