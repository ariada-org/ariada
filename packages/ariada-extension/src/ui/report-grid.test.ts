// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { MultiDomainReport } from '@ariada-org/core-engine';
import { describe, it, expect } from 'vitest';

import { renderGrid } from './report-grid.js';
import type { DomainColumn } from './report-grid.js';

const COLUMNS: DomainColumn[] = [
  { id: 'accessibility', label: 'Accessibility', source: 'built-in' },
  { id: 'privacy', label: 'Privacy', source: 'built-in' },
];

function makeReport(): MultiDomainReport {
  return {
    sites: ['https://a.example/'],
    domains: ['accessibility', 'privacy'],
    grid: {
      'https://a.example/': {
        accessibility: [
          {
            id: 'image-alt-img',
            scanId: 's',
            domain: 'accessibility',
            ruleId: 'image-alt',
            severity: 'serious',
            element: { selector: 'img.hero' },
            message: 'Image is missing alternative text',
          },
        ],
        privacy: [],
      },
    },
    interactions: [],
    crossSite: { systemic: [], divergence: [] },
  };
}

/** Extract a plain <table> from the DocumentFragment returned by renderGrid. */
function extractTable(frag: DocumentFragment): HTMLTableElement {
  const t = frag.querySelector('table.report-grid');
  if (!t) throw new Error('No report-grid table in fragment');
  return t as HTMLTableElement;
}

describe('renderGrid', () => {
  it('renders a table with one column header per domain', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const headers = Array.from(table.querySelectorAll('thead th')).map((h) => h.textContent ?? '');
    expect(headers.join(' ')).toContain('Accessibility');
    expect(headers.join(' ')).toContain('Privacy');
  });

  it('renders one row per scanned site with the site url visible', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const rowHeaders = Array.from(table.querySelectorAll('tbody th'));
    expect(rowHeaders).toHaveLength(1);
    expect(rowHeaders[0]?.textContent).toContain('a.example');
  });

  it('shows the finding count in the matching cell', () => {
    const frag = renderGrid(makeReport(), COLUMNS);
    const table = extractTable(frag);
    const cells = Array.from(table.querySelectorAll('tbody td'));
    const texts = cells.map((c) => c.textContent ?? '');
    expect(texts.some((t) => t.includes('1'))).toBe(true);
    expect(texts.some((t) => t.includes('0'))).toBe(true);
  });

  it('marks a non-zero cell with a text label, not colour alone (accessibility requirement)', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const failCell = table.querySelector('td[data-state="findings"]');
    expect(failCell).not.toBeNull();
    expect((failCell?.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('uses an accessible table structure: caption + scoped header cells', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    expect(table.querySelector('caption')).not.toBeNull();
    expect(table.querySelector('thead th[scope="col"]')).not.toBeNull();
    expect(table.querySelector('tbody th[scope="row"]')).not.toBeNull();
  });

  it('wraps the table in a scroll container (report-grid-wrapper)', () => {
    const frag = renderGrid(makeReport(), COLUMNS);
    const wrapper = frag.querySelector('.report-grid-wrapper');
    expect(wrapper).not.toBeNull();
    const table = wrapper?.querySelector('table.report-grid');
    expect(table).not.toBeNull();
  });

  it('adds a source badge to a pluggable (non built-in) column header', () => {
    const columns: DomainColumn[] = [
      ...COLUMNS,
      { id: 'stub-a11y', label: 'Stub', source: 'local-file', trusted: false },
    ];
    const report = makeReport();
    const withStub: MultiDomainReport = {
      ...report,
      domains: [...report.domains, 'stub-a11y'],
      grid: {
        'https://a.example/': {
          ...report.grid['https://a.example/'],
          'stub-a11y': [],
        },
      },
    };
    const table = extractTable(renderGrid(withStub, columns));
    const stubHeader = table.querySelector('thead th[data-source="local-file"]');
    expect(stubHeader).not.toBeNull();
    expect(stubHeader?.textContent ?? '').toContain('⚠');
  });

  it('renders a cross-domain interaction badge when an interaction is present', () => {
    const report = makeReport();
    const withInteraction: MultiDomainReport = {
      ...report,
      interactions: [
        {
          id: 'i1',
          type: 'conflict',
          domains: ['accessibility', 'privacy'],
          elementKey: 'img',
          predictedEffect: 'remediating privacy hides the labelled control',
          confidence: 0.8,
        },
      ],
    };
    const table = extractTable(renderGrid(withInteraction, COLUMNS));
    const badge = table.querySelector('[data-interaction]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent ?? '').toContain('accessibility');
  });

  // ── Drill-down (Priority 1 — table-stakes competitor gap) ─────────────────

  it('renders a <details>/<summary> drill-down for cells with findings', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const findingsCell = table.querySelector('td[data-state="findings"]');
    expect(findingsCell).not.toBeNull();
    const details = findingsCell?.querySelector('details.findings-detail');
    expect(details).not.toBeNull();
    const summary = details?.querySelector('summary.findings-summary');
    expect(summary).not.toBeNull();
    // Summary must contain the finding count as readable text
    expect((summary?.textContent ?? '').trim()).toContain('finding');
  });

  it('lists each finding inside the drill-down with message and selector', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const findingList = table.querySelector('.finding-list');
    expect(findingList).not.toBeNull();
    const items = findingList?.querySelectorAll('.finding-item');
    expect(items?.length).toBe(1);
    const text = items?.[0]?.textContent ?? '';
    expect(text).toContain('Image is missing alternative text');
    expect(text).toContain('img.hero');
  });

  it('includes a severity pill in each finding item (triple encoding)', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const pill = table.querySelector('.severity-pill[data-severity="serious"]');
    expect(pill).not.toBeNull();
    // Pill text must include the word so colour is not the only signal
    expect((pill?.textContent ?? '').toLowerCase()).toContain('serious');
  });

  it('includes a WCAG link for each finding (standard linkage)', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const wcagLink = table.querySelector('a.wcag-link');
    expect(wcagLink).not.toBeNull();
    // Must point to a WCAG domain
    const href = wcagLink?.getAttribute('href') ?? '';
    expect(href).toContain('w3.org');
    // Must carry an accessible label for screen readers
    const ariaLabel = wcagLink?.getAttribute('aria-label') ?? '';
    expect(ariaLabel.length).toBeGreaterThan(0);
  });

  it('maps the image-alt rule ID to WCAG 1.1.1 (Non-text content)', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const wcagLink = table.querySelector('a.wcag-link');
    const href = wcagLink?.getAttribute('href') ?? '';
    expect(href).toContain('non-text-content');
  });

  it('renders a zero-findings cell without a drill-down (no empty <details>)', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const clearCell = table.querySelector('td[data-state="clear"]');
    expect(clearCell).not.toBeNull();
    // Zero-findings cells must NOT have a details element (nothing to expand)
    expect(clearCell?.querySelector('details')).toBeNull();
    expect((clearCell?.textContent ?? '').trim()).toBe('0 — clear');
  });

  // ── Empty-state note (always-rendered, never bare) ─────────────────────────

  it('renders an always-visible empty-state note when there are no interactions', () => {
    const frag = renderGrid(makeReport(), COLUMNS);
    // The fragment must contain a role=note explaining the empty state
    const note = frag.querySelector('[role="note"].empty-panel');
    expect(note).not.toBeNull();
    expect((note?.textContent ?? '').length).toBeGreaterThan(0);
  });

  it('does NOT render the empty-state note when interactions are present', () => {
    const report = makeReport();
    const withInteraction: MultiDomainReport = {
      ...report,
      interactions: [
        {
          id: 'i1',
          type: 'conflict',
          domains: ['accessibility', 'privacy'],
          elementKey: 'img',
          predictedEffect: 'hides labelled control',
          confidence: 0.9,
        },
      ],
    };
    const frag = renderGrid(withInteraction, COLUMNS);
    const note = frag.querySelector('[role="note"].empty-panel');
    expect(note).toBeNull();
  });

  // ── axe-core structural assertions ─────────────────────────────────────────
  // We verify the generated table has the structural invariants that axe-core
  // checks for: scoped headers, a caption, no empty header cells, and list
  // semantics inside the drill-down. This keeps us honest as an accessibility
  // product shipping its own UI.

  it('axe structural: all column headers carry scope=col', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const colHeaders = table.querySelectorAll('thead th');
    for (const th of Array.from(colHeaders)) {
      expect(th.getAttribute('scope')).toBe('col');
    }
  });

  it('axe structural: all row headers carry scope=row', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const rowHeaders = table.querySelectorAll('tbody th');
    for (const th of Array.from(rowHeaders)) {
      expect(th.getAttribute('scope')).toBe('row');
    }
  });

  it('axe structural: finding list carries role=list for explicit semantics', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const list = table.querySelector('.finding-list');
    // role=list is set explicitly because CSS list-style:none strips the implicit role
    // in some user agents (VoiceOver/Safari)
    expect(list?.getAttribute('role')).toBe('list');
  });

  it('axe structural: WCAG link carries a non-empty aria-label', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    const link = table.querySelector('a.wcag-link');
    expect((link?.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
  });

  it('axe structural: severity pill conveys severity as text, not colour alone', () => {
    const table = extractTable(renderGrid(makeReport(), COLUMNS));
    // Each severity pill must have non-empty textContent so screen readers can read it
    const pills = table.querySelectorAll('.severity-pill');
    for (const pill of Array.from(pills)) {
      expect((pill.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });
});
