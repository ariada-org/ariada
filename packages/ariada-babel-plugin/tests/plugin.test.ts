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

    expect(result?.metadata['ariadaFindings']).toEqual([
      { ruleId: 'image-alt', severity: 'serious', message: '<main><img>' },
    ]);
  });
});
