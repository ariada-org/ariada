// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Tests for merging the full rule-library findings (carried on the snapshot as
// `axeFindings`) into the accessibility domain's deterministic evaluate output.
//
// The snapshot rules (EAA + image-alt) detect a narrow, jurisdiction-scoped set.
// The full rule library run at capture time covers the broad WCAG surface
// (colour-contrast, link-name, label, aria-*). Both must appear in the final
// accessibility findings, with the snapshot rules deduplicated against the
// library findings so the same problem is not reported twice.

import { describe, expect, it } from 'vitest';

import type { PropertySnapshot } from '../src/domain-contract.js';
import { accessibilityDomain } from '../src/domains/accessibility.js';
import { createSharedWalker } from '../src/shared-walker.js';
import type { Finding } from '../src/types.js';

function makeSnap(
  overrides: Partial<PropertySnapshot> = {},
): PropertySnapshot {
  return {
    scanId: 'scan-axe-merge',
    url: 'http://test.local/',
    timestamp: 0,
    html: '<html lang="en"><body></body></html>',
    headers: {},
    cookies: [],
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    ...overrides,
  };
}

function axeFinding(over: Partial<Finding>): Finding {
  return {
    id: 'axe-id',
    scanId: 'scan-axe-merge',
    domain: 'accessibility',
    ruleId: 'color-contrast',
    severity: 'serious',
    element: { selector: 'p' },
    message: 'Elements must meet minimum colour contrast',
    confidence: 1,
    ...over,
  };
}

async function runDomain(snap: PropertySnapshot): Promise<Finding[]> {
  const walker = await createSharedWalker({ snapshot: snap, domains: [accessibilityDomain] });
  return accessibilityDomain.evaluate(walker.features);
}

describe('accessibility domain merges snapshot axeFindings', () => {
  it('surfaces colour-contrast from the library even when no snapshot rule fires', async () => {
    const snap = makeSnap({
      axeFindings: [axeFinding({ ruleId: 'color-contrast', element: { selector: 'p.lead' } })],
    });
    const findings = await runDomain(snap);
    const contrast = findings.filter((f) => f.ruleId === 'color-contrast');
    expect(contrast).toHaveLength(1);
    expect(contrast[0]?.domain).toBe('accessibility');
    expect(contrast[0]?.element.selector).toBe('p.lead');
  });

  it('surfaces many distinct library rule ids', async () => {
    const snap = makeSnap({
      axeFindings: [
        axeFinding({ ruleId: 'color-contrast', element: { selector: 'p' } }),
        axeFinding({ ruleId: 'link-name', severity: 'serious', element: { selector: 'a' } }),
        axeFinding({ ruleId: 'label', severity: 'critical', element: { selector: 'input' } }),
        axeFinding({ ruleId: 'button-name', severity: 'critical', element: { selector: 'button' } }),
      ],
    });
    const findings = await runDomain(snap);
    const ids = new Set(findings.map((f) => f.ruleId));
    expect(ids.has('color-contrast')).toBe(true);
    expect(ids.has('link-name')).toBe(true);
    expect(ids.has('label')).toBe(true);
    expect(ids.has('button-name')).toBe(true);
  });

  it('does not double-report image-alt: when the library reports image-alt, the snapshot fallback is suppressed', async () => {
    // The snapshot fallback uses an element-outline selector while the library
    // uses its own selector syntax for the same image — comparing selectors would
    // not collapse them. Suppressing the fallback when the library covers the rule
    // is what prevents the same image being reported twice.
    const snap = makeSnap({
      domOutline: [{ backendNodeId: 1, nodeName: 'IMG', selector: 'img:nth-of-type(1)', attributes: { src: 'x.jpg' } }],
      axeFindings: [axeFinding({ ruleId: 'image-alt', severity: 'critical', element: { selector: 'img[src="x.jpg"]' } })],
    });
    const findings = await runDomain(snap);
    const imageAlt = findings.filter((f) => f.ruleId === 'image-alt');
    expect(imageAlt).toHaveLength(1);
    // The one kept is the library finding (anchored to the live element).
    expect(imageAlt[0]?.element.selector).toBe('img[src="x.jpg"]');
  });

  it('uses the snapshot image-alt fallback when the library did not run', async () => {
    const snap = makeSnap({
      domOutline: [{ backendNodeId: 1, nodeName: 'IMG', selector: '#a', attributes: { src: 'x.jpg' } }],
      // No axeFindings → no library run → fallback must still catch the image.
    });
    const findings = await runDomain(snap);
    const imageAlt = findings.filter((f) => f.ruleId === 'image-alt');
    expect(imageAlt).toHaveLength(1);
    expect(imageAlt[0]?.element.selector).toBe('#a');
  });

  it('is a no-op when the snapshot carries no axeFindings', async () => {
    const snap = makeSnap();
    const findings = await runDomain(snap);
    expect(findings.filter((f) => f.ruleId === 'color-contrast')).toHaveLength(0);
  });

  it('library findings carry the accessibility domain id and stay deterministic', async () => {
    const snap = makeSnap({
      axeFindings: [axeFinding({ ruleId: 'aria-required-attr', element: { selector: '[role=checkbox]' } })],
    });
    const a = await runDomain(snap);
    const b = await runDomain(snap);
    expect(a.map((f) => f.ruleId).sort()).toEqual(b.map((f) => f.ruleId).sort());
    expect(a.every((f) => f.domain === 'accessibility')).toBe(true);
  });
});
