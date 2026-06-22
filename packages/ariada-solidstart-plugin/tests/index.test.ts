// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ariadaSolidStart, scanSolidStartOutput } from '../src/index.js';

describe('@ariada-org/solidstart-plugin', () => {
  it('creates a Vite plugin with SolidStart defaults', () => {
    expect(ariadaSolidStart().name).toBe('@ariada-org/vite-plugin');
  });

  it('scans SolidStart output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-solidstart-'));
    try {
      await mkdir(join(root, '.output', 'public'), { recursive: true });
      await writeFile(join(root, '.output', 'public', 'index.html'), '<input name="email">', 'utf8');
      const report = await scanSolidStartOutput(root);
      expect(report.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
