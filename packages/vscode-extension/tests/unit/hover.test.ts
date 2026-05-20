// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { buildClipboardCitation, buildHoverMarkdown } from '../../src/hover.js';

describe('hover — buildHoverMarkdown', () => {
  it('returns markdown with rule id, severity, WCAG and EN 301 549', () => {
    const md = buildHoverMarkdown('wcag-22-1-1-1-image-alt');
    expect(md).toBeTruthy();
    expect(md).toContain('wcag-22-1-1-1-image-alt');
    expect(md).toContain('critical');
    expect(md).toContain('WCAG 2.2');
    expect(md).toContain('EN 301 549');
    expect(md).toContain('https://');
  });

  it('returns undefined for unknown rule id', () => {
    expect(buildHoverMarkdown('does-not-exist')).toBeUndefined();
  });
});

describe('hover — buildClipboardCitation', () => {
  it('returns the citation string', () => {
    expect(buildClipboardCitation('wcag-22-1-1-1-image-alt')).toBe(
      'WCAG 1.1.1 Non-text Content; EN 301 549 §9.1.1.1',
    );
  });

  it('returns undefined for unknown rule id', () => {
    expect(buildClipboardCitation('unknown')).toBeUndefined();
  });
});
