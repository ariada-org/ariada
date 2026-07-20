// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import ariadaDocusaurusPlugin, { scanDocusaurusOutput } from '../src/index.js';

describe('@ariada-org/docusaurus-plugin', () => {
  it('scans Docusaurus build output and writes a report', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'ariada-docusaurus-'));
    try {
      await writeFile(join(outDir, 'index.html'), '<input name="email">', 'utf8');
      const report = await scanDocusaurusOutput(outDir, { failOn: false });
      const saved = JSON.parse(await readFile(join(outDir, 'ariada-docusaurus-report.json'), 'utf8')) as {
        summary: { total: number };
      };
      expect(report.summary.total).toBe(1);
      expect(saved.summary.total).toBe(1);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it('implements the Docusaurus postBuild lifecycle', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'ariada-docusaurus-hook-'));
    try {
      await mkdir(join(outDir, 'docs'), { recursive: true });
      await writeFile(join(outDir, 'docs', 'index.html'), '<label for="q">Search</label><input id="q">', 'utf8');
      const plugin = ariadaDocusaurusPlugin({}, { failOn: false });
      await plugin.postBuild({ outDir, routesPaths: ['/docs'] });
      const saved = JSON.parse(await readFile(join(outDir, 'ariada-docusaurus-report.json'), 'utf8')) as {
        summary: { total: number };
      };
      expect(saved.summary.total).toBe(0);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
