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
            element: { selector: 'img' },
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

describe('renderGrid', () => {
  it('renders a table with one column header per domain', () => {
    const table = renderGrid(makeReport(), COLUMNS);
    const headers = Array.from(table.querySelectorAll('thead th')).map((h) => h.textContent ?? '');
    expect(headers.join(' ')).toContain('Accessibility');
    expect(headers.join(' ')).toContain('Privacy');
  });

  it('renders one row per scanned site with the site url visible', () => {
    const table = renderGrid(makeReport(), COLUMNS);
    const rowHeaders = Array.from(table.querySelectorAll('tbody th'));
    expect(rowHeaders).toHaveLength(1);
    expect(rowHeaders[0]?.textContent).toContain('a.example');
  });

  it('shows the finding count in the matching cell', () => {
    const table = renderGrid(makeReport(), COLUMNS);
    const cells = Array.from(table.querySelectorAll('tbody td'));
    // accessibility cell shows 1 finding, privacy cell shows 0
    const texts = cells.map((c) => c.textContent ?? '');
    expect(texts.some((t) => t.includes('1'))).toBe(true);
    expect(texts.some((t) => t.includes('0'))).toBe(true);
  });

  it('marks a non-zero cell with a text label, not colour alone (accessibility requirement)', () => {
    const table = renderGrid(makeReport(), COLUMNS);
    const failCell = table.querySelector('td[data-state="findings"]');
    expect(failCell).not.toBeNull();
    // the cell carries a non-empty accessible text describing the count
    expect((failCell?.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('uses an accessible table structure: caption + scoped header cells', () => {
    const table = renderGrid(makeReport(), COLUMNS);
    expect(table.querySelector('caption')).not.toBeNull();
    expect(table.querySelector('thead th[scope="col"]')).not.toBeNull();
    expect(table.querySelector('tbody th[scope="row"]')).not.toBeNull();
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
    const table = renderGrid(withStub, columns);
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
    const table = renderGrid(withInteraction, COLUMNS);
    const badge = table.querySelector('[data-interaction]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent ?? '').toContain('accessibility');
  });
});
