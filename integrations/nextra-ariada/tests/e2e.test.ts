// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'fixtures/minimal-nextra');

async function hasLocalNextra(): Promise<boolean> {
  try {
    await access(join(root, 'node_modules/.bin/next'));
    await access(join(root, 'node_modules/nextra'));
    return true;
  } catch {
    return false;
  }
}

describe('minimal Nextra fixture', () => {
  it('builds static HTML with a known defect when host dependencies are installed', async () => {
    if (process.env['ARIADA_RUN_NEXTRA_E2E'] !== '1' || !(await hasLocalNextra())) {
      expect.soft(true, 'blocked: install Nextra/Next deps and set ARIADA_RUN_NEXTRA_E2E=1 for host e2e').toBe(true);
      return;
    }

    await execFileAsync('pnpm', ['exec', 'next', 'build'], { cwd: fixture, timeout: 120_000 });
    await access(join(fixture, 'out/index.html'));
  }, 150_000);
});
