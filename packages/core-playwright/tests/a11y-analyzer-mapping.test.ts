// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { mapAxeResults } from '../src/a11y-analyzer.js';

const node = { target: ['span.badge'], html: '<span class="badge">3</span>' };

describe('mapAxeResults', () => {
  it('maps axe violations to findings that are not flagged needs-review', () => {
    const findings = mapAxeResults(
      {
        violations: [
          { id: 'nested-interactive', impact: 'serious', tags: ['wcag2a', 'wcag412'], nodes: [node] },
        ],
        incomplete: [],
      },
      'scan-1',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('nested-interactive');
    expect(findings[0]?.needsReview ?? false).toBe(false);
  });

  it('surfaces axe incomplete items as findings flagged needs-review (recovers dropped contrast)', () => {
    const findings = mapAxeResults(
      {
        violations: [],
        incomplete: [
          { id: 'color-contrast', impact: 'serious', tags: ['wcag2aa', 'wcag143'], nodes: [node] },
        ],
      },
      'scan-1',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('color-contrast');
    expect(findings[0]?.needsReview).toBe(true);
    expect(findings[0]?.severity).toBe('serious');
  });

  it('emits both buckets in one pass, tagging only the incomplete ones', () => {
    const findings = mapAxeResults(
      {
        violations: [{ id: 'image-alt', impact: 'critical', tags: ['wcag2a'], nodes: [node] }],
        incomplete: [{ id: 'link-in-text-block', impact: 'serious', tags: ['wcag2a'], nodes: [node] }],
      },
      'scan-1',
    );
    expect(findings).toHaveLength(2);
    const byRule = Object.fromEntries(findings.map((f) => [f.ruleId, f.needsReview ?? false]));
    expect(byRule['image-alt']).toBe(false);
    expect(byRule['link-in-text-block']).toBe(true);
  });
});
