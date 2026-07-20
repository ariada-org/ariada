// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { ariadaPostcss } from '../src/index.js';

describe('@ariada-org/postcss-plugin', () => {
  it('emits PostCSS warnings from the Ariada CSS scanner', async () => {
    const result = await postcss([
      ariadaPostcss({
        scanner: () => [{ ruleId: 'focus-visible', severity: 'moderate', message: 'Focus state is not visible.' }],
      }),
    ]).process('button:focus { outline: none; }', { from: 'fixture.css' });

    expect(result.warnings()[0]?.text).toContain('focus-visible');
  });
});
