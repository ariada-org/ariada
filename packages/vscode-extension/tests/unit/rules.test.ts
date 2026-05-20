// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { buildCitation, getRule, listRules, meetsThreshold } from '../../src/rules.js';

describe('rules — listRules', () => {
  it('ships the v0.1 baseline rule set', () => {
    const rules = listRules();
    expect(rules.length).toBeGreaterThanOrEqual(8);
    const ids = rules.map((r) => r.id);
    expect(ids).toContain('wcag-22-1-1-1-image-alt');
    expect(ids).toContain('wcag-22-1-3-1-form-label');
    expect(ids).toContain('wcag-22-1-3-1-heading-order');
    expect(ids).toContain('wcag-22-3-3-2-input-name');
    expect(ids).toContain('wcag-22-4-1-2-button-name');
    expect(ids).toContain('eaa-language-of-page');
  });

  it('every rule has a WCAG SC, an EN 301 549 reference, and an https help URL', () => {
    for (const rule of listRules()) {
      expect(rule.wcagSc).toMatch(/^\d/);
      expect(rule.en301549).toMatch(/^\d/);
      expect(rule.helpUrl.startsWith('https://')).toBe(true);
    }
  });
});

describe('rules — getRule', () => {
  it('returns the rule by id', () => {
    const rule = getRule('wcag-22-1-1-1-image-alt');
    expect(rule).toBeTruthy();
    expect(rule?.severity).toBe('critical');
  });

  it('returns undefined for unknown id', () => {
    expect(getRule('does-not-exist')).toBeUndefined();
  });
});

describe('rules — meetsThreshold', () => {
  it('critical passes every threshold', () => {
    expect(meetsThreshold('critical', 'minor')).toBe(true);
    expect(meetsThreshold('critical', 'critical')).toBe(true);
  });

  it('minor only passes the minor threshold', () => {
    expect(meetsThreshold('minor', 'minor')).toBe(true);
    expect(meetsThreshold('minor', 'moderate')).toBe(false);
  });
});

describe('rules — buildCitation', () => {
  it('formats WCAG + EN 301 549 citation', () => {
    const rule = getRule('wcag-22-1-1-1-image-alt');
    expect(rule).toBeTruthy();
    const citation = buildCitation(rule!);
    expect(citation).toBe('WCAG 1.1.1 Non-text Content; EN 301 549 §9.1.1.1');
  });
});
