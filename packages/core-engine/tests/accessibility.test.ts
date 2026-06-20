// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// TDD tests for the accessibility domain module.
//
// Each describe block corresponds to one fixture rule from
// packages/ariada-test-fixtures/fixtures/domains/accessibility/<rule>/.
// The expected.json oracle is the source of truth for fail/pass expectations.
//
// These tests validate the domain module against its contract using synthetic
// PropertySnapshot inputs derived from the fixture HTML — no live browser,
// no axe-core run. Detection is pure HTML-string analysis (perDocument) and
// domOutline attribute inspection (perElement).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PropertySnapshot } from '../src/domain-contract.js';
import { accessibilityDomain } from '../src/domains/accessibility.js';
import { createSharedWalker } from '../src/shared-walker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(
  __dirname,
  '../../ariada-test-fixtures/fixtures/domains/accessibility',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadFixture(ruleDir: string): { html: string } {
  const html = readFileSync(join(FIXTURES_ROOT, ruleDir, `${ruleDir}.html`), 'utf8');
  return { html };
}

/**
 * Build a PropertySnapshot from raw HTML. The domOutline is empty unless
 * elements are supplied explicitly — this forces the domain to rely on
 * perDocument HTML-string analysis for most rules.
 */
function makeSnap(
  html: string,
  url = 'http://test.local/',
  domOutline: PropertySnapshot['domOutline'] = [],
): PropertySnapshot {
  return {
    scanId: 'scan-a11y-test',
    url,
    timestamp: 0,
    html,
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline,
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

/**
 * Run the accessibility domain over a snapshot and return the findings.
 */
async function runDomain(snap: PropertySnapshot): Promise<ReturnType<typeof accessibilityDomain.evaluate>> {
  const walker = await createSharedWalker({
    snapshot: snap,
    domains: [accessibilityDomain],
  });
  return accessibilityDomain.evaluate(walker.features);
}

// ---------------------------------------------------------------------------
// image-alt — existing rule, already implemented
// ---------------------------------------------------------------------------

describe('image-alt rule (perElement)', () => {
  it('fail-1: IMG with no alt attribute produces a finding', async () => {
    const snap = makeSnap('<html><body><img id="fail-1" src="x.jpg"></body></html>', 'http://t.test/', [
      { backendNodeId: 1, nodeName: 'IMG', selector: '#fail-1', attributes: { src: 'x.jpg' } },
    ]);
    const findings = await runDomain(snap);
    const ruleFindings = findings.filter((f) => f.ruleId === 'image-alt');
    expect(ruleFindings.length).toBeGreaterThanOrEqual(1);
    expect(ruleFindings[0]?.severity).toBe('serious');
  });

  it('fail-2: IMG with empty alt produces a finding', async () => {
    const snap = makeSnap('<html><body><img id="fail-2" src="x.jpg" alt=""></body></html>', 'http://t.test/', [
      { backendNodeId: 1, nodeName: 'IMG', selector: '#fail-2', attributes: { src: 'x.jpg', alt: '' } },
    ]);
    const findings = await runDomain(snap);
    expect(findings.filter((f) => f.ruleId === 'image-alt').length).toBeGreaterThanOrEqual(1);
  });

  it('pass-1: IMG with non-empty alt produces no image-alt finding', async () => {
    const snap = makeSnap('<html><body><img id="pass-1" src="x.jpg" alt="Logo"></body></html>', 'http://t.test/', [
      { backendNodeId: 1, nodeName: 'IMG', selector: '#pass-1', attributes: { src: 'x.jpg', alt: 'Logo' } },
    ]);
    const findings = await runDomain(snap);
    expect(findings.filter((f) => f.ruleId === 'image-alt')).toHaveLength(0);
  });

  it('image-alt finding has regulatory mapping with WCAG SC 1.1.1', async () => {
    const snap = makeSnap('<html><body><img src="x.jpg"></body></html>', 'http://t.test/', [
      { backendNodeId: 1, nodeName: 'IMG', selector: 'img', attributes: { src: 'x.jpg' } },
    ]);
    const findings = await runDomain(snap);
    const f = findings.find((fi) => fi.ruleId === 'image-alt');
    expect(f).toBeDefined();
    expect(f?.regulatoryMapping?.some((r) => r.code.includes('1.1.1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EAA rule discovery — domain must declare all EAA rule IDs in interactionFeatures
// ---------------------------------------------------------------------------

describe('EAA interaction features declared', () => {
  it('interactionFeatures array is defined and non-empty', () => {
    expect(accessibilityDomain.interactionFeatures).toBeDefined();
    expect((accessibilityDomain.interactionFeatures ?? []).length).toBeGreaterThan(0);
  });

  it('declares a11y:missing-alt as an interaction feature', () => {
    const keys = (accessibilityDomain.interactionFeatures ?? []).map((f) => f.key);
    expect(keys).toContain('a11y:missing-alt');
  });

  it('domain has WCAG regulatory refs', () => {
    expect(accessibilityDomain.regulatory).toBeDefined();
    expect((accessibilityDomain.regulatory ?? []).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture-based tests — load real fixture HTML and assert findings
// ---------------------------------------------------------------------------

// Helper: run domain against fixture HTML and collect findings by rule
async function fixtureFindings(ruleDir: string, url?: string): Promise<Map<string, ReturnType<typeof accessibilityDomain.evaluate>>> {
  const { html } = loadFixture(ruleDir);
  const snap = makeSnap(html, url ?? 'http://test.local/');
  const findings = await runDomain(snap);
  const byRule = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, []);
    byRule.get(f.ruleId)!.push(f);
  }
  return byRule;
}

// ---- audiovisual ----

describe('ariada/audiovisual/captions-track-has-src', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-audiovisual-captions-track-has-src');
    expect(byRule.has('ariada/audiovisual/captions-track-has-src')).toBe(true);
  });
  it('finding has serious severity', async () => {
    const byRule = await fixtureFindings('ariada-audiovisual-captions-track-has-src');
    const findings = byRule.get('ariada/audiovisual/captions-track-has-src') ?? [];
    expect(findings[0]?.severity).toBe('serious');
  });
});

describe('ariada/audiovisual/media-element-has-accessible-name', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-audiovisual-media-element-has-accessible-name');
    expect(byRule.has('ariada/audiovisual/media-element-has-accessible-name')).toBe(true);
  });
});

describe('ariada/audiovisual/track-has-valid-kind', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-audiovisual-track-has-valid-kind');
    expect(byRule.has('ariada/audiovisual/track-has-valid-kind')).toBe(true);
  });
});

describe('ariada/audiovisual/video-has-audio-description-track', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-audiovisual-video-has-audio-description-track');
    expect(byRule.has('ariada/audiovisual/video-has-audio-description-track')).toBe(true);
  });
});

describe('ariada/audiovisual/video-has-captions-track', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-audiovisual-video-has-captions-track');
    expect(byRule.has('ariada/audiovisual/video-has-captions-track')).toBe(true);
  });
});

// ---- banking ----

describe('ariada/banking/2fa-keyboard-accessible', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-2fa-keyboard-accessible');
    expect(byRule.has('ariada/banking/2fa-keyboard-accessible')).toBe(true);
  });
});

describe('ariada/banking/currency-format-readable', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-currency-format-readable');
    expect(byRule.has('ariada/banking/currency-format-readable')).toBe(true);
  });
});

describe('ariada/banking/date-format-locale', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-date-format-locale');
    expect(byRule.has('ariada/banking/date-format-locale')).toBe(true);
  });
});

describe('ariada/banking/iban-input-format', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-iban-input-format');
    expect(byRule.has('ariada/banking/iban-input-format')).toBe(true);
  });
});

describe('ariada/banking/lang-matches-locale', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-lang-matches-locale');
    expect(byRule.has('ariada/banking/lang-matches-locale')).toBe(true);
  });
});

describe('ariada/banking/locale-fallback', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-locale-fallback');
    expect(byRule.has('ariada/banking/locale-fallback')).toBe(true);
  });
});

describe('ariada/banking/login-error-not-blocking', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-login-error-not-blocking');
    expect(byRule.has('ariada/banking/login-error-not-blocking')).toBe(true);
  });
});

describe('ariada/banking/numeric-validation-error-locale', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-numeric-validation-error-locale');
    expect(byRule.has('ariada/banking/numeric-validation-error-locale')).toBe(true);
  });
});

describe('ariada/banking/session-timeout-warning', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-session-timeout-warning');
    expect(byRule.has('ariada/banking/session-timeout-warning')).toBe(true);
  });
});

describe('ariada/banking/transaction-amount-input', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-banking-transaction-amount-input');
    expect(byRule.has('ariada/banking/transaction-amount-input')).toBe(true);
  });
});

// ---- checkout ----

describe('ariada/checkout/autocomplete-personal-data', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-autocomplete-personal-data');
    expect(byRule.has('ariada/checkout/autocomplete-personal-data')).toBe(true);
  });
});

describe('ariada/checkout/cart-quantity-input-label', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-cart-quantity-input-label');
    expect(byRule.has('ariada/checkout/cart-quantity-input-label')).toBe(true);
  });
});

describe('ariada/checkout/cart-update-live-region', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-cart-update-live-region');
    expect(byRule.has('ariada/checkout/cart-update-live-region')).toBe(true);
  });
});

describe('ariada/checkout/discount-code-feedback', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-discount-code-feedback');
    expect(byRule.has('ariada/checkout/discount-code-feedback')).toBe(true);
  });
});

describe('ariada/checkout/error-identification', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-error-identification');
    expect(byRule.has('ariada/checkout/error-identification')).toBe(true);
  });
});

describe('ariada/checkout/form-label-association', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-form-label-association');
    expect(byRule.has('ariada/checkout/form-label-association')).toBe(true);
  });
});

describe('ariada/checkout/order-confirmation-focus', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-order-confirmation-focus');
    expect(byRule.has('ariada/checkout/order-confirmation-focus')).toBe(true);
  });
});

describe('ariada/checkout/payment-fieldset-grouping', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-payment-fieldset-grouping');
    expect(byRule.has('ariada/checkout/payment-fieldset-grouping')).toBe(true);
  });
});

describe('ariada/checkout/required-field-machine-readable', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-required-field-machine-readable');
    expect(byRule.has('ariada/checkout/required-field-machine-readable')).toBe(true);
  });
});

describe('ariada/checkout/step-keyboard-accessible', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-step-keyboard-accessible');
    expect(byRule.has('ariada/checkout/step-keyboard-accessible')).toBe(true);
  });
});

describe('ariada/checkout/submit-button-accessible-name', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-checkout-submit-button-accessible-name');
    expect(byRule.has('ariada/checkout/submit-button-accessible-name')).toBe(true);
  });
});

// ---- ebooks ----

describe('ariada/ebooks/audio-control-on-autoplay', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-ebooks-audio-control-on-autoplay');
    expect(byRule.has('ariada/ebooks/audio-control-on-autoplay')).toBe(true);
  });
});

describe('ariada/ebooks/no-positive-tabindex-in-reading', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-ebooks-no-positive-tabindex-in-reading');
    expect(byRule.has('ariada/ebooks/no-positive-tabindex-in-reading')).toBe(true);
  });
});

describe('ariada/ebooks/reading-content-has-lang', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-ebooks-reading-content-has-lang');
    expect(byRule.has('ariada/ebooks/reading-content-has-lang')).toBe(true);
  });
});

describe('ariada/ebooks/text-spacing-overridable', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-ebooks-text-spacing-overridable');
    expect(byRule.has('ariada/ebooks/text-spacing-overridable')).toBe(true);
  });
});

describe('ariada/ebooks/viewport-allows-zoom', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-ebooks-viewport-allows-zoom');
    expect(byRule.has('ariada/ebooks/viewport-allows-zoom')).toBe(true);
  });
});

// ---- statement ----

describe('ariada/statement/conformance-level-declared', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-conformance-level-declared');
    expect(byRule.has('ariada/statement/conformance-level-declared')).toBe(true);
  });
});

describe('ariada/statement/enforcement-procedure-link', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-enforcement-procedure-link');
    expect(byRule.has('ariada/statement/enforcement-procedure-link')).toBe(true);
  });
});

describe('ariada/statement/feedback-mechanism-present', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-feedback-mechanism-present');
    expect(byRule.has('ariada/statement/feedback-mechanism-present')).toBe(true);
  });
});

describe('ariada/statement/last-revision-date', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-last-revision-date');
    expect(byRule.has('ariada/statement/last-revision-date')).toBe(true);
  });
});

describe('ariada/statement/methodology-disclosed', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-methodology-disclosed');
    expect(byRule.has('ariada/statement/methodology-disclosed')).toBe(true);
  });
});

describe('ariada/statement/non-conformance-items-listed', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-non-conformance-items-listed');
    expect(byRule.has('ariada/statement/non-conformance-items-listed')).toBe(true);
  });
});

describe('ariada/statement/page-link-from-footer', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-page-link-from-footer');
    expect(byRule.has('ariada/statement/page-link-from-footer')).toBe(true);
  });
});

describe('ariada/statement/publication-date-present', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-publication-date-present');
    expect(byRule.has('ariada/statement/publication-date-present')).toBe(true);
  });
});

describe('ariada/statement/skip-link-from-every-page', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-skip-link-from-every-page');
    expect(byRule.has('ariada/statement/skip-link-from-every-page')).toBe(true);
  });
});

describe('ariada/statement/standard-reference', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-statement-standard-reference');
    expect(byRule.has('ariada/statement/standard-reference')).toBe(true);
  });
});

// ---- transport ----

describe('ariada/transport/booking-timeout-has-warning', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-transport-booking-timeout-has-warning');
    expect(byRule.has('ariada/transport/booking-timeout-has-warning')).toBe(true);
  });
});

describe('ariada/transport/fare-table-has-caption', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-transport-fare-table-has-caption');
    expect(byRule.has('ariada/transport/fare-table-has-caption')).toBe(true);
  });
});

describe('ariada/transport/live-status-has-live-region', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-transport-live-status-has-live-region');
    expect(byRule.has('ariada/transport/live-status-has-live-region')).toBe(true);
  });
});

describe('ariada/transport/seat-selection-has-accessible-name', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-transport-seat-selection-has-accessible-name');
    expect(byRule.has('ariada/transport/seat-selection-has-accessible-name')).toBe(true);
  });
});

describe('ariada/transport/timetable-has-header-cells', () => {
  it('fixture produces at least one finding for this rule', async () => {
    const byRule = await fixtureFindings('ariada-transport-timetable-has-header-cells');
    expect(byRule.has('ariada/transport/timetable-has-header-cells')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Clean-page guard — domain must not produce false positives on a minimal page
// ---------------------------------------------------------------------------

describe('clean page guard', () => {
  it('empty HTML produces no EAA findings (false-positive guard)', async () => {
    const snap = makeSnap(
      '<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><p>Hello</p></body></html>',
    );
    const findings = await runDomain(snap);
    // No EAA-specific findings on a page with no EAA-scoped elements
    const eaaFindings = findings.filter((f) => f.ruleId.startsWith('ariada/'));
    expect(eaaFindings).toHaveLength(0);
  });

  it('image with alt produces no image-alt finding', async () => {
    const snap = makeSnap(
      '<html><body><img src="x.jpg" alt="Descriptive text"></body></html>',
      'http://t.test/',
      [{ backendNodeId: 1, nodeName: 'IMG', selector: 'img', attributes: { src: 'x.jpg', alt: 'Descriptive text' } }],
    );
    const findings = await runDomain(snap);
    expect(findings.filter((f) => f.ruleId === 'image-alt')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Domain contract conformance
// ---------------------------------------------------------------------------

describe('DomainModule contract conformance', () => {
  it('domain has required fields: id, title, version, extractors, evaluate', () => {
    expect(accessibilityDomain.id).toBe('accessibility');
    expect(typeof accessibilityDomain.title).toBe('string');
    expect(typeof accessibilityDomain.version).toBe('string');
    expect(typeof accessibilityDomain.extractors).toBe('object');
    expect(typeof accessibilityDomain.evaluate).toBe('function');
  });

  it('evaluate is deterministic: same features produce same findings', async () => {
    const snap = makeSnap(
      '<html><body><img src="x.jpg"><img src="y.jpg" alt=""></body></html>',
      'http://t.test/',
      [
        { backendNodeId: 1, nodeName: 'IMG', selector: 'img:nth-child(1)', attributes: { src: 'x.jpg' } },
        { backendNodeId: 2, nodeName: 'IMG', selector: 'img:nth-child(2)', attributes: { src: 'y.jpg', alt: '' } },
      ],
    );
    const walker1 = await createSharedWalker({ snapshot: snap, domains: [accessibilityDomain] });
    const walker2 = await createSharedWalker({ snapshot: snap, domains: [accessibilityDomain] });

    const findings1 = accessibilityDomain.evaluate(walker1.features);
    const findings2 = accessibilityDomain.evaluate(walker2.features);

    expect(findings1.map((f) => f.id).sort()).toEqual(findings2.map((f) => f.id).sort());
  });

  it('every finding has a non-empty regulatoryMapping', async () => {
    const snap = makeSnap(
      '<html><body><img src="x.jpg"></body></html>',
      'http://t.test/',
      [{ backendNodeId: 1, nodeName: 'IMG', selector: 'img', attributes: { src: 'x.jpg' } }],
    );
    const findings = await runDomain(snap);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(
        (f.regulatoryMapping ?? []).length,
        `finding ${f.id} must have regulatoryMapping`,
      ).toBeGreaterThan(0);
    }
  });
});
