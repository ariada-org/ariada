// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import ariadaVuePress, {
  resolveVuePressOutputDir,
  runAriadaVuePressScan,
  type AriadaCommand,
} from '../src/index.js';

describe('vuepress-plugin-ariada', () => {
  it('resolves the VuePress generated output directory from app.dir.dest', () => {
    expect(resolveVuePressOutputDir({ dir: { dest: '/tmp/vuepress-dist' } })).toBe('/tmp/vuepress-dist');
  });

  it('runs Ariada CLI from the onGenerated hook against the built output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-vuepress-'));
    const dist = join(root, 'docs', '.vuepress', 'dist');
    const commands: AriadaCommand[] = [];
    try {
      await mkdir(dist, { recursive: true });
      await writeFile(join(dist, 'index.html'), '<main><input name="email"></main>', 'utf8');

      const plugin = ariadaVuePress({
        reportDir: join(root, 'scan-evidence'),
        failOnViolation: false,
        runner: async (command) => {
          commands.push(command);
          return { exitCode: 1, stdout: 'Ariada found one violation', stderr: '' };
        },
      });

      await plugin.onGenerated({ dir: { source: join(root, 'docs'), dest: dist } });

      expect(commands).toHaveLength(1);
      expect(commands[0]?.args).toContain('scan');
      expect(commands[0]?.args).toContain('--domains');
      expect(commands[0]?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails the build when Ariada returns violations and gating is enabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ariada-vuepress-gate-'));
    const dist = join(root, 'dist');
    try {
      await mkdir(dist, { recursive: true });
      await writeFile(join(dist, 'index.html'), '<main><input name="email"></main>', 'utf8');

      await expect(
        runAriadaVuePressScan(
          { projectRoot: root, outputDir: dist },
          {
            reportDir: 'scan-evidence',
            failOnViolation: true,
            runner: async () => ({ exitCode: 1, stdout: 'violation', stderr: '' }),
          },
        ),
      ).rejects.toThrow(/gate failed/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
