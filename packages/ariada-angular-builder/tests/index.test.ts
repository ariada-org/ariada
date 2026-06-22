// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { addAriadaTarget, runAngularAriadaBuilder } from '../src/index.js';

describe('@ariada-org/angular-builder', () => {
  it('adds an ariada target to angular.json data', () => {
    const workspace = addAriadaTarget({ projects: { portal: { targets: {} } } }, 'portal');
    expect(workspace.projects['portal']?.targets?.['ariada']).toEqual({
      builder: '@ariada-org/angular-builder:scan',
      options: {
        outputPath: 'dist/portal',
        reportFile: 'ariada-angular-report.json',
        failOn: 'serious',
      },
    });
  });

  it('scans Angular dist output and writes a report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-angular-'));
    try {
      await mkdir(join(root, 'dist', 'portal'), { recursive: true });
      await writeFile(join(root, 'dist', 'portal', 'index.html'), '<input name="email">', 'utf8');

      const result = await runAngularAriadaBuilder({
        workspaceRoot: root,
        outputPath: 'dist/portal',
        failOn: false,
      });
      const saved = JSON.parse(await readFile(join(root, 'ariada-angular-report.json'), 'utf8')) as {
        summary: { total: number };
      };

      expect(result.success).toBe(true);
      expect(saved.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
