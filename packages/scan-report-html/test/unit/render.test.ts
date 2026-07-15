// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Unit tests for the pure renderer.
 *
 * Coverage:
 *   - empty input → valid HTML5 with empty-state section
 *   - 5 findings → all rule IDs + severity badges + WCAG links present
 *   - deterministic — same input twice → identical bytes
 *   - escape — XSS payload in fields is HTML-entity-encoded, not parsed
 *   - identity footer text is bit-exact
 *   - no commercial cross-promo / no AI-disclosure / no CDN URL
 */

import { describe, expect, it } from 'vitest';

import { renderScanReport } from '../../src/index.js';
import { IDENTITY_FOOTER_TEXT } from '../../src/sections/footer.js';
import { EMPTY_INPUT, FIXTURE_FINDINGS, FIXTURE_INPUT } from '../fixtures/findings.js';

describe('renderScanReport — pure call', () => {
  it('returns a string starting with the HTML5 doctype', () => {
    const html = renderScanReport(EMPTY_INPUT);
    // The no-options call resolves to the synchronous string overload, so the
    // value is a plain string, not a Promise — nothing to await here.
    // codeql[js/missing-await]
    expect(typeof html).toBe('string');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
  });

  it('renders the empty-state section when there are zero findings', () => {
    const html = renderScanReport(EMPTY_INPUT);
    expect(html).toContain('No automated violations detected');
    // No violation cards or action-items section in the body. The CSS in the
    // <style> block still references `.action-items__list` — that's fine; we
    // assert against the actual <ol> element instead.
    expect(html).not.toContain('<article class="card');
    expect(html).not.toMatch(/<ol class="action-items__list">/);
  });

  it('renders every finding rule ID when given the five-finding fixture', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    for (const finding of FIXTURE_FINDINGS) {
      expect(html, `rule id ${finding.id} should appear`).toContain(finding.id);
      // Descriptions are HTML-entity-escaped (XSS guard) so we compare against
      // the escaped form, not the raw string. This protects the round-trip
      // invariant: input → escapeHtml → HTML body.
      const escaped = finding.description
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      expect(html, `description for ${finding.id} should appear (escaped)`).toContain(
        escaped,
      );
    }
  });

  it('emits one severity badge per finding plus action-items entries', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    // 5 cards (1× critical-card class + 1× critical-card class for second crit + …)
    expect(occurrences(html, 'card__badge--critical')).toBeGreaterThanOrEqual(2);
    expect(occurrences(html, 'card__badge--serious')).toBeGreaterThanOrEqual(1);
    expect(occurrences(html, 'card__badge--moderate')).toBeGreaterThanOrEqual(1);
    expect(occurrences(html, 'card__badge--minor')).toBeGreaterThanOrEqual(1);
    // Action items render too
    expect(html).toContain('Top ');
    expect(html).toContain('action-items__list');
  });

  it('emits at least one WCAG 2.2 Understanding-doc link per finding with a WCAG mapping', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    expect(html).toContain(
      'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    );
    expect(html).toContain(
      'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    );
    // target="_blank" rel="noopener noreferrer" on every WCAG link
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it('sorts violation cards: critical → serious → moderate → minor', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    const criticalIdx = html.indexOf('card--critical');
    const seriousIdx = html.indexOf('card--serious');
    const moderateIdx = html.indexOf('card--moderate');
    const minorIdx = html.indexOf('card--minor');
    expect(criticalIdx).toBeGreaterThan(-1);
    expect(seriousIdx).toBeGreaterThan(criticalIdx);
    expect(moderateIdx).toBeGreaterThan(seriousIdx);
    expect(minorIdx).toBeGreaterThan(moderateIdx);
  });

  it('produces byte-identical output across runs with identical input (determinism)', () => {
    const a = renderScanReport(FIXTURE_INPUT);
    const b = renderScanReport(FIXTURE_INPUT);
    expect(a).toBe(b);
  });

  it('renders the identity footer bit-exact', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    expect(html).toContain(IDENTITY_FOOTER_TEXT);
    expect(IDENTITY_FOOTER_TEXT).toBe(
      'Maintained by Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726). License: EUPL-1.2.',
    );
  });

  it('strips the cert-block hookpoint comment when options.releaseBuild = true (default)', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    expect(html).not.toContain('cert-block hookpoint');
    expect(html).toContain('data-cert-block');
  });

  it('keeps the cert-block hookpoint comment when options.releaseBuild = false', () => {
    const html = renderScanReport(FIXTURE_INPUT, { releaseBuild: false });
    expect(html).toContain('cert-block hookpoint');
  });

  it('escapes XSS payloads injected into descriptions, selectors and snippets', () => {
    const html = renderScanReport({
      meta: FIXTURE_INPUT.meta,
      findings: [
        {
          id: 'evil-rule',
          impact: 'critical',
          description: '<script>alert("xss")</script>',
          help: '"><img src=x onerror=alert(1)>',
          helpUrl: 'javascript:alert(1)',
          wcag: ['1.4.3'],
          nodes: [
            {
              selector: '<script>steal()</script>',
              html: '<img src=x onerror="alert(1)">',
            },
          ],
        },
      ],
    });
    expect(html).not.toMatch(/<script>alert\("xss"\)<\/script>/);
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    // javascript: URLs are stripped to the empty string — no live href
    expect(html).not.toContain('href="javascript:');
  });

  it('contains no CDN URL and no commercial cross-promo', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    expect(html).not.toMatch(/https?:\/\/(cdn|fonts|unpkg|jsdelivr|cdnjs)\./i);
    // No commercial sister product cross-promo
    expect(html).not.toMatch(/\bariada\.ai\b/i);
    expect(html).not.toMatch(/\bpricing\b/i);
    expect(html).not.toMatch(/\bbuy\s+now\b/i);
    // No AI-disclosure footer
    expect(html).not.toMatch(/\bai\s+assistance\b/i);
    expect(html).not.toMatch(/\bgenerated\s+with\b/i);
    expect(html).not.toMatch(/\bclaude\b/i);
    expect(html).not.toMatch(/\bchatgpt\b/i);
  });
});

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}
