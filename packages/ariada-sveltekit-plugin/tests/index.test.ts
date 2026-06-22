// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ariadaSvelteKit, scanSvelteKitOutput } from '../src/index.js';

describe('@ariada-org/sveltekit-plugin', () => {
  it('creates a Vite plugin with SvelteKit defaults', () => {
    expect(ariadaSvelteKit().name).toBe('@ariada-org/vite-plugin');
  });

  it('scans SvelteKit build output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-sveltekit-'));
    try {
      await mkdir(join(root, 'build'), { recursive: true });
      await writeFile(join(root, 'build', 'index.html'), '<input name="email">', 'utf8');
      const report = await scanSvelteKitOutput(root);
      expect(report.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
