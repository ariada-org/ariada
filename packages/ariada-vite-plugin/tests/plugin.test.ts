// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import ariadaVite, { scanViteOutput } from '../src/index.js';

describe('@ariada-org/vite-plugin', () => {
  it('scans production output HTML', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-vite-'));
    try {
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'dist', 'index.html'), '<form><input name="email"></form>', 'utf8');

      const report = await scanViteOutput(join(root, 'dist'));

      expect(report.summary.total).toBe(1);
      expect(report.pages[0]?.findings[0]?.ruleId).toBe('form-field-name');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('writes a report and fails when build output breaches the threshold', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-vite-hook-'));
    try {
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'dist', 'index.html'), '<input name="search">', 'utf8');

      const plugin = ariadaVite({ reportFile: 'reports/ariada.json' });
      plugin.configResolved({ root, build: { outDir: 'dist' } });

      await expect(plugin.closeBundle()).rejects.toThrow(/build gate failed/);
      const json = JSON.parse(await readFile(join(root, 'dist', 'reports', 'ariada.json'), 'utf8')) as {
        summary: { total: number };
      };
      expect(json.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('can include transformIndexHtml dev HTML in the report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-vite-dev-'));
    try {
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'dist', 'index.html'), '<label for="q">Search</label><input id="q">', 'utf8');

      const plugin = ariadaVite({ failOn: false });
      plugin.configResolved({ root, build: { outDir: 'dist' } });
      await plugin.transformIndexHtml('<input name="email">');
      await plugin.closeBundle();

      const json = JSON.parse(await readFile(join(root, 'dist', 'ariada-vite-report.json'), 'utf8')) as {
        summary: { total: number };
      };
      expect(json.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
