// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Per-violation card section — the heart of the human-readable report.
 *
 * Renders one `<article>` per `ScanFinding`. Sorted by severity DESC, then
 * by node count DESC.
 *
 * HTML snippet and selector are escaped before injection, never parsed as live
 * HTML. URLs run through escapeUrl() to reject javascript: / data: / vbscript:
 * / file: schemes.
 */

import { escapeAndTruncate, escapeHtml, escapeUrl } from '../escape.js';
import type { ScanFinding, Severity } from '../types.js';
import { wcagSCUrl } from '../wcag-sc-slugs.js';

const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

/**
 * Severity icon glyphs — combined with the text label so colour is never
 * sole information conveyor (WCAG SC 1.4.1).
 */
const SEVERITY_ICON: Readonly<Record<Severity, string>> = {
  critical: '●', // ●
  serious: '▼', // ▼
  moderate: '▲', // ▲
  minor: '○', // ○
};

const SEVERITY_ORDER: Readonly<Record<Severity, number>> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

/**
 * Sort findings into the canonical card order: severity DESC, then node-count
 * DESC. Returns a new array — does not mutate the input.
 */
export function sortFindings(findings: readonly ScanFinding[]): readonly ScanFinding[] {
  const copy = [...findings];
  copy.sort((a, b) => {
    const severityDelta = SEVERITY_ORDER[a.impact] - SEVERITY_ORDER[b.impact];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return b.nodes.length - a.nodes.length;
  });
  return copy;
}

/**
 * Compute a stable, URL-safe ID for a finding — used as the `id` of the
 * `<article>` element so action-items anchor links resolve.
 */
export function findingAnchorId(finding: ScanFinding, index: number): string {
  const safeId = finding.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `finding-${index + 1}-${safeId}`;
}

/**
 *
 */
export interface ViolationCardScreenshot {
  /** base64-encoded image data, with MIME prefix. */
  dataUrl: string;
  /** Alt text describing the cropped region. */
  alt: string;
}

/**
 *
 */
export interface RenderViolationCardOptions {
  /** Optional per-node screenshot crop (data URL). */
  screenshot?: ViolationCardScreenshot;
}

/**
 * Render a single violation card.
 */
export function renderViolationCard(
  finding: ScanFinding,
  index: number,
  options: RenderViolationCardOptions = {},
): string {
  const anchor = findingAnchorId(finding, index);
  const severity = finding.impact;
  const severityLabel = SEVERITY_LABEL[severity];
  const severityIcon = SEVERITY_ICON[severity];
  const wcagPrimary = finding.wcag[0];
  const nodeCount = finding.nodes.length;
  const firstNode = finding.nodes[0];

  const wcagLink =
    wcagPrimary === undefined
      ? ''
      : `<a class="card__wcag" href="${escapeUrl(wcagSCUrl(wcagPrimary))}" target="_blank" rel="noopener noreferrer">WCAG SC ${escapeHtml(wcagPrimary)}<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (opens in new tab)</span></a>`;

  const screenshotBlock = options.screenshot
    ? `<figure class="card__screenshot">
        <img loading="lazy" src="${escapeHtml(options.screenshot.dataUrl)}" alt="${escapeHtml(options.screenshot.alt)}" />
        <figcaption class="visually-hidden">Cropped screenshot of the affected element</figcaption>
      </figure>`
    : `<p class="card__screenshot card__screenshot--missing">(no preview available)</p>`;

  const selectorBlock = firstNode
    ? `<div class="card__field">
        <p class="card__field-label">Selector</p>
        <code class="card__field-value card__field-value--code">${escapeAndTruncate(firstNode.selector, 240)}</code>
      </div>`
    : '';

  const snippetBlock =
    firstNode && firstNode.html !== undefined && firstNode.html.length > 0
      ? `<div class="card__field">
        <p class="card__field-label">HTML snippet</p>
        <pre class="card__field-value card__field-value--code"><code>${escapeAndTruncate(firstNode.html, 200)}</code></pre>
      </div>`
      : '';

  const helpUrlBlock =
    finding.helpUrl !== undefined && finding.helpUrl.length > 0
      ? `<p class="card__helpurl">
        Read the full rule:
        <a href="${escapeUrl(finding.helpUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(finding.helpUrl)}<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (opens in new tab)</span></a>
      </p>`
      : '';

  const affectedText = `${nodeCount} ${nodeCount === 1 ? 'element' : 'elements'} affected`;

  return `<article class="card card--${severity}" id="${escapeHtml(anchor)}" aria-labelledby="${escapeHtml(anchor)}-title">
  <header class="card__header">
    <span class="card__badge card__badge--${severity}" aria-label="Severity: ${escapeHtml(severityLabel)}">
      <span class="card__badge-icon" aria-hidden="true">${severityIcon}</span>
      <span class="card__badge-text">${escapeHtml(severityLabel)}</span>
    </span>
    <code class="card__ruleid">${escapeHtml(finding.id)}</code>
    ${wcagLink}
  </header>
  <h3 class="card__title" id="${escapeHtml(anchor)}-title">${escapeHtml(finding.description)}</h3>
  <p class="card__help">${escapeHtml(finding.help)}</p>
  <p class="card__affected">${escapeHtml(affectedText)}</p>
  ${screenshotBlock}
  ${selectorBlock}
  ${snippetBlock}
  ${helpUrlBlock}
</article>`;
}

/**
 * Render the per-violation cards section. Returns the empty string when there
 * are zero findings — caller is expected to suppress the surrounding heading.
 */
export function renderViolationCards(
  findings: readonly ScanFinding[],
  screenshots: ReadonlyMap<string, ViolationCardScreenshot>,
): string {
  if (findings.length === 0) {
    return '';
  }
  const sorted = sortFindings(findings);
  const cards = sorted
    .map((finding, index) => {
      const anchor = findingAnchorId(finding, index);
      const screenshot = screenshots.get(anchor);
      return renderViolationCard(
        finding,
        index,
        screenshot === undefined ? {} : { screenshot },
      );
    })
    .join('\n  ');

  return `<section class="violations" aria-labelledby="violations-heading">
  <h2 id="violations-heading">Findings</h2>
  ${cards}
</section>`;
}
