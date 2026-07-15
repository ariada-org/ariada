// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { createAriadaParcelReporter } from '../src/Reporter.js';

describe('parcel-reporter-ariada', () => {
  it('reports Ariada findings on Parcel buildSuccess events', async () => {
    const messages: string[] = [];
    const reporter = createAriadaParcelReporter({
      scanner: ({ distDir }) => [{ filePath: `${distDir}/index.html`, ruleId: 'image-alt', severity: 'serious', message: 'Image needs text.' }],
    });

    await reporter.report(
      { type: 'buildSuccess', bundleGraph: { getBundles: () => [{ target: { distDir: 'dist' } }] } },
      { logger: { warn: (message) => messages.push(message) } },
    );

    expect(messages[0]).toContain('image-alt');
  });
});
