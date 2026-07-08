// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { buildAriadaInvocation, inferExportKind, parseRecipeConfig, resolveWhimsicalTarget } from '../src/index.js';

describe('whimsical-ariada', () => {
  it('builds Ariada CLI args for an SVG export recipe', () => {
    const invocation = buildAriadaInvocation({
      exportPath: 'wireframes/onboarding.svg',
      reportPath: 'ariada-report.json',
    });

    expect(invocation.command).toBe('ariada');
    expect(invocation.args).toEqual([
      'scan',
      'wireframes/onboarding.svg',
      '--format',
      'json',
      '--output',
      'ariada-report.json',
      '--rules',
      'color-contrast,text-size',
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
        reportPath: './scan-evidence/ariada-report.json',
      }),
    );

    expect(recipe).toEqual({
      exportPath: './fixtures/wireframe-export.svg',
      format: 'svg',
      reportPath: './scan-evidence/ariada-report.json',
    });
  });

  it('rejects image-only exports because Ariada needs inspectable markup or a URL', () => {
    expect(() => inferExportKind('board.png')).toThrow('HTML file, SVG file, or published http(s) URL');
  });
});
