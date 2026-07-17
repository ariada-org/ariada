// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { onPostBuild, scanGatsbyOutput } from '../src/index.js';

describe('@ariada-org/gatsby-plugin', () => {
  it('scans Gatsby public output and writes a report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-gatsby-'));
    try {
      await mkdir(join(root, 'public'), { recursive: true });
      await writeFile(join(root, 'public', 'index.html'), '<input name="email">', 'utf8');
      const report = await scanGatsbyOutput(root, { failOn: false });
      const saved = JSON.parse(await readFile(join(root, 'ariada-gatsby-report.json'), 'utf8')) as {
        summary: { total: number };
      };
      expect(report.summary.total).toBe(1);
      expect(saved.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('implements the Gatsby onPostBuild lifecycle entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-gatsby-hook-'));
    try {
      await mkdir(join(root, 'public'), { recursive: true });
      await writeFile(join(root, 'public', 'index.html'), '<label for="q">Search</label><input id="q">', 'utf8');
      const messages: string[] = [];
      await onPostBuild({
        store: { getState: () => ({ program: { directory: root } }) },
        reporter: { info: (message) => messages.push(message) },
      });
      expect(messages[0]).toContain('0 issue');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
