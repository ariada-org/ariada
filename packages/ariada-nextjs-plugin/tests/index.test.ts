// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanNextOutput, withAriada } from '../src/index.js';

describe('@ariada-org/nextjs-plugin', () => {
  it('preserves an existing webpack hook while adding Ariada options', () => {
    const config = withAriada(
      {
        webpack(input: unknown) {
          return { input };
        },
      },
      { failOn: false },
    );

    expect(config.ariada.failOn).toBe(false);
    expect(config.webpack?.('next-config', {})).toEqual({ input: 'next-config' });
  });

  it('scans exported Next.js HTML output and writes a report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-next-'));
    try {
      await mkdir(join(root, 'out'), { recursive: true });
      await writeFile(join(root, 'out', 'index.html'), '<form><input name="email"></form>', 'utf8');

      const report = await scanNextOutput(root, { failOn: false });
      const saved = JSON.parse(await readFile(join(root, 'ariada-nextjs-report.json'), 'utf8')) as {
        summary: { total: number };
      };

      expect(report.summary.total).toBe(1);
      expect(saved.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
