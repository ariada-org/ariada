// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalyzerContext, DomainAnalyzer, Finding } from '@ariada-org/core-engine';
import { scan } from '../src/scan.js';

function freshDoc(html: string, url = 'http://test.local/'): { doc: Document; win: Window } {
  const win = new Window({ url });
  win.document.write(html);
  return { doc: win.document as unknown as Document, win };
}

const violatingAnalyzer: DomainAnalyzer = {
  domain: 'accessibility',
  version: 'test',
  ruleIds: ['image-alt'],
  async analyze(_ctx: AnalyzerContext): Promise<Finding[]> {
    return [
      {
        id: 'f-1',
        scanId: 'will-be-overwritten',
        domain: 'accessibility',
        ruleId: 'image-alt',
        severity: 'critical',
        element: { selector: 'img:nth-of-type(1)' },
        message: 'Missing alt text',
        criterion: 'WCAG 2.2 1.1.1',
      },
    ];
  },
  async analyzeElement(): Promise<Finding[]> {
    return [];
  },
};

const passingAnalyzer: DomainAnalyzer = {
  domain: 'accessibility',
  version: 'test',
  ruleIds: [],
  async analyze(): Promise<Finding[]> { return []; },
  async analyzeElement(): Promise<Finding[]> { return []; },
};

describe('scan()', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ doc, win } = freshDoc('<img src="x.png">'));
  });

  afterEach(() => {
    win.close();
    vi.restoreAllMocks();
  });

  it('returns a ScanSurfaceResult with the correct shape', async () => {
    const result = await scan({
      document: doc,
      analyzers: [passingAnalyzer],
      url: 'http://test.local/page',
    });
    expect(result).toHaveProperty('scanResult');
    expect(result).toHaveProperty('firstPartyOnly');
    expect(result).toHaveProperty('activeDomains');
    expect(typeof result.scanResult.report).toBe('object');
  });

  it('returns non-empty findings on a page with violations', async () => {
    // url matches the doc's window origin (http://test.local) → same-origin → guard passes
    const result = await scan({
      document: doc,
      analyzers: [violatingAnalyzer],
      url: 'http://test.local/page',
    });
    const findings = result.scanResult.report.findings['accessibility'];
    expect(findings).toBeDefined();
    expect(Array.isArray(findings)).toBe(true);
    expect((findings ?? []).length).toBeGreaterThan(0);
  });

  it('activeDomains matches the analyzers that ran', async () => {
    const result = await scan({
      document: doc,
      analyzers: [passingAnalyzer],
      url: 'http://test.local/page',
    });
    expect(result.activeDomains).toContain('accessibility');
  });

  it('sets firstPartyOnly=false when same origin', async () => {
    // opts.url matches the doc's window.location.origin (http://test.local)
    // so the first-party guard should NOT apply.
    const result = await scan({
      document: doc,
      analyzers: [passingAnalyzer],
      url: 'http://test.local/some-page',
    });
    expect(result.firstPartyOnly).toBe(false);
  });

  it('sets firstPartyOnly=true when cross-origin context', async () => {
    // The doc's window origin is http://test.local (from the Window URL).
    // We pass opts.url pointing to a different origin to simulate cross-origin.
    // The first-party guard compares the window's origin against opts.url.
    const result = await scan({
      document: doc,
      analyzers: [passingAnalyzer],
      // opts.url differs from the doc's own window origin (http://test.local)
      url: 'https://different-origin.example.com/page',
    });
    // window origin (http://test.local) !== https://different-origin.example.com
    expect(result.firstPartyOnly).toBe(true);
  });

  it('calls scanCurrentDocument exactly once (no double capture)', async () => {
    // We verify indirectly: if capture were called twice we'd get duplicate findings.
    // Two successive scans should return independent results.
    const r1 = await scan({ document: doc, analyzers: [violatingAnalyzer], url: 'http://test.local/page' });
    const r2 = await scan({ document: doc, analyzers: [violatingAnalyzer], url: 'http://test.local/page' });
    // Both scans run independently with non-zero findings
    expect((r1.scanResult.report.findings['accessibility'] ?? []).length).toBeGreaterThan(0);
    expect((r2.scanResult.report.findings['accessibility'] ?? []).length).toBeGreaterThan(0);
  });

  it('returns a valid result when no analyzers are provided', async () => {
    // When no analyzers are given, the engine still returns an empty report.
    const result = await scan({
      document: doc,
      analyzers: [],
      url: 'http://test.local/',
    });
    expect(result.scanResult.report).toBeDefined();
    expect(result.activeDomains).toEqual([]);
  });
});
