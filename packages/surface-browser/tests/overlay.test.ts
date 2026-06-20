// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { UnifiedReport } from '@ariada-org/core-engine';
import {
  buildLoadingContent,
  highlightElement,
  removeHighlight,
  removeOverlay,
  showErrorOverlay,
  showLoadingOverlay,
  showOverlay,
} from '../src/overlay.js';

function freshWindow(html = '<html><body></body></html>'): { win: Window; doc: Document } {
  const win = new Window({ url: 'http://test.local/' });
  win.document.write(html);
  return { win, doc: win.document as unknown as Document };
}

function makeReport(
  domains: string[] = ['accessibility', 'privacy'],
  severity: 'critical' | 'serious' | 'moderate' | 'minor' = 'critical',
): UnifiedReport {
  const findings: UnifiedReport['findings'] = {};
  for (const d of domains) {
    findings[d] = [
      {
        id: 'f-1',
        scanId: 'test',
        domain: d,
        ruleId: 'rule-1',
        severity,
        element: { selector: 'img' },
        message: 'test',
        criterion: 'WCAG 1.1.1',
      },
      {
        id: 'f-2',
        scanId: 'test',
        domain: d,
        ruleId: 'rule-2',
        severity: 'minor',
        element: { selector: 'p' },
        message: 'test2',
        criterion: 'WCAG 1.4.3',
      },
    ];
  }
  return {
    scanId: 'test-scan',
    url: 'http://test.local/',
    timestamp: Date.now(),
    snapshot: {
      scanId: 'test-scan',
      url: 'http://test.local/',
      timestamp: Date.now(),
      axTree: [],
      domOutline: [],
      perfMetrics: {},
      networkResources: [],
      timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    },
    findings,
    conflicts: [],
    stats: { analyzersRun: domains, totalViolations: 2, elementsScanned: 10, durationMs: 50 },
  } as UnifiedReport;
}

function makeEmptyReport(): UnifiedReport {
  return {
    scanId: 'empty-scan',
    url: 'http://test.local/',
    timestamp: Date.now(),
    snapshot: {
      scanId: 'empty-scan',
      url: 'http://test.local/',
      timestamp: Date.now(),
      axTree: [],
      domOutline: [],
      perfMetrics: {},
      networkResources: [],
      timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    },
    findings: {},
    conflicts: [],
    stats: { analyzersRun: [], totalViolations: 0, elementsScanned: 0, durationMs: 10 },
  } as UnifiedReport;
}

// ── showOverlay ──────────────────────────────────────────────────────────────

describe('showOverlay', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ win, doc } = freshWindow());
  });

  afterEach(() => {
    win.close();
  });

  it('injects an element with the overlay host id', () => {
    showOverlay(makeReport(), doc);
    const host = doc.getElementById('ariada-scan-overlay-host');
    expect(host).not.toBeNull();
  });

  it('injects only one overlay even when called twice', () => {
    showOverlay(makeReport(), doc);
    showOverlay(makeReport(), doc);
    const hosts = doc.querySelectorAll('[id="ariada-scan-overlay-host"]');
    expect(hosts.length).toBe(1);
  });

  it('includes data-ariada-overlay attribute on the host', () => {
    const host = showOverlay(makeReport(), doc);
    expect(host.getAttribute('data-ariada-overlay')).toBe('1');
  });
});

// ── removeOverlay ────────────────────────────────────────────────────────────

describe('removeOverlay', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ win, doc } = freshWindow());
  });

  afterEach(() => {
    win.close();
  });

  it('removes the overlay element from the document', () => {
    showOverlay(makeReport(), doc);
    expect(doc.getElementById('ariada-scan-overlay-host')).not.toBeNull();
    removeOverlay(doc);
    expect(doc.getElementById('ariada-scan-overlay-host')).toBeNull();
  });

  it('does not throw when called with no overlay present', () => {
    expect(() => removeOverlay(doc)).not.toThrow();
  });
});

// ── showLoadingOverlay ───────────────────────────────────────────────────────

describe('showLoadingOverlay', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ win, doc } = freshWindow());
  });

  afterEach(() => {
    win.close();
  });

  it('injects a loading overlay with the host id', () => {
    showLoadingOverlay(doc);
    const host = doc.getElementById('ariada-scan-overlay-host');
    expect(host).not.toBeNull();
  });

  it('sets the data-ariada-overlay-loading attribute', () => {
    const host = showLoadingOverlay(doc);
    expect(host.getAttribute('data-ariada-overlay-loading')).toBe('1');
  });

  it('is replaced by showOverlay (removeOverlay called internally)', () => {
    showLoadingOverlay(doc);
    showOverlay(makeReport(), doc);
    const hosts = doc.querySelectorAll('[id="ariada-scan-overlay-host"]');
    expect(hosts.length).toBe(1);
    // Should NOT carry the loading attribute after replacement.
    const host = doc.getElementById('ariada-scan-overlay-host');
    expect(host?.getAttribute('data-ariada-overlay-loading')).toBeNull();
  });
});

// ── showErrorOverlay ─────────────────────────────────────────────────────────

describe('showErrorOverlay', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ win, doc } = freshWindow());
  });

  afterEach(() => {
    win.close();
  });

  it('injects the error overlay with the host id', () => {
    showErrorOverlay('Something broke', doc);
    const host = doc.getElementById('ariada-scan-overlay-host');
    expect(host).not.toBeNull();
  });

  it('sets the data-ariada-overlay-error attribute', () => {
    const host = showErrorOverlay('oops', doc);
    expect(host.getAttribute('data-ariada-overlay-error')).toBe('1');
  });

  it('replaces a loading overlay', () => {
    showLoadingOverlay(doc);
    showErrorOverlay('oops', doc);
    const hosts = doc.querySelectorAll('[id="ariada-scan-overlay-host"]');
    expect(hosts.length).toBe(1);
  });
});

// ── buildLoadingContent ──────────────────────────────────────────────────────

describe('buildLoadingContent', () => {
  it('returns a string containing role="status"', () => {
    const content = buildLoadingContent();
    expect(content).toContain('role="status"');
  });

  it('contains aria-live="polite"', () => {
    const content = buildLoadingContent();
    expect(content).toContain('aria-live="polite"');
  });

  it('contains the scanning spinner CSS class', () => {
    const content = buildLoadingContent();
    expect(content).toContain('spinner');
  });
});

// ── score / empty state ──────────────────────────────────────────────────────

describe('score headline', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ win, doc } = freshWindow());
  });

  afterEach(() => {
    win.close();
  });

  it('showOverlay accepts a report with no findings (empty state)', () => {
    expect(() => showOverlay(makeEmptyReport(), doc)).not.toThrow();
    const host = doc.getElementById('ariada-scan-overlay-host');
    expect(host).not.toBeNull();
  });

  it('showOverlay accepts a report with critical findings', () => {
    expect(() => showOverlay(makeReport(['accessibility'], 'critical'), doc)).not.toThrow();
    const host = doc.getElementById('ariada-scan-overlay-host');
    expect(host).not.toBeNull();
  });
});

// ── highlightElement / removeHighlight ───────────────────────────────────────

describe('highlightElement', () => {
  let doc: Document;
  let win: Window;

  beforeEach(() => {
    ({ win, doc } = freshWindow('<html><body><img id="t1" src="x.png" /></body></html>'));
  });

  afterEach(() => {
    win.close();
  });

  it('adds data-ariada-highlight to the matched element', () => {
    highlightElement(doc, '#t1');
    const el = doc.querySelector('[data-ariada-highlight]');
    expect(el).not.toBeNull();
  });

  it('does not throw for invalid selectors', () => {
    expect(() => highlightElement(doc, ':::invalid')).not.toThrow();
  });

  it('does not throw for selectors that match nothing', () => {
    expect(() => highlightElement(doc, '#nonexistent-element-xyz')).not.toThrow();
  });

  it('removeHighlight clears the attribute', () => {
    highlightElement(doc, '#t1');
    expect(doc.querySelector('[data-ariada-highlight]')).not.toBeNull();
    removeHighlight(doc);
    expect(doc.querySelector('[data-ariada-highlight]')).toBeNull();
  });

  it('removeHighlight does not throw when nothing is highlighted', () => {
    expect(() => removeHighlight(doc)).not.toThrow();
  });
});
