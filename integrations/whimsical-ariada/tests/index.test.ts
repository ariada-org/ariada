// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import {
  buildAriadaInvocation,
  inferExportKind,
  parseRecipeConfig,
  resolveWhimsicalTarget,
  runAriadaForWhimsical,
} from '../src/index.js';

describe('whimsical-ariada', () => {
  it('builds Ariada CLI args for a served SVG export recipe', () => {
    const invocation = buildAriadaInvocation({
      exportPath: 'wireframes/onboarding.svg',
      outputDir: 'ariada-output',
    }, 'ariada', 'http://127.0.0.1:4173/onboarding.svg');

    expect(invocation.command).toBe('ariada');
    expect(invocation.args).toEqual([
      'scan',
      'http://127.0.0.1:4173/onboarding.svg',
      '--format',
      'json',
      '--domains',
      'accessibility',
      '--output-dir',
      'ariada-output',
      '--allow-private',
    ]);
    expect(invocation.limitation).toContain('no first-party plugin SDK');
  });

  it('prefers a published board URL over a local export path', () => {
    expect(
      resolveWhimsicalTarget({
        exportPath: 'wireframe.svg',
        publishedUrl: 'https://whimsical.com/example-board',
      }),
    ).toEqual({ target: 'https://whimsical.com/example-board', format: 'url' });
  });

  it('parses a recipe config object', () => {
    const recipe = parseRecipeConfig(
      JSON.stringify({
        exportPath: './fixtures/wireframe-export.svg',
        format: 'svg',
        outputDir: './scan-evidence/ariada-output',
      }),
    );

    expect(recipe).toEqual({
      exportPath: './fixtures/wireframe-export.svg',
      format: 'svg',
      outputDir: './scan-evidence/ariada-output',
    });
  });

  it('rejects image-only exports because Ariada needs inspectable markup or a URL', () => {
    expect(() => inferExportKind('board.png')).toThrow('HTML file, SVG file, or published http(s) URL');
  });

  it('serves local exports and delegates execution to the shared Ariada CLI runner', async () => {
    const seen: string[] = [];
    const result = await runAriadaForWhimsical({ exportPath: 'fixtures/wireframe-export.svg' }, (invocation) => {
      seen.push(invocation.command, ...invocation.args);
      return { status: 0, stdout: '{"summary":{"total":0}}', stderr: invocation.limitation };
    });

    expect(seen[0]).toBe('ariada');
    expect(seen[1]).toBe('scan');
    expect(seen[2]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/wireframe-export\.svg$/);
    expect(seen).toContain('--allow-private');
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('design-determinable checks');
  });
});
