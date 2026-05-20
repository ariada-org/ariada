// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderVpatHtml } from '../src/render-vpat-html.js';
import type { VpatReport } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadMinimal(): VpatReport {
  const raw = readFileSync(path.join(__dirname, 'fixtures', 'minimal-vpat-2.5.json'), 'utf-8');
  return JSON.parse(raw) as VpatReport;
}

describe('renderVpatHtml — orchestrator', () => {
  it('returns a valid HTML5 document', () => {
    const html = renderVpatHtml(loadMinimal(), { generationTimestamp: '2026-05-19T00:00:00Z' });
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
    expect(html).toMatch(/<html lang="en"/);
    expect(html).toMatch(/<meta charset="utf-8">/);
    expect(html).toMatch(/<title>/);
  });

  it('emits one <tr> with id=wcag-X-Y-Z per WCAG criterion (non-AAA)', () => {
    const html = renderVpatHtml(loadMinimal(), {
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('id="wcag-1-1-1"');
    expect(html).toContain('id="wcag-1-4-3"');
    expect(html).toContain('id="wcag-2-4-7"');
  });

  it('hides AAA criteria behind a <details> toggle by default', () => {
    const html = renderVpatHtml(loadMinimal(), {
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('<details class="aaa-toggle">');
    // AAA row itself is inside the details element.
    expect(html).toContain('id="wcag-1-4-6"');
  });

  it('exposes AAA inline when includeAAA: true', () => {
    const html = renderVpatHtml(loadMinimal(), {
      includeAAA: true,
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).not.toContain('<details class="aaa-toggle">');
    expect(html).toContain('id="wcag-1-4-6"');
  });

  it('escapes script payloads in meta.productName', () => {
    const r = loadMinimal();
    const malicious: VpatReport = {
      ...r,
      meta: { ...r.meta, productName: '<script>alert(1)</script>' },
    };
    const html = renderVpatHtml(malicious, { generationTimestamp: '2026-05-19T00:00:00Z' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders identical output for identical inputs (reproducible builds)', () => {
    const report = loadMinimal();
    const opts = { generationTimestamp: '2026-05-19T12:34:56Z' };
    expect(renderVpatHtml(report, opts)).toBe(renderVpatHtml(report, opts));
  });

  it('emits ariada-locale-fallback meta for unknown locale', () => {
    const html = renderVpatHtml(loadMinimal(), {
      locale: 'xx',
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('ariada-locale-fallback');
    expect(html).toContain('content="xx→en"');
  });

  it('renders sv locale with Swedish skip-link text', () => {
    const html = renderVpatHtml(loadMinimal(), {
      locale: 'sv',
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('Hoppa till huvudinnehåll');
  });

  it('renders de locale with German headings', () => {
    const html = renderVpatHtml(loadMinimal(), {
      locale: 'de',
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('Deckblatt');
  });

  it('shows freshness banner when evaluationDate is older than freshnessWarningDays', () => {
    const r = loadMinimal();
    const stale: VpatReport = {
      ...r,
      meta: { ...r.meta, evaluationDate: '2020-01-01' },
    };
    const html = renderVpatHtml(stale, {
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('class="freshness-banner"');
  });

  it('renders contact-not-provided banner when evaluatorContact missing', () => {
    const r = loadMinimal();
    const { evaluatorContact: _unused, ...metaWithoutContact } = r.meta;
    const noContact: VpatReport = { ...r, meta: metaWithoutContact };
    const html = renderVpatHtml(noContact, { generationTimestamp: '2026-05-19T00:00:00Z' });
    expect(html).toContain('contact-missing');
  });

  it('renders all 8 FPC rows with derived status', () => {
    const html = renderVpatHtml(loadMinimal(), {
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('id="fpc-without-vision"');
    expect(html).toContain('id="fpc-without-speech"');
    expect(html).toContain('id="fpc-limited-cognition"');
  });

  it('renders Chapter 4-7 as Not Applicable for web product', () => {
    const html = renderVpatHtml(loadMinimal(), {
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('chapters-4-to-7');
  });

  it('embeds JSON-LD structured data', () => {
    const html = renderVpatHtml(loadMinimal(), {
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"TechArticle"');
    expect(html).toContain('"VPATReport"');
  });

  it('throws on malformed evaluationDate', () => {
    const r = loadMinimal();
    const bad: VpatReport = { ...r, meta: { ...r.meta, evaluationDate: 'not-a-date' } };
    expect(() => renderVpatHtml(bad, { generationTimestamp: '2026-05-19T00:00:00Z' })).toThrow(
      /Invalid evaluationDate/,
    );
  });

  it('renders empty-criteria warning when criteria[] is empty', () => {
    const r = loadMinimal();
    const empty: VpatReport = { ...r, criteria: [] };
    const html = renderVpatHtml(empty, { generationTimestamp: '2026-05-19T00:00:00Z' });
    expect(html).toContain('class="warning-banner"');
  });

  it('sanitises malicious brand SVG', () => {
    const html = renderVpatHtml(loadMinimal(), {
      generationTimestamp: '2026-05-19T00:00:00Z',
      brand: {
        logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>',
      },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('<circle');
  });
});
