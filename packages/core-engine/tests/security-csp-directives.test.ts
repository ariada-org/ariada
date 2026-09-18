// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The two unsafe-inline checks used to read the whole policy as one string, and
// both answers were wrong in ways that matter differently.
//
// The dangerous direction: a nonce anywhere in the policy counted as mitigation
// for unsafe-inline anywhere else. `script-src 'unsafe-inline'; style-src
// 'nonce-abc'` was judged safe, and it is not — a nonce in one directive does
// nothing for another.
//
// The noisy direction: inline style was reported at the severity of inline
// script. That is the difference between reading a page's colours and running
// code in it, and an operator meeting both at serious severity cannot tell
// which they have. Measured on this project's own site, where the policy allows
// inline style and nothing else, and the finding came back serious.

import { describe, expect, it } from 'vitest';

import type { ExtractedFeatures, FeatureSink, PropertySnapshot } from '../src/domain-contract.js';
import { securityDomain } from '../src/domains/security.js';

function findingsFor(csp: string) {
  const snap = {
    scanId: 'test',
    url: 'https://example.com/',
    timestamp: 0,
    html: '<html><body><p>a page</p></body></html>',
    headers: {
      'strict-transport-security': 'max-age=31536000',
      'content-security-policy': csp,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  } as unknown as PropertySnapshot;

  const docEntries = new Map<string, unknown>();
  const sink: FeatureSink = {
    set(elementKey: string, featureKey: string, value: unknown): void {
      if (elementKey === '') docEntries.set(featureKey, value);
    },
    setScoped(): void {
      /* not used here */
    },
  };
  securityDomain.extractors.perDocument!(snap, sink);
  const features: ExtractedFeatures = { byElement: new Map(), byDocument: docEntries };
  const findings = securityDomain.evaluate(features);
  return {
    script: findings.find((f) => f.ruleId === 'sec-csp-unsafe-inline-no-nonce'),
    style: findings.find((f) => f.ruleId === 'sec-csp-unsafe-inline-style'),
  };
}

describe('unsafe-inline is judged per directive', () => {
  it('inline script without a nonce is serious', () => {
    const { script, style } = findingsFor("default-src 'self'; script-src 'self' 'unsafe-inline'");
    expect(script?.severity).toBe('serious');
    expect(style).toBeUndefined();
  });

  it('inline style alone is reported apart, and not as serious', () => {
    const { script, style } = findingsFor("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    expect(script).toBeUndefined();
    expect(style?.severity).toBe('moderate');
  });

  it('a nonce in one directive does not excuse unsafe-inline in another', () => {
    // The case the old whole-string reading got wrong, and the one that hides a
    // real hole rather than inventing one.
    const { script } = findingsFor("script-src 'unsafe-inline'; style-src 'self' 'nonce-r4nd0m'");
    expect(script?.severity).toBe('serious');
  });

  it('a nonce in the same directive does excuse it', () => {
    const { script } = findingsFor("script-src 'self' 'unsafe-inline' 'nonce-r4nd0m'");
    expect(script).toBeUndefined();
  });

  it('a hash in the same directive excuses it too', () => {
    const { script } = findingsFor("script-src 'self' 'unsafe-inline' 'sha256-abc123='");
    expect(script).toBeUndefined();
  });

  it('falls back to default-src the way a browser does', () => {
    const { script, style } = findingsFor("default-src 'self' 'unsafe-inline'");
    expect(script?.severity).toBe('serious');
    expect(style?.severity).toBe('moderate');
  });

  it('a named directive overrides the fallback rather than adding to it', () => {
    const { script } = findingsFor("default-src 'unsafe-inline'; script-src 'self'");
    expect(script).toBeUndefined();
  });
});
