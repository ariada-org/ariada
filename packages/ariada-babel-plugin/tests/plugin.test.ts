// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';

import ariadaBabel from '../src/index.js';

describe('@ariada-org/babel-plugin', () => {
  it('passes static JSX markup to the Ariada scanner and exposes findings', () => {
    const result = transformSync('const view = <main><img /></main>;', {
      filename: 'fixture.jsx',
      parserOpts: { plugins: ['jsx'] },
      plugins: [[ariadaBabel, { failOn: false, scanner: ({ markup }: { markup: string }) => [{ ruleId: 'image-alt', severity: 'serious', message: markup }] }]],
    });

    // Read through a named view of the metadata. The key is written by this
    // plugin, so Babel's own metadata type does not declare it and the compiler
    // is right to refuse the index — and `metadata` is optional besides. Both
    // are stated once here rather than silenced at the point of use.
    const metadata = result?.metadata as { ariadaFindings?: unknown } | undefined;
    expect(metadata?.ariadaFindings).toEqual([
      { ruleId: 'image-alt', severity: 'serious', message: '<main><img>' },
    ]);
  });
});
