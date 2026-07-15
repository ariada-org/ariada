// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ariadaRemix, scanRemixOutput } from '../src/index.js';

describe('@ariada-org/remix-plugin', () => {
  it('creates a Vite plugin with Remix defaults', () => {
    expect(ariadaRemix().name).toBe('@ariada-org/vite-plugin');
  });

  it('scans Remix client build output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-remix-'));
    try {
      await mkdir(join(root, 'build', 'client'), { recursive: true });
      await writeFile(join(root, 'build', 'client', 'index.html'), '<input name="email">', 'utf8');
      const report = await scanRemixOutput(root);
      expect(report.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
