// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import postcss from 'postcss';
import type { AcceptedPlugin } from 'postcss';
import { describe, expect, it } from 'vitest';


import { ariadaPostcss } from '../src/index.js';

describe('@ariada-org/postcss-plugin', () => {
  it('emits PostCSS warnings from the Ariada CSS scanner', async () => {
    const result = await postcss([
      // Through `unknown`, for the same reason as the plugin's own shape: it
      // types its handler against the minimal structure it uses rather than
      // importing PostCSS's types, which is what lets it work against any
      // PostCSS 8 without depending on one. Two structural types describing the
      // same handler without a shared declaration do not overlap for the
      // compiler, and widening the plugin's signature to satisfy a test would
      // trade that portability for convenience.
      ariadaPostcss({
        scanner: () => [{ ruleId: 'focus-visible', severity: 'moderate', message: 'Focus state is not visible.' }],
      }) as unknown as AcceptedPlugin,
    ]).process('button:focus { outline: none; }', { from: 'fixture.css' });

    expect(result.warnings()[0]?.text).toContain('focus-visible');
  });
});
