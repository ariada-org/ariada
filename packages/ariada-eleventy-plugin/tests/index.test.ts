// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import ariadaEleventy, { scanEleventyOutput, type EleventyAfterEvent } from '../src/index.js';

describe('@ariada-org/eleventy-plugin', () => {
  it('scans Eleventy output and writes a report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-eleventy-'));
    try {
      await mkdir(join(root, '_site'), { recursive: true });
      await writeFile(join(root, '_site', 'index.html'), '<input name="email">', 'utf8');
      const report = await scanEleventyOutput(root, { failOn: false });
      const saved = JSON.parse(await readFile(join(root, 'ariada-eleventy-report.json'), 'utf8')) as {
        summary: { total: number };
      };
      expect(report.summary.total).toBe(1);
      expect(saved.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('registers the eleventy.after event', () => {
    const events: Array<(event: EleventyAfterEvent) => Promise<void>> = [];
    ariadaEleventy({
      on(_name, callback) {
        events.push(callback);
      },
    });
    expect(events).toHaveLength(1);
  });
});
