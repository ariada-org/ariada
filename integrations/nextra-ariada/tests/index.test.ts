// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanNextraExport, type CommandRunner } from '../src/cli.js';
import { buildAriadaCliArgs, withAriadaNextra } from '../src/index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })));
  tempDirs.length = 0;
});

async function fixtureProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'nextra-ariada-'));
  tempDirs.push(dir);
  await writeFile(join(dir, 'index.html'), '<!doctype html><title>Nextra fixture</title><img src="/missing.png">');
  return dir;
}

describe('withAriadaNextra', () => {
  it('marks the Nextra/Next config for static export without replacing caller settings', () => {
    const config = withAriadaNextra(
      { trailingSlash: true, images: { formats: ['image/webp'] } },
      { outputDir: 'reports/ariada', failOn: 'critical' },
    );

    expect(config.output).toBe('export');
    expect(config.images.unoptimized).toBe(true);
    expect(config.images.formats).toEqual(['image/webp']);
    expect(config.ariada.outputDir).toBe('reports/ariada');
    expect(config.ariada.failOn).toBe('critical');
    expect(config.trailingSlash).toBe(true);
  });
});

describe('buildAriadaCliArgs', () => {
  it('builds a shared @ariada-org/cli scan command for the served export URL', () => {
    expect(buildAriadaCliArgs('http://127.0.0.1:4100/', { outputDir: 'scan-evidence/ariada-output' })).toEqual([
      'scan',
      'http://127.0.0.1:4100/',
      '--domains',
      'accessibility',
      '--format',
      'both',
      '--output-dir',
      'scan-evidence/ariada-output',
      '--severity-threshold',
      'serious',
    ]);
  });
});

describe('scanNextraExport', () => {
  it('serves exported HTML and delegates the scan to the configured Ariada CLI', async () => {
    const projectRoot = await fixtureProject();
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args });
      return { exitCode: 1, stdout: 'image-alt [serious]', stderr: '' };
    };

    const result = await scanNextraExport(
      { projectRoot, exportDir: '.', outputDir: 'scan-evidence/ariada-output', cli: 'ariada-test' },
      runner,
    );

    expect(result.finalExitCode).toBe(1);
    expect(result.targetUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(calls[0]?.command).toBe('ariada-test');
    expect(calls[0]?.args).toContain(result.targetUrl);
    expect(calls[0]?.args).toContain('--domains');
    expect(await readFile(join(projectRoot, 'scan-evidence/ariada-output/command.exit'), 'utf8')).toBe('1\n');
  });

  it('allows advisory mode while preserving the raw CLI result in command.log', async () => {
    const projectRoot = await fixtureProject();
    const runner: CommandRunner = async () => ({ exitCode: 1, stdout: 'serious finding', stderr: '' });

    const result = await scanNextraExport({ projectRoot, exportDir: '.', noFail: true }, runner);

    expect(result.exitCode).toBe(1);
    expect(result.finalExitCode).toBe(0);
    expect(await readFile(join(projectRoot, 'ariada-output/command.exit'), 'utf8')).toBe('0\n');
  });
});
