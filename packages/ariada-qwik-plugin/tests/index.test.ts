// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ariadaQwik, scanQwikOutput } from '../src/index.js';

describe('@ariada-org/qwik-plugin', () => {
  it('creates a Vite plugin with Qwik defaults', () => {
    expect(ariadaQwik().name).toBe('@ariada-org/vite-plugin');
  });

  it('scans Qwik dist output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-qwik-'));
    try {
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'dist', 'index.html'), '<input name="email">', 'utf8');
      const report = await scanQwikOutput(root);
      expect(report.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
