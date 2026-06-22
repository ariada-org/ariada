// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { ariadaRollup, scanBundle, type HtmlScanner } from '../src/index.js';

const scanner: HtmlScanner = ({ filePath }) => ({
  filePath,
  findings: [{ filePath, ruleId: 'image-alt', severity: 'serious', message: 'Image needs text.' }],
});

describe('@ariada-org/rollup-plugin', () => {
  it('scans HTML assets from a Rollup bundle', async () => {
    const results = await scanBundle({ 'index.html': { type: 'asset', fileName: 'index.html', source: '<img>' } }, scanner);

    expect(results[0]?.findings[0]?.ruleId).toBe('image-alt');
  });

  it('reports findings through the Rollup warning channel', async () => {
    const warnings: string[] = [];
    const plugin = ariadaRollup({ scanner, failOn: false }) as unknown as {
      writeBundle: (this: { warn: (message: string) => void }, options: { dir: string }, bundle: Record<string, { fileName: string; type: string; source: string }>) => Promise<void>;
    };

    await plugin.writeBundle.call({ warn: (message) => warnings.push(message) }, { dir: '.' }, {
      'bad.html': { type: 'asset', fileName: 'bad.html', source: '<img>' },
    });

    expect(warnings[0]).toContain('image-alt');
  });
});
