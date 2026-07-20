// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { AriadaWebpackPlugin, scanAssets, type HtmlScanner } from '../src/index.js';

const scanner: HtmlScanner = ({ filePath }) => ({
  filePath,
  findings: [{ filePath, ruleId: 'form-field-name', severity: 'serious', message: 'Input needs a label.' }],
});

describe('@ariada-org/webpack-plugin', () => {
  it('scans HTML assets from a compilation', async () => {
    const results = await scanAssets({ 'index.html': { source: () => '<input>' } }, scanner);

    expect(results[0]?.findings[0]?.ruleId).toBe('form-field-name');
  });

  it('pushes build diagnostics into the Webpack compilation', async () => {
    let callback: ((compilation: { assets: Record<string, { source: () => string }>; warnings: Error[]; errors: Error[] }) => Promise<void>) | undefined;
    new AriadaWebpackPlugin({ scanner }).apply({
      hooks: {
        afterEmit: {
          tapPromise(_name, next) {
            callback = next;
          },
        },
      },
    });
    const compilation = { assets: { 'bad.html': { source: () => '<input>' } }, warnings: [], errors: [] };

    await callback?.(compilation);

    expect(compilation.errors[0]?.message).toContain('form-field-name');
  });
});
