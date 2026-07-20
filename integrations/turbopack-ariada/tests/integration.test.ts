// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanNextOutput } from '../src/index.js';

describe('ariada-turbopack-integration', () => {
  it('scans exported Next HTML output through the Ariada runner', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-next-'));
    try {
      await mkdir(join(root, '.next', 'server', 'app'), { recursive: true });
      await writeFile(join(root, '.next', 'server', 'app', 'index.html'), '<input>', 'utf8');

      const results = await scanNextOutput({
        outputDir: join(root, '.next'),
        runner: ({ filePath }) => ({ filePath, findings: 1 }),
      });

      expect(results[0]?.findings).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
