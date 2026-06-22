// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ariadaNuxtModule, scanNuxtOutput, type NuxtLike } from '../src/index.js';

describe('@ariada-org/nuxt-module', () => {
  it('registers the Nitro public assets hook', () => {
    const hooks: string[] = [];
    const nuxt: NuxtLike = {
      options: { rootDir: process.cwd() },
      hook(name) {
        hooks.push(name);
      },
    };

    ariadaNuxtModule().setup({}, nuxt);
    expect(hooks).toEqual(['nitro:build:public-assets']);
  });

  it('scans Nuxt generated public output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-nuxt-'));
    try {
      await mkdir(join(root, '.output', 'public'), { recursive: true });
      await writeFile(join(root, '.output', 'public', 'index.html'), '<input name="email">', 'utf8');

      const report = await scanNuxtOutput(root, { failOn: false });
      const saved = JSON.parse(await readFile(join(root, 'ariada-nuxt-report.json'), 'utf8')) as {
        summary: { total: number };
      };

      expect(report.summary.total).toBe(1);
      expect(saved.summary.total).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
