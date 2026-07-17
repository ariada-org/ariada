// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { extractJsxTags, transformWithAriada } from '../src/index.js';

describe('@ariada-org/swc-plugin', () => {
  it('extracts static JSX tags for the shared scanner', () => {
    expect(extractJsxTags('const view = <main><img /></main>;')).toBe('<main><img>');
  });

  it('wraps an SWC transform and exposes Ariada findings', () => {
    const result = transformWithAriada('const view = <img />;', {
      failOn: false,
      transformSync: (code) => ({ code }),
      scanner: ({ markup }) => [{ ruleId: 'image-alt', severity: 'serious', message: markup }],
    });

    expect(result.ariadaFindings[0]?.message).toBe('<img>');
  });
});
