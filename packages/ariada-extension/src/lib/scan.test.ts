// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { scanSnapshots } from './scan.js';
import { captureSnapshot } from './snapshot-capture.js';

function docFromHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('scanSnapshots', () => {
  it('runs the browser-available built-in domains over a captured snapshot', async () => {
    const doc = docFromHtml('<main><img src="a.png" /></main>');
    const snap = captureSnapshot(doc, { scanId: 's', url: 'https://example.com/' });
    const report = await scanSnapshots([snap]);
    // Security is filtered out here — it reads only HTTP response headers, which
    // the page-context snapshot cannot carry, so running it would flag falsely.
    expect(report.domains).toEqual([
      'accessibility',
      'privacy',
      'ai-readiness',
      'structured-data',
      'sustainability',
    ]);
    expect(report.domains).not.toContain('security');
    expect(report.sites).toEqual(['https://example.com/']);
  });

  it('detects the missing-alt accessibility finding produced by the real engine', async () => {
    const doc = docFromHtml('<main><img src="a.png" /><img src="b.png" alt="ok" /></main>');
    const snap = captureSnapshot(doc, { scanId: 's', url: 'https://example.com/' });
    const report = await scanSnapshots([snap]);
    const a11y = report.grid['https://example.com/']?.['accessibility'] ?? [];
    expect(a11y.length).toBeGreaterThanOrEqual(1);
    expect(a11y.some((f) => f.ruleId === 'image-alt')).toBe(true);
  });

  it('reports a systemic cross-site finding when the same violation appears on two origins', async () => {
    const html = '<main><img src="a.png" /></main>';
    const snapA = captureSnapshot(docFromHtml(html), { scanId: 'a', url: 'https://a.example/' });
    const snapB = captureSnapshot(docFromHtml(html), { scanId: 'b', url: 'https://b.example/' });
    const report = await scanSnapshots([snapA, snapB]);
    expect(report.sites).toHaveLength(2);
    const systemicA11y = report.crossSite.systemic.filter((s) => s.domain === 'accessibility');
    expect(systemicA11y.length).toBeGreaterThanOrEqual(1);
  });
});
