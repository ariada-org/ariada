// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  evaluateShape,
  exportPenpotSelection,
  type PenpotShape,
} from '../src/shape-adapter.js';

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../fixtures/penpot-selection.json'), 'utf8'),
) as PenpotShape[];

describe('Penpot shape adapter', () => {
  it('maps nested Penpot shapes into an Ariada-ready HTML export', () => {
    const surface = exportPenpotSelection(fixture);

    expect(surface.shapeCount).toBe(4);
    expect(surface.html).toContain('Ariada Penpot export fixture');
    expect(surface.html).toContain('Subscription renews automatically');
    expect(surface.html).toContain('<button');
  });

  it('flags a low-contrast text layer with a contrast preview verdict', () => {
    const text = fixture[0]?.children?.find((shape) => shape.id === 'text-low-contrast');
    expect(text).toBeDefined();

    const checks = evaluateShape(text as PenpotShape);
    expect(checks).toContainEqual(
      expect.objectContaining({
        ruleId: 'penpot-contrast-preview',
        status: 'fail',
        severity: 'serious',
      }),
    );
  });

  it('flags a small interactive target with a target-size preview verdict', () => {
    const button = fixture[0]?.children?.find((shape) => shape.id === 'button-small');
    expect(button).toBeDefined();

    const checks = evaluateShape(button as PenpotShape);
    expect(checks).toContainEqual(
      expect.objectContaining({
        ruleId: 'penpot-target-size-preview',
        status: 'fail',
        value: '18x18',
      }),
    );
  });

  it('keeps the contrast math deterministic for fixture assertions', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#b8bec8', '#ffffff')).toBeLessThan(2.1);
  });
});
