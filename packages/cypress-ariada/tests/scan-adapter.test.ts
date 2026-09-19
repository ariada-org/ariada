// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { formatBlockingMessage, runAriadaScan } from '../src/scan-adapter.js';

// Directories this file asked for by name, so they can be taken away again.
// A test that names an output directory has to put it somewhere temporary:
// the previous version derived the name from the test's own description and
// wrote it into the package, where it stayed.
const createdDirs: string[] = [];
afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('runAriadaScan', () => {
  it('normalises CLI JSON output and counts blocking findings', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'ariada-cypress-test-'));
    createdDirs.push(outputDir);
    const result = await runAriadaScan(
      'https://example.test',
      { outputDir, severityThreshold: 'serious' },
      {
        runScan: async (_url, options) => {
          await mkdir(options.outputDir ?? outputDir, { recursive: true });
          await writeFile(
            join(options.outputDir ?? outputDir, 'scan.json'),
            JSON.stringify({
              summary: { total: 2, byImpact: { critical: 1, serious: 0, moderate: 1, minor: 0 } },
              report: {
                findings: {
                  a11y: [
                    {
                      ruleId: 'button-name',
                      severity: 'critical',
                      criterion: 'WCAG 4.1.2',
                      message: 'Button must have discernible text',
                      element: { selector: 'button' },
                    },
                    { ruleId: 'color-contrast', severity: 'moderate', message: 'Low contrast' },
                  ],
                },
              },
            }),
            'utf8',
          );
          return 1;
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.mode).toBe('ax-tree');
    expect(result.summary.total).toBe(2);
    expect(result.blockingCount).toBe(1);
    expect(result.message).toContain('button-name');
    expect(result.message).not.toContain('color-contrast');
  });

  it('reports DOM fallback mode for non-Chromium browser choices', async () => {
    const result = await runAriadaScan(
      'https://example.test',
      { browser: 'firefox' },
      {
        runScan: async (_url, options) => {
          await mkdir(options.outputDir ?? '.', { recursive: true });
          await writeFile(
            join(options.outputDir ?? '.', 'scan.json'),
            JSON.stringify({ summary: { total: 0, byImpact: {} }, report: { findings: [] } }),
            'utf8',
          );
          return 0;
        },
      },
    );

    expect(result.mode).toBe('dom-fallback');
    expect(result.blockingCount).toBe(0);
  });
});

describe('formatBlockingMessage', () => {
  it('surfaces WCAG context, selector, and rule id', () => {
    expect(
      formatBlockingMessage([
        {
          ruleId: 'button-name',
          severity: 'critical',
          criterion: 'WCAG 4.1.2',
          message: 'Button must have discernible text',
          element: { selector: '#buy' },
        },
      ]),
    ).toContain('button-name [critical] (WCAG 4.1.2) #buy');
  });
});
