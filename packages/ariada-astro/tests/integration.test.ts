// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import ariada, { scanAstroBuild } from '../src/index.js';

describe('@ariada-org/astro', () => {
  it('scans built HTML pages and reports findings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-astro-'));
    try {
      await mkdir(join(root, 'nested'), { recursive: true });
      await writeFile(join(root, 'index.html'), '<main><img src="/hero.png"></main>', 'utf8');
      await writeFile(join(root, 'nested', 'ok.html'), '<img alt="Logo" src="/logo.png">', 'utf8');

      const report = await scanAstroBuild(root);

      expect(report.pages).toHaveLength(2);
      expect(report.summary.total).toBe(1);
      expect(report.summary.serious).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('writes a report and fails the build hook when threshold is breached', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-astro-hook-'));
    try {
      await writeFile(join(root, 'index.html'), '<img src="/hero.png">', 'utf8');
      const integration = ariada({ outputFile: 'reports/ariada.json', textOutputFile: 'reports/ariada.txt' });

      await expect(integration.hooks['astro:build:done']({ dir: new URL(`file://${root}/`) })).rejects.toThrow(
        /build gate failed/,
      );

      const json = JSON.parse(await readFile(join(root, 'reports', 'ariada.json'), 'utf8')) as {
        summary: { total: number };
      };
      const text = await readFile(join(root, 'reports', 'ariada.txt'), 'utf8');
      expect(json.summary.total).toBe(1);
      expect(text).toContain('Total findings: 1');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
