// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Per-violation card section — the heart of the human-readable report.
 *
 * Renders one `<article>` per `ScanFinding`, wrapped in `<details>` for
 * progressive disclosure. Default expanded for reports with fewer than 6
 * findings; collapsed otherwise (helps readability on large reports).
 *
 * Sorted by severity DESC, then by node count DESC.
 *
 * All user-supplied text is escaped before injection (never parsed as live
 * HTML). URLs run through escapeUrl() to reject javascript: / data: / vbscript:
 * / file: schemes. No inline JavaScript.
 */

import { escapeAndTruncate, escapeHtml, escapeUrl } from '../escape.js';
import type { ScanFinding, Severity, ViolationNode } from '../types.js';
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
 * Optional per-finding screenshot crop (base64 data URL).
 */
export interface ViolationCardScreenshot {
  /** base64-encoded image data, with MIME prefix. */
  dataUrl: string;
  /** Alt text describing the cropped region. */
  alt: string;
}

/**
 * Options passed to the single-card renderer.
 */
export interface RenderViolationCardOptions {
  /** Optional per-node screenshot crop (data URL). */
  screenshot?: ViolationCardScreenshot;
  /**
   * When true the `<details>` element starts expanded. When false (default
   * for reports with many findings) it starts collapsed and the user clicks
   * the summary to expand.
   */
  defaultOpen?: boolean;
}

/** Maximum number of nodes rendered inline before a "show more" collapse. */
const INLINE_NODES = 3;

/**
 * Render a single violation node row (selector, HTML snippet, failure summary).
 */
function renderNode(node: ViolationNode, index: number): string {
  const selectorBlock = `<div class="node__field">
          <p class="node__field-label">Selector</p>
          <code class="node__field-value node__field-value--code">${escapeAndTruncate(node.selector, 240)}</code>
        </div>`;

  const snippetBlock =
    node.html !== undefined && node.html.length > 0
      ? `<div class="node__field">
          <p class="node__field-label">HTML snippet</p>
          <pre class="node__field-value node__field-value--code"><code>${escapeAndTruncate(node.html, 200)}</code></pre>
        </div>`
      : '';

  const failureBlock =
    node.failureSummary !== undefined && node.failureSummary.length > 0
      ? `<div class="node__field node__field--failure">
          <p class="node__field-label">Why it fails</p>
          <p class="node__field-value node__failure-summary">${escapeHtml(node.failureSummary)}</p>
        </div>`
      : '';

  return `<li class="node" aria-label="Element ${index + 1}">
        ${selectorBlock}
        ${snippetBlock}
        ${failureBlock}
      </li>`;
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
  const defaultOpen = options.defaultOpen ?? true;

  const wcagLink =
    wcagPrimary === undefined
      ? ''
      : `<a class="card__wcag" href="${escapeUrl(wcagSCUrl(wcagPrimary))}" target="_blank" rel="noopener noreferrer">WCAG SC ${escapeHtml(wcagPrimary)}<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (opens in new tab)</span></a>`;

  // All WCAG SC links (secondary criteria displayed as small tags)
  const allWcag =
    finding.wcag.length > 1
      ? `<p class="card__wcag-extra">
          Also: ${finding.wcag
            .slice(1)
            .map(
              (sc) =>
                `<a href="${escapeUrl(wcagSCUrl(sc))}" target="_blank" rel="noopener noreferrer">SC ${escapeHtml(sc)}<span class="visually-hidden"> (opens in new tab)</span></a>`,
            )
            .join(', ')}
        </p>`
      : '';

  const screenshotBlock = options.screenshot
    ? `<figure class="card__screenshot">
        <img loading="lazy" src="${escapeHtml(options.screenshot.dataUrl)}" alt="${escapeHtml(options.screenshot.alt)}" />
        <figcaption class="visually-hidden">Cropped screenshot of the affected element</figcaption>
      </figure>`
    : '';

  const affectedText = `${nodeCount} ${nodeCount === 1 ? 'element' : 'elements'} affected`;

  // Render all nodes — first INLINE_NODES shown directly, remainder collapsible
  const inlineNodes = finding.nodes.slice(0, INLINE_NODES);
  const extraNodes = finding.nodes.slice(INLINE_NODES);

  const inlineNodeHtml =
    inlineNodes.length > 0
      ? `<ol class="node-list" aria-label="Affected elements">
        ${inlineNodes.map((n, i) => renderNode(n, i)).join('\n        ')}
      </ol>`
      : '';

  const extraNodeHtml =
    extraNodes.length > 0
      ? `<details class="node-overflow">
        <summary class="node-overflow__toggle">${extraNodes.length} more ${extraNodes.length === 1 ? 'element' : 'elements'}</summary>
        <ol class="node-list node-list--extra" aria-label="Additional affected elements" start="${inlineNodes.length + 1}">
          ${extraNodes.map((n, i) => renderNode(n, inlineNodes.length + i)).join('\n          ')}
        </ol>
      </details>`
      : '';

  const helpUrlBlock =
    finding.helpUrl !== undefined && finding.helpUrl.length > 0
      ? `<p class="card__helpurl">
        Read the full rule:
        <a href="${escapeUrl(finding.helpUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(finding.helpUrl)}<span aria-hidden="true"> ↗</span><span class="visually-hidden"> (opens in new tab)</span></a>
      </p>`
      : '';

  const openAttr = defaultOpen ? ' open' : '';

  return `<li class="card-item">
  <details class="card card--${severity}"${openAttr} id="${escapeHtml(anchor)}">
    <summary class="card__summary" aria-describedby="${escapeHtml(anchor)}-title">
      <header class="card__header">
        <span class="card__badge card__badge--${severity}" aria-label="Severity: ${escapeHtml(severityLabel)}">
          <span class="card__badge-icon" aria-hidden="true">${severityIcon}</span>
          <span class="card__badge-text">${escapeHtml(severityLabel)}</span>
        </span>
        <code class="card__ruleid">${escapeHtml(finding.id)}</code>
        <span class="card__node-count">${escapeHtml(affectedText)}</span>
        ${wcagLink}
      </header>
      <h3 class="card__title" id="${escapeHtml(anchor)}-title">${escapeHtml(finding.description)}</h3>
    </summary>
    <div class="card__body">
      <p class="card__help">${escapeHtml(finding.help)}</p>
      ${allWcag}
      ${screenshotBlock}
      ${inlineNodeHtml}
      ${extraNodeHtml}
      ${helpUrlBlock}
    </div>
  </details>
</li>`;
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
  // Default open when report is small (< 6 findings); collapsed for large reports
  const defaultOpen = sorted.length < 6;

  const cards = sorted
    .map((finding, index) => {
      const anchor = findingAnchorId(finding, index);
      const screenshot = screenshots.get(anchor);
      return renderViolationCard(
        finding,
        index,
        screenshot === undefined ? { defaultOpen } : { screenshot, defaultOpen },
      );
    })
    .join('\n  ');

  return `<section class="violations" aria-labelledby="violations-heading">
  <h2 id="violations-heading">Findings</h2>
  <ul class="violations-list" role="list">
    ${cards}
  </ul>
</section>`;
}
