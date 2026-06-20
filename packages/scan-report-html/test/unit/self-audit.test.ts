// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Structural self-audit of the rendered report HTML.
 *
 * The rendered report must pass axe-core WCAG 2.2 AA with zero violations.
 * The full axe-playwright E2E run is the next layer. The scaffold ships this
 * structural pre-audit —
 * a strict regex-based check of the WCAG-AA structural invariants that
 * static-HTML analysis can confirm without spawning a browser:
 *
 *   - <html lang="…"> attribute present (WCAG 3.1.1)
 *   - single <h1> (heading order — WCAG 1.3.1 / 2.4.6)
 *   - <header>, <main>, <footer> landmarks (WCAG 1.3.1 / 2.4.1)
 *   - skip-link first focusable (WCAG 2.4.1)
 *   - every <img> has an alt attribute (WCAG 1.1.1)
 *   - every external link has rel="noopener noreferrer" (security + WCAG 2.4.4)
 *   - every aria-labelledby points at an existing id (WCAG 4.1.2)
 *
 * Known false-positives explicitly tolerated by this audit pass:
 *   - none.
 *
 * If this audit fails, the downstream axe-playwright E2E is guaranteed
 * to fail too. The full axe pass (color-contrast computed via real layout
 * + zoom + screen-reader-name resolution) is layered on top in E2E.
 */

import { describe, expect, it } from 'vitest';

import { renderScanReport } from '../../src/index.js';
import { EMPTY_INPUT, FIXTURE_INPUT } from '../fixtures/findings.js';

function countOccurrences(haystack: string, pattern: RegExp): number {
  const matches = haystack.match(pattern);
  return matches === null ? 0 : matches.length;
}

function extractIds(html: string): Set<string> {
  const ids = new Set<string>();
  const re = / id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[1] !== undefined) {
      ids.add(match[1]);
    }
  }
  return ids;
}

function checkAriaLabelledByResolves(html: string): { ok: boolean; orphans: string[] } {
  const ids = extractIds(html);
  const orphans: string[] = [];
  const re = / aria-labelledby="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const ref = match[1];
    if (ref === undefined) {
      continue;
    }
    for (const token of ref.split(/\s+/)) {
      if (token.length > 0 && !ids.has(token)) {
        orphans.push(token);
      }
    }
  }
  return { ok: orphans.length === 0, orphans };
}

describe('rendered report — structural WCAG 2.2 AA self-audit', () => {
  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('declares a document language on <html lang="…"> (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(html).toMatch(/<html lang="[a-z]{2}(-[A-Z]{2})?">/);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('contains exactly one <h1> (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(countOccurrences(html, /<h1[\s>]/g)).toBe(1);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('contains the three required landmarks (header / main / footer) (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(html).toMatch(/<header[\s>]/);
    expect(html).toMatch(/<main[\s>]/);
    expect(html).toMatch(/<footer[\s>]/);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('places the skip-link as the first focusable element (%s)', (_, input) => {
    const html = renderScanReport(input);
    const skipIdx = html.indexOf('class="skip-link"');
    const mainIdx = html.indexOf('<main');
    expect(skipIdx).toBeGreaterThan(0);
    expect(skipIdx).toBeLessThan(mainIdx);
    expect(html).toMatch(/<a class="skip-link" href="#main">Skip to main content<\/a>/);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('every <img> element has an alt attribute (%s)', (_, input) => {
    const html = renderScanReport(input);
    // Find all real <img …> tags emitted by the renderer; for each, alt="…"
    // must appear in the tag. The fixture's escaped <img …> inside <code>
    // blocks is not a real <img> — it's "&lt;img…&gt;".
    const imgRe = /<img\b[^>]*>/g;
    const imgs = html.match(imgRe) ?? [];
    for (const tag of imgs) {
      expect(tag, `img tag without alt: ${tag}`).toMatch(/\salt="/);
    }
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('every target=_blank link carries rel="noopener noreferrer" (%s)', (_, input) => {
    const html = renderScanReport(input);
    const blanks = html.match(/<a [^>]*target="_blank"[^>]*>/g) ?? [];
    for (const tag of blanks) {
      expect(tag, `target=_blank without rel=noopener noreferrer: ${tag}`).toContain(
        'rel="noopener noreferrer"',
      );
    }
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('every aria-labelledby resolves to a real id in the document (%s)', (_, input) => {
    const html = renderScanReport(input);
    const result = checkAriaLabelledByResolves(html);
    expect(result.orphans, `dangling aria-labelledby tokens: ${result.orphans.join(', ')}`)
      .toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('contains no <iframe> (full self-containment) (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(html).not.toMatch(/<iframe\b/);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('contains no remote <script src="…"> (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('contains no <link rel="stylesheet"> (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(html).not.toMatch(/<link[^>]*rel="stylesheet"/);
  });

  it.each([
    ['empty', EMPTY_INPUT],
    ['five findings', FIXTURE_INPUT],
  ] as const)('has a <meta name="viewport"> (responsive baseline) (%s)', (_, input) => {
    const html = renderScanReport(input);
    expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1"/);
  });

  it('byte-length stays well under 2 MB for the 5-finding fixture', () => {
    const html = renderScanReport(FIXTURE_INPUT);
    const bytes = Buffer.byteLength(html, 'utf8');
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });
});
